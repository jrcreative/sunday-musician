// Read-only Stripe ↔ app health check. Verifies the configured keys talk to
// the Stripe sandbox you expect, that the objects our database references
// actually exist there, and explains where every payment row currently sits
// in its lifecycle.
//
//   npm run stripe:check
//
// Safe to run anytime — makes no writes to Stripe or the database.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch { /* env already in shell */ }

let failures = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const warn = (msg: string) => console.log(`  ⚠ ${msg}`);
const fail = (msg: string) => { failures += 1; console.log(`  ✗ ${msg}`); };
const section = (title: string) => console.log(`\n── ${title}`);

function keyMode(key: string | undefined) {
  if (!key) return "missing";
  if (key.includes("_live_")) return "live";
  if (key.includes("_test_")) return "test";
  return "unknown";
}

async function main() {
  // ── 1. Environment ────────────────────────────────────────────────────────
  section("Environment");
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const required = [
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ];
  for (const name of required) {
    if (process.env[name]?.trim()) ok(`${name} is set`);
    else fail(`${name} is missing`);
  }
  const secretMode = keyMode(secretKey);
  const pubMode = keyMode(pubKey);
  if (secretMode === "test") ok("secret key is a test/sandbox key");
  else if (secretMode === "live") warn("secret key is a LIVE key — this script will only read, but be careful");
  else fail(`secret key mode unrecognized (${secretMode})`);
  if (secretMode !== "missing" && pubMode !== "missing" && secretMode !== pubMode) {
    fail(`secret key is ${secretMode} but publishable key is ${pubMode} — the browser and server are talking to different Stripe modes`);
  } else if (pubMode !== "missing") {
    ok(`publishable key mode matches (${pubMode})`);
  }
  if (!secretKey || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("\nCannot continue without Stripe + Supabase credentials.");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── 2. Stripe API connectivity ───────────────────────────────────────────
  section("Stripe API");
  try {
    const balance = await stripe.balance.retrieve();
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0);
    ok(`API reachable — platform balance: $${(available / 100).toFixed(2)} available, $${(pending / 100).toFixed(2)} pending (livemode=${balance.livemode})`);
  } catch (e) {
    fail(`cannot reach Stripe with this secret key: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  // ── 3. What this sandbox has seen ────────────────────────────────────────
  section("Stripe activity (this sandbox)");
  const [customers, paymentIntents, setupIntents, connected, webhooks] = await Promise.all([
    stripe.customers.list({ limit: 100 }),
    stripe.paymentIntents.list({ limit: 100 }),
    stripe.setupIntents.list({ limit: 100 }),
    stripe.accounts.list({ limit: 100 }),
    stripe.webhookEndpoints.list({ limit: 10 }),
  ]);
  const plus = (list: { data: unknown[]; has_more: boolean }) => `${list.data.length}${list.has_more ? "+" : ""}`;
  console.log(`  customers:          ${plus(customers)}`);
  console.log(`  payment intents:    ${plus(paymentIntents)}`);
  console.log(`  setup intents:      ${plus(setupIntents)}`);
  console.log(`  connected accounts: ${plus(connected)}`);
  for (const pi of paymentIntents.data.slice(0, 5)) {
    console.log(`    PI ${pi.id} — ${pi.status} — $${(pi.amount / 100).toFixed(2)} — ${new Date(pi.created * 1000).toISOString().slice(0, 10)}`);
  }
  if (webhooks.data.length === 0) {
    warn("no webhook endpoints registered in this sandbox");
  }
  for (const wh of webhooks.data) {
    console.log(`  webhook: ${wh.url} (${wh.status}) → ${wh.enabled_events.join(", ")}`);
  }

  // ── 4. What our database thinks exists ───────────────────────────────────
  section("Database");
  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("id, status, scheduled_for, charge_total, stripe_payment_intent_id, stripe_customer_id, stripe_destination_id, failure_message")
    .order("scheduled_for", { ascending: true });
  if (payErr) fail(`cannot read payments table: ${payErr.message}`);
  const { data: dbCustomers } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id, default_payment_method, card_last4");
  const { data: dbAccounts } = await supabase
    .from("stripe_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled");

  const byStatus = new Map<string, number>();
  for (const p of payments ?? []) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  console.log(`  payments: ${payments?.length ?? 0} total — ${[...byStatus].map(([s, n]) => `${n} ${s}`).join(", ") || "none"}`);
  const today = new Date().toISOString().slice(0, 10);
  for (const p of payments ?? []) {
    const dueLabel = p.status === "scheduled"
      ? (p.scheduled_for <= today ? "DUE NOW — next capture-payments cron run will charge it" : `will charge on ${p.scheduled_for} (service date)`)
      : p.status === "failed" ? `failed: ${p.failure_message}` : p.status;
    console.log(`    ${p.id.slice(0, 8)}… $${(p.charge_total / 100).toFixed(2)} [${p.status}] ${dueLabel}`);
  }
  console.log(`  saved cards (stripe_customers): ${dbCustomers?.length ?? 0} (${(dbCustomers ?? []).filter(c => c.default_payment_method).length} with a default card)`);
  console.log(`  connect accounts (stripe_accounts): ${dbAccounts?.length ?? 0} (${(dbAccounts ?? []).filter(a => a.charges_enabled).length} charges_enabled)`);

  // ── 5. Cross-check: do the DB's Stripe IDs exist in THIS sandbox? ────────
  // If these fail with resource_missing, the rows were created while the app
  // pointed at different Stripe keys (e.g. another sandbox).
  section("Cross-check (DB ↔ Stripe)");
  let missing = 0;
  for (const c of (dbCustomers ?? []).slice(0, 10)) {
    try {
      const cust = await stripe.customers.retrieve(c.stripe_customer_id);
      if ("deleted" in cust && cust.deleted) { warn(`customer ${c.stripe_customer_id} was deleted in Stripe`); missing += 1; }
      else ok(`customer ${c.stripe_customer_id} exists`);
    } catch {
      fail(`customer ${c.stripe_customer_id} NOT FOUND in this sandbox`);
      missing += 1;
    }
  }
  for (const a of (dbAccounts ?? []).slice(0, 10)) {
    try {
      const acct = await stripe.accounts.retrieve(a.stripe_account_id);
      ok(`connect account ${a.stripe_account_id} exists (charges_enabled=${acct.charges_enabled})`);
      if (!!acct.charges_enabled !== !!a.charges_enabled) {
        warn(`  …but DB says charges_enabled=${a.charges_enabled} — webhook account.updated may not be flowing`);
      }
    } catch {
      fail(`connect account ${a.stripe_account_id} NOT FOUND in this sandbox`);
      missing += 1;
    }
  }
  if (missing > 0) {
    console.log("\n  ⚠ Database rows reference Stripe objects that don't exist under these keys.");
    console.log("    The app was likely pointed at a different sandbox when those rows were created.");
  }

  // ── Verdict ───────────────────────────────────────────────────────────────
  section("Summary");
  const scheduled = (payments ?? []).filter(p => p.status === "scheduled");
  const captured = (payments ?? []).filter(p => p.status === "captured");
  if (captured.length === 0 && scheduled.length > 0) {
    console.log("  No PaymentIntents in Stripe yet is EXPECTED: accepting a proposal only");
    console.log("  schedules the payment in our database. Stripe is first contacted when the");
    console.log("  capture-payments cron runs on the service date (13:00 UTC daily).");
    console.log("  To exercise a charge now: npm run stripe:test-payment");
  }
  console.log(failures === 0 ? "\n✓ All checks passed." : `\n✗ ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
