import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CardOnFile } from "../CardOnFile";

// Church's billing hub. Hosts CardOnFile + an inline expiring-card warning
// and points to Stripe for receipts (auto-emailed on every charge).

function isCardExpiring(month: number | null, year: number | null): boolean {
  if (!month || !year) return false;
  const now = new Date();
  const expiry = new Date(year, month, 1); // first day after the expiry month
  const days = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 30;
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "church") redirect("/profile");

  const { data: cp } = await supabase
    .from("church_profiles").select("id").eq("profile_id", user.id).single();
  const { data: stripeCustomer } = cp
    ? await supabase
        .from("stripe_customers")
        .select("card_brand, card_last4, card_exp_month, card_exp_year, default_payment_method")
        .eq("church_profile_id", cp.id)
        .maybeSingle()
    : { data: null };

  const expiring = isCardExpiring(stripeCustomer?.card_exp_month ?? null, stripeCustomer?.card_exp_year ?? null);

  return (
    <>
      {expiring && (
        <div style={{
          padding: "12px 16px",
          border: "1px solid rgba(184,33,5,0.3)",
          background: "rgba(184,33,5,0.06)",
          borderRadius: "var(--sm-radius-sm)",
          color: "var(--sm-status-error, #b82105)",
          fontSize: 13.5,
          marginBottom: 16,
          lineHeight: 1.5,
        }}>
          Your card expires {String(stripeCustomer!.card_exp_month).padStart(2, "0")}/{String(stripeCustomer!.card_exp_year).slice(-2)}.
          Replace it below to keep upcoming bookings from failing.
        </div>
      )}

      <CardOnFile initial={
        stripeCustomer && stripeCustomer.default_payment_method
          ? {
              card_brand: stripeCustomer.card_brand,
              card_last4: stripeCustomer.card_last4,
              card_exp_month: stripeCustomer.card_exp_month,
              card_exp_year: stripeCustomer.card_exp_year,
            }
          : null
      } />

      <section style={{
        padding: 20,
        border: "1px solid var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)",
        background: "var(--sm-bg-1)",
        marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Receipts</h3>
        <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: 0, lineHeight: 1.5 }}>
          Stripe emails a receipt to your billing email every time a card is charged.
          Need an old one? It&apos;s in the email Stripe sent — search your inbox for
          <em> Sunday Musician</em>.
        </p>
      </section>

      <section style={{
        padding: 20,
        border: "1px dashed var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)",
        background: "var(--sm-bg-2)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>How charges work</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--sm-fg-3)", lineHeight: 1.6 }}>
          <li>You save a card when you set up your account — no charge at that time.</li>
          <li>When a musician accepts your proposal, the booking is queued — still no charge.</li>
          <li>On the morning of the service date, the card is charged for the agreed fee plus our platform fee and processing.</li>
          <li>Either side can cancel before the service date and the card won&apos;t be charged.</li>
        </ul>
      </section>
    </>
  );
}
