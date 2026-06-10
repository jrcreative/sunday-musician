// End-to-end payment exercise tools for the Stripe SANDBOX. Refuses to run
// against live keys.
//
//   npm run stripe:test-payment
//     Synthetic round trip: creates a throwaway test customer with the
//     pm_card_visa test card, charges a grossed-up destination charge to a
//     real connected account (the first charges_enabled one in the DB), and
//     verifies the money split — exactly the call the capture cron makes.
//     Cleans up the customer afterwards. Proves keys + Connect + fee math.
//
//   npm run stripe:test-payment -- --destination acct_123
//     Same, but against a specific connected account.
//
//   npm run stripe:test-payment -- --capture-due [--url https://your-app.com]
//     Triggers the REAL capture-payments cron over HTTP with CRON_SECRET, so
//     any payment rows whose scheduled_for is today or earlier get charged
//     through the production code path (including the captured emails).
//     Defaults to SITE_URL; pass --url http://localhost:3000 for a dev server.
//
//   npm run stripe:test-payment -- --make-due <paymentId>
//     Pulls a scheduled payment's scheduled_for to today, then runs
//     --capture-due. Lets you test a real booking's payment without waiting
//     for its service date.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { computeFees } from "../src/lib/stripe/fees";

try { process.loadEnvFile(".env.local"); } catch { /* env already in shell */ }

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : (args[i + 1]?.startsWith("--") ? "true" : args[i + 1] ?? "true");
};

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
if (!secretKey) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1); }
// Hard stop: these tools create real charges. Sandbox only.
if (secretKey.includes("_live_")) {
  console.error("✗ Refusing to run: STRIPE_SECRET_KEY is a LIVE key. These tools are sandbox-only.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

async function captureDue() {
  const base = (flag("url") ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) { console.error("CRON_SECRET not set"); process.exit(1); }

  console.log(`→ GET ${base}/api/cron/capture-payments`);
  const res = await fetch(`${base}/api/cron/capture-payments`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`← ${res.status}`, body);
  if (!res.ok) process.exit(1);

  // Show where every recent payment row landed.
  const { data: payments } = await supabase
    .from("payments")
    .select("id, status, scheduled_for, charge_total, stripe_payment_intent_id, failure_message")
    .order("scheduled_for", { ascending: false })
    .limit(10);
  for (const p of payments ?? []) {
    console.log(`  ${p.id.slice(0, 8)}… $${(p.charge_total / 100).toFixed(2)} [${p.status}]${p.stripe_payment_intent_id ? ` ${p.stripe_payment_intent_id}` : ""}${p.failure_message ? ` — ${p.failure_message}` : ""}`);
  }
}

async function makeDue(paymentId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("payments")
    .update({ scheduled_for: today })
    .eq("id", paymentId)
    .eq("status", "scheduled")
    .select("id, scheduled_for")
    .maybeSingle();
  if (error) { console.error(`✗ ${error.message}`); process.exit(1); }
  if (!data) { console.error(`✗ No payment ${paymentId} in 'scheduled' status.`); process.exit(1); }
  console.log(`✓ Payment ${paymentId} is now due today (${today}). Running capture…`);
  await captureDue();
}

async function syntheticCharge() {
  // Pick a destination: flag, else the first charges-enabled musician account.
  let destination = flag("destination");
  if (!destination) {
    const { data } = await supabase
      .from("stripe_accounts")
      .select("stripe_account_id")
      .eq("charges_enabled", true)
      .limit(1)
      .maybeSingle();
    destination = data?.stripe_account_id;
  }
  if (!destination) {
    console.error("✗ No charges_enabled connected account found. Complete musician Stripe onboarding first, or pass --destination acct_…");
    process.exit(1);
  }
  const acct = await stripe.accounts.retrieve(destination);
  if (!acct.charges_enabled) {
    console.error(`✗ ${destination} exists but charges_enabled=false — finish its onboarding in the Stripe sandbox.`);
    process.exit(1);
  }
  console.log(`→ destination: ${destination} (charges_enabled)`);

  // Throwaway church stand-in with Stripe's always-succeeds test Visa.
  const customer = await stripe.customers.create({
    description: "sunday-musician test harness (safe to delete)",
    metadata: { test_harness: "true" },
  });
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  console.log(`→ test customer ${customer.id} with card ${pm.card?.brand} •••• ${pm.card?.last4}`);

  // $100 quote through the real fee math — same numbers a real booking gets.
  const fees = computeFees(100_00);
  console.log(`→ fee breakdown: musician $${(fees.musicianAmount / 100).toFixed(2)}, platform $${(fees.platformNet / 100).toFixed(2)}, stripe ~$${(fees.stripeFee / 100).toFixed(2)}, church pays $${(fees.chargeTotal / 100).toFixed(2)}`);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: fees.chargeTotal,
      currency: "usd",
      customer: customer.id,
      payment_method: pm.id,
      application_fee_amount: fees.applicationFeeAmount,
      transfer_data: { destination },
      confirm: true,
      off_session: true,
      metadata: { test_harness: "true" },
    });
    if (intent.status !== "succeeded") {
      console.error(`✗ PaymentIntent ${intent.id} ended in status '${intent.status}'`);
      process.exit(1);
    }
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    console.log(`✓ PaymentIntent ${intent.id} succeeded (charge ${chargeId})`);

    const charge = await stripe.charges.retrieve(chargeId!);
    const musicianGets = charge.amount - (charge.application_fee_amount ?? 0);
    console.log(`✓ charged $${(charge.amount / 100).toFixed(2)} — musician account receives $${(musicianGets / 100).toFixed(2)}, application fee $${((charge.application_fee_amount ?? 0) / 100).toFixed(2)}`);
    if (musicianGets !== fees.musicianAmount) {
      console.error(`✗ musician share mismatch: expected $${(fees.musicianAmount / 100).toFixed(2)}`);
      process.exit(1);
    }
    console.log("✓ Musician receives their exact quote. End-to-end payment path works.");
    console.log(`  View it: https://dashboard.stripe.com/test/payments/${intent.id}`);
  } finally {
    await stripe.customers.del(customer.id);
    console.log(`→ cleaned up test customer ${customer.id}`);
  }
}

async function main() {
  if (flag("make-due")) return makeDue(flag("make-due")!);
  if (flag("capture-due")) return captureDue();
  return syntheticCharge();
}

main().catch(e => { console.error(e); process.exit(1); });
