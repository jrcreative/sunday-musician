import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentCapturedEmails } from "@/lib/email/events/payment-captured";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook receiver. The endpoint in Stripe is configured to send:
//   - account.updated                 (Connect onboarding progress)
//   - account.application.deauthorized
//
// Handlers for payment_intent.succeeded / payment_failed and
// payment_method.detached are kept as defense in depth — the capture cron
// confirms synchronously, but if those events are ever registered the
// handlers reconcile state and (on success) send the captured emails.
//
// All handlers are idempotent — Stripe may redeliver.

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      await admin
        .from("stripe_accounts")
        .update({
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          requirements_due: (acct.requirements?.currently_due ?? []) as string[],
        })
        .eq("stripe_account_id", acct.id);
      break;
    }
    case "account.application.deauthorized": {
      const acct = event.account;
      if (acct) {
        await admin
          .from("stripe_accounts")
          .update({ charges_enabled: false, payouts_enabled: false })
          .eq("stripe_account_id", acct);
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = pi.metadata?.payment_id;
      if (paymentId) {
        const { data: updated } = await admin
          .from("payments")
          .update({
            status: "captured",
            stripe_payment_intent_id: pi.id,
            stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
            captured_at: new Date().toISOString(),
          })
          .eq("id", paymentId)
          .in("status", ["scheduled", "capturing"])
          .select("id");
        // Only email when this event actually transitioned the row; the
        // dedupe key also guards against double-sends if the cron got there first.
        if (updated && updated.length > 0) {
          await sendPaymentCapturedEmails(admin, paymentId);
        }
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = pi.metadata?.payment_id;
      const errMsg = pi.last_payment_error?.message ?? "Payment failed";
      if (paymentId) {
        await admin
          .from("payments")
          .update({
            status: "failed",
            stripe_payment_intent_id: pi.id,
            failed_at: new Date().toISOString(),
            failure_message: errMsg.slice(0, 500),
          })
          .eq("id", paymentId)
          .in("status", ["scheduled", "capturing"]);
      }
      break;
    }
    case "payment_method.detached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      await admin
        .from("stripe_customers")
        .update({
          default_payment_method: null,
          card_brand: null,
          card_last4: null,
          card_exp_month: null,
          card_exp_year: null,
        })
        .eq("default_payment_method", pm.id);
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
