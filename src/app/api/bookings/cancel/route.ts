import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/api/handler";
import { requireActiveUser } from "@/lib/api/active-user";
import { cancellationPolicyFor } from "@/lib/disputes/policy";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { bookingCancelledEmail } from "@/lib/email/templates/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BookingCancelNoticeRow = {
  id: string;
  thread_id: string;
  service_date: string;
  cancelled_by: string | null;
  cancel_category: string | null;
  cancel_reason: string | null;
  cancellation_policy_label: string | null;
  dispute_review_required: boolean;
  service_requests: { title: string } | null;
  church_profiles: {
    church_name: string;
    profile_id: string;
    profiles: { email: string; display_name: string } | null;
  } | null;
  musician_profiles: {
    profile_id: string;
    profiles: { email: string; display_name: string } | null;
  } | null;
};

function reasonLabel(category: string | null, reason: string | null) {
  const cat = category ? category.replaceAll("_", " ") : "Not specified";
  return reason ? `${cat}: ${reason}` : cat;
}

async function sendBookingCancelledEmails(admin: ReturnType<typeof createAdminClient>, bookingId: string, dedupeStamp: string) {
  const { data: booking } = await admin
    .from("bookings")
    .select(`
      id, thread_id, service_date, cancelled_by, cancel_category, cancel_reason,
      cancellation_policy_label, dispute_review_required,
      service_requests ( title ),
      church_profiles ( church_name, profile_id, profiles ( email, display_name ) ),
      musician_profiles ( profile_id, profiles ( email, display_name ) )
    `)
    .eq("id", bookingId)
    .single() as unknown as { data: BookingCancelNoticeRow | null };
  if (!booking) return;

  const event = EMAIL_EVENTS.bookingCancelled;
  const templateId = configuredTemplateId(event);
  const threadUrl = appUrl(`/messages/${booking.thread_id}`);
  const requestTitle = booking.service_requests?.title ?? "Booking";
  const cancelledByName = booking.cancelled_by === "church"
    ? booking.church_profiles?.church_name ?? "Church"
    : booking.musician_profiles?.profiles?.display_name ?? "Musician";
  const reason = reasonLabel(booking.cancel_category, booking.cancel_reason);
  const policyLabel = booking.cancellation_policy_label ?? "Standard cancellation policy";
  const church = booking.church_profiles;
  const musician = booking.musician_profiles;
  const recipients = [
    {
      role: "church",
      profileId: church?.profile_id ?? null,
      email: church?.profiles?.email ?? null,
      name: church?.profiles?.display_name ?? church?.church_name ?? "Church",
    },
    {
      role: "musician",
      profileId: musician?.profile_id ?? null,
      email: musician?.profiles?.email ?? null,
      name: musician?.profiles?.display_name ?? "Musician",
    },
  ];

  for (const recipient of recipients) {
    if (!recipient.profileId || !recipient.email) continue;
    const message = bookingCancelledEmail({
      to: recipient.email,
      recipientName: recipient.name,
      cancelledByName,
      requestTitle,
      serviceDate: booking.service_date,
      policyLabel,
      reason,
      threadUrl,
      disputeReviewRequired: booking.dispute_review_required,
    });
    await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${booking.id}:${dedupeStamp}:${recipient.role}`,
      recipientProfileId: recipient.profileId,
      message,
      template: templateId ? {
        templateId,
        variables: {
          RECIPIENT_NAME: recipient.name,
          CANCELLED_BY_NAME: cancelledByName,
          REQUEST_TITLE: requestTitle,
          SERVICE_DATE: booking.service_date,
          POLICY_LABEL: policyLabel,
          REASON: reason,
          THREAD_URL: threadUrl,
        },
      } : undefined,
      payload: {
        booking_id: booking.id,
        thread_id: booking.thread_id,
        recipient_role: recipient.role,
        dispute_review_required: booking.dispute_review_required,
      },
    });
  }
}

// Cancel a confirmed booking. Either side may cancel before the event.
// The cancel_payment_on_booking_cancel trigger will move any 'scheduled'
// payment to 'cancelled' — no Stripe call is needed since nothing was
// captured (we only charge on the event day).
export const POST = withJsonErrors(async (req: Request) => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  const category = typeof body.category === "string" ? body.category.slice(0, 80) : null;
  const requestAdminReview = body.requestAdminReview === true;
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, church_profile_id, musician_profile_id, service_date, cancelled_at")
    .eq("id", bookingId)
    .single();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.cancelled_at) return NextResponse.json({ ok: true, alreadyCancelled: true });

  // Resolve the caller's side via their profile.
  const { data: church } = await supabase
    .from("church_profiles").select("id").eq("profile_id", active.user.id).maybeSingle();
  const { data: musician } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", active.user.id).maybeSingle();

  let role: "church" | "musician" | null = null;
  if (church && church.id === booking.church_profile_id) role = "church";
  else if (musician && musician.id === booking.musician_profile_id) role = "musician";
  if (!role) return NextResponse.json({ error: "Not a participant in this booking" }, { status: 403 });

  // Don't allow cancelling after the service date has already passed.
  const today = new Date().toISOString().slice(0, 10);
  if (booking.service_date < today) {
    return NextResponse.json({ error: "Service date has already passed; contact support." }, { status: 400 });
  }

  const admin = createAdminClient();
  const cancelledAt = new Date();
  const cancelledAtIso = cancelledAt.toISOString();
  const policy = cancellationPolicyFor({
    cancelledBy: role,
    serviceDate: booking.service_date,
    cancelledAt,
  });
  const shouldOpenDispute = requestAdminReview || policy.adminReviewMayApply;
  const { error: cancelErr } = await admin
    .from("bookings")
    .update({
      cancelled_at: cancelledAtIso,
      cancelled_by: role,
      cancel_reason: reason,
      cancel_category: category,
      cancellation_policy_label: policy.label,
      cancellation_policy: policy,
      dispute_review_required: shouldOpenDispute,
    })
    .eq("id", bookingId);
  if (cancelErr) return NextResponse.json({ error: cancelErr.message }, { status: 500 });

  if (shouldOpenDispute) {
    const { error: disputeErr } = await admin
      .from("booking_disputes")
      .upsert({
        booking_id: bookingId,
        opened_by_profile_id: active.user.id,
        opened_by_role: role,
        category: category ?? "cancellation",
        reason,
        status: "open",
      }, { onConflict: "booking_id,opened_by_role,category" });
    if (disputeErr) return NextResponse.json({ error: disputeErr.message }, { status: 500 });
  }

  await sendBookingCancelledEmails(admin, bookingId, cancelledAtIso);

  return NextResponse.json({ ok: true, policy, disputeReviewRequired: shouldOpenDispute });
});
