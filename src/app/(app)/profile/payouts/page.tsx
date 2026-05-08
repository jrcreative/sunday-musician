import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshStripeAccountStatus } from "@/lib/stripe/refresh-account";
import { PayoutSettings } from "../PayoutSettings";

// Musician's payouts hub. Hosts the Connect onboarding/dashboard controls
// and points users to Stripe-hosted artifacts (1099-K, payout history,
// receipts) instead of trying to render those ourselves — Stripe Express
// is the source of truth and updates with no work from us.

export default async function PayoutsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "musician") redirect("/profile");

  const { data: mp } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", user.id).single();

  const admin = createAdminClient();
  const { data: stripeAcctRow } = mp
    ? await admin
        .from("stripe_accounts")
        .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
        .eq("musician_profile_id", mp.id)
        .maybeSingle()
    : { data: null };

  let stripeAcct = stripeAcctRow ? {
    charges_enabled: stripeAcctRow.charges_enabled,
    payouts_enabled: stripeAcctRow.payouts_enabled,
    details_submitted: stripeAcctRow.details_submitted,
  } : null;
  if (mp && stripeAcctRow && !stripeAcctRow.charges_enabled) {
    stripeAcct = await refreshStripeAccountStatus(mp.id, stripeAcctRow.stripe_account_id, stripeAcct!);
  }

  const isReady = !!(stripeAcct?.charges_enabled && stripeAcct.payouts_enabled && stripeAcct.details_submitted);

  return (
    <>
      <PayoutSettings initial={stripeAcct} />

      {isReady && (
        <section style={{
          padding: 20,
          border: "1px solid var(--sm-border-subtle)",
          borderRadius: "var(--sm-radius-sm)",
          background: "var(--sm-bg-1)",
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Tax forms & receipts</h3>
          <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Stripe issues your <strong>1099-K</strong> automatically once you cross the IRS reporting
            threshold. Find it — along with payout history and downloadable receipts — in your Stripe
            Express dashboard.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--sm-fg-4)", margin: 0, lineHeight: 1.5 }}>
            Click <em>Open Stripe dashboard</em> above. From there: <strong>Tax forms</strong> for 1099s,
            <strong> Payouts</strong> for arrival times and history.
          </p>
        </section>
      )}

      <section style={{
        padding: 20,
        border: "1px dashed var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)",
        background: "var(--sm-bg-2)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>How payouts work</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--sm-fg-3)", lineHeight: 1.6 }}>
          <li>Churches save a card when they accept your terms — the card isn&apos;t charged at booking.</li>
          <li>On the morning of the service date, the card is charged and the funds route to your bank.</li>
          <li>Stripe&apos;s standard payout schedule applies (typically 2 business days for first payout, daily after).</li>
          <li>You keep the full agreed fee. Churches cover the platform fee and processing.</li>
        </ul>
      </section>
    </>
  );
}
