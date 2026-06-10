import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { sendPaymentCapturedEmails } from "@/lib/email/events/payment-captured";
import { paymentFailedEmail } from "@/lib/email/templates/marketplace";
import { stripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Daily sweep: for every payment whose booking is today (or earlier and still
// scheduled, in case of a missed run), create + confirm a PaymentIntent
// off-session and record the result.
//
// Idempotency: the moment we begin processing a row we flip it to
// 'capturing'. A duplicate run can't re-pick up rows in 'capturing'. If a
// PaymentIntent succeeds we mark 'captured'; on failure 'failed' with the
// error message recorded.

type DuePaymentRow = {
  id: string;
  booking_id: string;
  application_fee_amount: number;
  charge_total: number;
  stripe_customer_id: string;
  stripe_destination_id: string;
  stripe_payment_method_id: string;
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

type AdminProfile = {
  id: string;
  email: string;
  display_name: string;
};

type PaymentFailureRecipient = {
  role: "church" | "musician" | "admin";
  profileId: string | null;
  email: string | null;
  name: string;
  actionUrl: string;
};

async function sendPaymentFailedEmails(input: {
  admin: ReturnType<typeof createAdminClient>;
  payment: DuePaymentRow;
  errorMessage: string;
}) {
  const booking = input.payment.bookings;
  if (!booking) return;

  const event = EMAIL_EVENTS.paymentFailed;
  const templateId = configuredTemplateId(event);
  const requestTitle = booking.service_requests?.title ?? "Booking";
  const errorMessage = input.errorMessage || "Payment capture failed.";
  const recipients: PaymentFailureRecipient[] = [
    {
      role: "church" as const,
      profileId: booking.church_profiles?.profile_id ?? null,
      email: booking.church_profiles?.profiles?.email ?? null,
      name: booking.church_profiles?.profiles?.display_name ?? booking.church_profiles?.church_name ?? "Church",
      actionUrl: appUrl("/profile/billing"),
    },
    {
      role: "musician" as const,
      profileId: booking.musician_profiles?.profile_id ?? null,
      email: booking.musician_profiles?.profiles?.email ?? null,
      name: booking.musician_profiles?.profiles?.display_name ?? "Musician",
      actionUrl: appUrl(`/messages/${booking.thread_id}`),
    },
  ];

  const { data: admins } = await input.admin
    .from("profiles")
    .select("id, email, display_name")
    .eq("is_admin", true)
    .is("deleted_at", null)
    .is("suspended_at", null) as unknown as { data: AdminProfile[] | null };

  for (const adminProfile of admins ?? []) {
    recipients.push({
      role: "admin",
      profileId: adminProfile.id,
      email: adminProfile.email,
      name: adminProfile.display_name,
      actionUrl: appUrl("/admin/payments?status=failed"),
    });
  }

  for (const recipient of recipients) {
    if (!recipient.profileId || !recipient.email) continue;
    const message = paymentFailedEmail({
      to: recipient.email,
      recipientName: recipient.name,
      requestTitle,
      serviceDate: booking.service_date,
      amountCents: input.payment.charge_total,
      errorMessage,
      actionUrl: recipient.actionUrl,
      recipientRole: recipient.role,
    });
    await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${input.payment.id}:${recipient.role}:${recipient.profileId}`,
      recipientProfileId: recipient.profileId,
      message,
      template: templateId ? {
        templateId,
        variables: {
          RECIPIENT_NAME: recipient.name,
          REQUEST_TITLE: requestTitle,
          SERVICE_DATE: booking.service_date,
          AMOUNT: `$${(input.payment.charge_total / 100).toFixed(2)}`,
          ERROR_MESSAGE: errorMessage,
          ACTION_URL: recipient.actionUrl,
        },
      } : undefined,
      payload: {
        payment_id: input.payment.id,
        booking_id: input.payment.booking_id,
        recipient_role: recipient.role,
        thread_id: booking.thread_id,
      },
    });
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: selErr } = await admin
    .from("payments")
    .select(`
      id, booking_id, application_fee_amount, charge_total,
      stripe_customer_id, stripe_destination_id, stripe_payment_method_id,
      bookings (
        thread_id, service_date,
        service_requests ( title ),
        church_profiles ( church_name, profile_id, profiles ( email, display_name ) ),
        musician_profiles ( profile_id, profiles ( email, display_name ) )
      )
    `)
    .eq("status", "scheduled")
    .lte("scheduled_for", today) as unknown as { data: DuePaymentRow[] | null; error: { message: string } | null };
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const summary = { processed: 0, captured: 0, failed: 0, errors: 0 };

  for (const pmt of due ?? []) {
    summary.processed += 1;

    // Atomically claim the row so a concurrent run can't double-charge.
    const { data: claimed } = await admin
      .from("payments")
      .update({ status: "capturing", attempted_at: new Date().toISOString() })
      .eq("id", pmt.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another worker took it

    try {
      const intent = await stripe().paymentIntents.create({
        amount: pmt.charge_total,
        currency: "usd",
        customer: pmt.stripe_customer_id,
        payment_method: pmt.stripe_payment_method_id,
        application_fee_amount: pmt.application_fee_amount,
        transfer_data: { destination: pmt.stripe_destination_id },
        confirm: true,
        off_session: true,
        metadata: {
          payment_id: pmt.id,
          booking_id: pmt.booking_id,
        },
      }, { idempotencyKey: `pmt-${pmt.id}` });

      if (intent.status === "succeeded") {
        await admin
          .from("payments")
          .update({
            status: "captured",
            stripe_payment_intent_id: intent.id,
            stripe_charge_id: typeof intent.latest_charge === "string" ? intent.latest_charge : null,
            captured_at: new Date().toISOString(),
          })
          .eq("id", pmt.id);
        summary.captured += 1;
        await sendPaymentCapturedEmails(admin, pmt.id);
      } else {
        await admin
          .from("payments")
          .update({
            status: "failed",
            stripe_payment_intent_id: intent.id,
            failed_at: new Date().toISOString(),
            failure_message: `Unexpected PaymentIntent status: ${intent.status}`,
          })
          .eq("id", pmt.id);
        summary.failed += 1;
        await sendPaymentFailedEmails({
          admin,
          payment: pmt,
          errorMessage: `Unexpected PaymentIntent status: ${intent.status}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await admin
        .from("payments")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          failure_message: msg.slice(0, 500),
        })
        .eq("id", pmt.id);
      summary.errors += 1;
      await sendPaymentFailedEmails({ admin, payment: pmt, errorMessage: msg.slice(0, 500) });
    }
  }

  return NextResponse.json(summary);
}
