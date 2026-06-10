import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("fee math guarantees the musician's full quote and the platform's net", () => {
  const fees = read("src/lib/stripe/fees.ts");

  assert.match(fees, /PLATFORM_FEE_CENTS = 500/, "platform net must stay documented as a named constant");
  assert.match(fees, /Math\.ceil\(numerator \/ \(1 - STRIPE_PCT\)\)/, "charge total must gross up so Stripe's cut never eats the musician's fee");
  assert.match(fees, /!Number\.isInteger\(musicianAmountCents\) \|\| musicianAmountCents < 0/, "computeFees must reject fractional or negative cent amounts");
  assert.match(fees, /chargeTotal - musicianAmount/, "application fee must be derived so the destination account receives the exact quote");

  const accept = read("src/app/api/proposals/accept/route.ts");
  assert.match(accept, /computeFees\(/, "proposal acceptance must use the shared fee helper, never inline math");
});

test("payment capture cron cannot double-charge", () => {
  const source = read("src/app/api/cron/capture-payments/route.ts");

  assert.match(source, /\.update\(\{ status: "capturing"[\s\S]{0,120}\.eq\("status", "scheduled"\)/, "rows must be atomically claimed before charging");
  assert.match(source, /if \(!claimed\) continue/, "a row claimed by another worker must be skipped");
  assert.match(source, /idempotencyKey: `pmt-\$\{pmt\.id\}`/, "PaymentIntent creation must carry a per-payment idempotency key");
  assert.match(source, /off_session: true/, "capture must run off-session against the saved card");
  assert.match(source, /confirm: true/, "capture must confirm in the same call so status is known synchronously");
  assert.match(source, /transfer_data: \{ destination: pmt\.stripe_destination_id \}/, "funds must route to the musician's connected account");
  assert.match(source, /application_fee_amount: pmt\.application_fee_amount/, "the platform fee must ride on the PaymentIntent");
  assert.match(source, /failure_message: msg\.slice\(0, 500\)/, "capture failures must be recorded for the admin dashboard");
  assert.match(source, /sendPaymentFailedEmails/, "capture failures must notify church, musician, and admins");
});

test("stripe webhook verifies signatures and cannot clobber terminal payment states", () => {
  const source = read("src/app/api/stripe/webhook/route.ts");

  assert.match(source, /constructEvent\(raw, sig, secret\)/, "webhook must verify the Stripe signature before trusting the payload");
  assert.match(source, /await req\.text\(\)/, "signature verification needs the raw request body, not parsed JSON");
  assert.match(source, /process\.env\.STRIPE_WEBHOOK_SECRET/, "webhook must refuse to run without the signing secret");
  assert.match(source, /runtime = "nodejs"/, "signature verification requires the Node runtime");

  const guards = source.match(/\.in\("status", \["scheduled", "capturing"\]\)/g) ?? [];
  assert.ok(guards.length >= 2, "succeeded and failed handlers must both guard on non-terminal status so redeliveries stay idempotent");
});
