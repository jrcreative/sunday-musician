import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/app-url";
import { computeFees } from "@/lib/stripe/fees";
import { withJsonErrors } from "@/lib/api/handler";
import { requireActiveUser } from "@/lib/api/active-user";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { bookingConfirmedEmail } from "@/lib/email/templates/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BookingNoticeRow = {
  id: string;
  thread_id: string;
  service_date: string;
  fee: number | null;
  fee_type: string | null;
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

function feeLabel(fee: number | null, feeType: string | null) {
  if (fee == null) return "Fee TBD";
  return `$${fee} ${feeType ?? "Per service"}`;
}

async function sendBookingConfirmedEmails(admin: ReturnType<typeof createAdminClient>, bookingId: string) {
  const { data: booking } = await admin
    .from("bookings")
    .select(`
      id, thread_id, service_date, fee, fee_type,
      service_requests ( title ),
      church_profiles ( church_name, profile_id, profiles ( email, display_name ) ),
      musician_profiles ( profile_id, profiles ( email, display_name ) )
    `)
    .eq("id", bookingId)
    .single() as unknown as { data: BookingNoticeRow | null };
  if (!booking) return;

  const event = EMAIL_EVENTS.bookingConfirmed;
  const templateId = configuredTemplateId(event);
  const threadUrl = appUrl(`/messages/${booking.thread_id}`);
  const requestTitle = booking.service_requests?.title ?? "Booking";
  const label = feeLabel(booking.fee, booking.fee_type);
  const church = booking.church_profiles;
  const musician = booking.musician_profiles;
  const recipients = [
    {
      role: "church",
      profileId: church?.profile_id ?? null,
      email: church?.profiles?.email ?? null,
      name: church?.profiles?.display_name ?? church?.church_name ?? "Church",
      counterparty: musician?.profiles?.display_name ?? "Musician",
    },
    {
      role: "musician",
      profileId: musician?.profile_id ?? null,
      email: musician?.profiles?.email ?? null,
      name: musician?.profiles?.display_name ?? "Musician",
      counterparty: church?.church_name ?? "Church",
    },
  ];

  for (const recipient of recipients) {
    if (!recipient.profileId || !recipient.email) continue;
    const message = bookingConfirmedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      counterpartyName: recipient.counterparty,
      requestTitle,
      serviceDate: booking.service_date,
      feeLabel: label,
      threadUrl,
    });
    await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${booking.id}:${recipient.role}`,
      recipientProfileId: recipient.profileId,
      message,
      template: templateId ? {
        templateId,
        variables: {
          RECIPIENT_NAME: recipient.name,
          COUNTERPARTY_NAME: recipient.counterparty,
          REQUEST_TITLE: requestTitle,
          SERVICE_DATE: booking.service_date,
          FEE_LABEL: label,
          THREAD_URL: threadUrl,
        },
      } : undefined,
      payload: { booking_id: booking.id, thread_id: booking.thread_id, recipient_role: recipient.role },
    });
  }
}

// Accept a proposal. Validates that:
//   - the caller is the musician on the thread (only musicians accept)
//   - the church has a default card on file
//   - the musician has a Connect account with charges_enabled
// On success: flips the message to accepted (which triggers booking creation
// via the existing handle_proposal_accepted trigger), then inserts the
// payments row scheduled for the service date.
export const POST = withJsonErrors(async (req: Request) => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const messageId = typeof body.messageId === "string" ? body.messageId : null;
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const { data: msg } = await supabase
    .from("messages")
    .select("id, thread_id, kind, proposal, proposal_status")
    .eq("id", messageId)
    .single();
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (msg.kind !== "proposal") {
    return NextResponse.json({ error: "Not a proposal" }, { status: 400 });
  }
  if (msg.proposal_status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("id, church_profile_id, musician_profile_id, request_id")
    .eq("id", msg.thread_id)
    .single();
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const { data: musician } = await supabase
    .from("musician_profiles").select("id, profile_id").eq("profile_id", active.user.id).maybeSingle();
  if (!musician || musician.id !== thread.musician_profile_id) {
    return NextResponse.json({ error: "Only the musician can accept this proposal" }, { status: 403 });
  }

  const proposal = (msg.proposal ?? {}) as { fee?: number | string | null };
  const feeDollars = typeof proposal.fee === "number"
    ? proposal.fee
    : typeof proposal.fee === "string" && proposal.fee !== ""
      ? Number(proposal.fee)
      : null;
  if (!feeDollars || !Number.isFinite(feeDollars) || feeDollars <= 0) {
    return NextResponse.json({ error: "Proposal must have a fee" }, { status: 400 });
  }
  const musicianAmount = Math.round(feeDollars * 100);

  const admin = createAdminClient();

  const { data: stripeAcct } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("musician_profile_id", thread.musician_profile_id)
    .maybeSingle();
  if (!stripeAcct || !stripeAcct.charges_enabled) {
    return NextResponse.json({
      error: "Connect your bank account in your profile before accepting bookings.",
      code: "musician_not_ready",
    }, { status: 400 });
  }

  const { data: stripeCustomer } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id, default_payment_method")
    .eq("church_profile_id", thread.church_profile_id)
    .maybeSingle();
  if (!stripeCustomer || !stripeCustomer.default_payment_method) {
    return NextResponse.json({
      error: "The church doesn't have a payment method on file yet. Ask them to add a card before you accept.",
      code: "church_no_card",
    }, { status: 400 });
  }

  const fees = computeFees(musicianAmount);

  const { error: updateErr } = await admin
    .from("messages")
    .update({ proposal_status: "accepted" })
    .eq("id", messageId)
    .eq("proposal_status", "pending");
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Trigger created booking; fetch it to attach the payment.
  const { data: booking } = await admin
    .from("bookings")
    .select("id, service_date")
    .eq("thread_id", thread.id)
    .single();
  if (!booking) {
    return NextResponse.json({ error: "Booking not created" }, { status: 500 });
  }

  const { error: payErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      church_profile_id: thread.church_profile_id,
      musician_profile_id: thread.musician_profile_id,
      status: "scheduled",
      musician_amount: fees.musicianAmount,
      platform_fee: fees.platformNet,
      stripe_fee_estimate: fees.stripeFee,
      application_fee_amount: fees.applicationFeeAmount,
      charge_total: fees.chargeTotal,
      stripe_customer_id: stripeCustomer.stripe_customer_id,
      stripe_destination_id: stripeAcct.stripe_account_id,
      stripe_payment_method_id: stripeCustomer.default_payment_method,
      scheduled_for: booking.service_date,
    });
  if (payErr && !payErr.message.includes("duplicate key")) {
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }

  await sendBookingConfirmedEmails(admin, booking.id);

  return NextResponse.json({ ok: true });
});
