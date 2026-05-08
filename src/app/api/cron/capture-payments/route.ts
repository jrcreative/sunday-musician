import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, booking_id, application_fee_amount, charge_total, stripe_customer_id, stripe_destination_id, stripe_payment_method_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", today);
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
    }
  }

  return NextResponse.json(summary);
}
