import { appUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { paymentCapturedEmail } from "@/lib/email/templates/marketplace";

type CapturedPaymentRow = {
  id: string;
  booking_id: string;
  charge_total: number;
  application_fee_amount: number;
  bookings: {
    thread_id: string;
    service_date: string;
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
  } | null;
};

// Notify both sides that the event-day payment succeeded: the church gets a
// receipt for the full charge, the musician a payout notice for their share.
//
// Safe to call from both the capture cron and the Stripe webhook — the
// per-recipient dedupe key means whichever path runs second is a no-op.
export async function sendPaymentCapturedEmails(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
) {
  const { data: payment } = await admin
    .from("payments")
    .select(`
      id, booking_id, charge_total, application_fee_amount,
      bookings (
        thread_id, service_date,
        service_requests ( title ),
        church_profiles ( church_name, profile_id, profiles ( email, display_name ) ),
        musician_profiles ( profile_id, profiles ( email, display_name ) )
      )
    `)
    .eq("id", paymentId)
    .eq("status", "captured")
    .maybeSingle() as unknown as { data: CapturedPaymentRow | null };

  const booking = payment?.bookings;
  if (!payment || !booking) return;

  const event = EMAIL_EVENTS.paymentCaptured;
  const templateId = configuredTemplateId(event);
  const requestTitle = booking.service_requests?.title ?? "Booking";
  const threadUrl = appUrl(`/messages/${booking.thread_id}`);
  // Destination charge: the church pays charge_total; Stripe forwards
  // charge_total minus our application fee to the musician.
  const musicianPayout = payment.charge_total - payment.application_fee_amount;
  const recipients = [
    {
      role: "church" as const,
      profileId: booking.church_profiles?.profile_id ?? null,
      email: booking.church_profiles?.profiles?.email ?? null,
      name: booking.church_profiles?.profiles?.display_name ?? booking.church_profiles?.church_name ?? "Church",
      amountCents: payment.charge_total,
    },
    {
      role: "musician" as const,
      profileId: booking.musician_profiles?.profile_id ?? null,
      email: booking.musician_profiles?.profiles?.email ?? null,
      name: booking.musician_profiles?.profiles?.display_name ?? "Musician",
      amountCents: musicianPayout,
    },
  ];

  for (const recipient of recipients) {
    if (!recipient.profileId || !recipient.email) continue;
    const message = paymentCapturedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      requestTitle,
      serviceDate: booking.service_date,
      amountCents: recipient.amountCents,
      actionUrl: threadUrl,
      recipientRole: recipient.role,
    });
    await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${payment.id}:${recipient.role}:${recipient.profileId}`,
      recipientProfileId: recipient.profileId,
      message,
      template: templateId ? {
        templateId,
        variables: {
          RECIPIENT_NAME: recipient.name,
          REQUEST_TITLE: requestTitle,
          SERVICE_DATE: booking.service_date,
          AMOUNT: `$${(recipient.amountCents / 100).toFixed(2)}`,
          ACTION_URL: threadUrl,
        },
      } : undefined,
      payload: {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        recipient_role: recipient.role,
        thread_id: booking.thread_id,
      },
    });
  }
}
