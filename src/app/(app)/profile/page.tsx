import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import { MusicianProfileForm } from "./MusicianProfileForm";
import { ChurchProfileForm } from "./ChurchProfileForm";
import { PayoutSettings } from "./PayoutSettings";
import { CardOnFile } from "./CardOnFile";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshStripeAccountStatus } from "@/lib/stripe/refresh-account";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");

  if (profile.role === "musician") {
    const { data: mp } = await supabase
      .from("musician_profiles").select("*").eq("profile_id", user.id).single();
    // Read the local snapshot via the user's session (RLS); fall back to
    // service-role so we always have the stripe_account_id for the refresh
    // call below even if RLS surprises us.
    const admin = createAdminClient();
    const { data: stripeAcctRow } = mp
      ? await admin
          .from("stripe_accounts")
          .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
          .eq("musician_profile_id", mp.id)
          .maybeSingle()
      : { data: null };

    // If the snapshot says onboarding is incomplete, refresh from Stripe.
    // The account.updated webhook is the canonical source — this path
    // self-heals when the webhook isn't configured or hasn't fired yet
    // (typical right after the user returns from hosted onboarding).
    let stripeAcct = stripeAcctRow
      ? {
          charges_enabled: stripeAcctRow.charges_enabled,
          payouts_enabled: stripeAcctRow.payouts_enabled,
          details_submitted: stripeAcctRow.details_submitted,
        }
      : null;
    if (mp && stripeAcctRow && !stripeAcctRow.charges_enabled) {
      stripeAcct = await refreshStripeAccountStatus(
        mp.id,
        stripeAcctRow.stripe_account_id,
        stripeAcct!,
      );
    }

    return (
      <>
        <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
        <div className="page page--narrow">
          <PayoutSettings initial={stripeAcct} />
        </div>
        <MusicianProfileForm profile={profile} musicianProfile={mp} />
      </>
    );
  }

  const { data: cp } = await supabase
    .from("church_profiles").select("*").eq("profile_id", user.id).single();
  const { data: stripeCustomer } = cp
    ? await supabase
        .from("stripe_customers")
        .select("card_brand, card_last4, card_exp_month, card_exp_year, default_payment_method")
        .eq("church_profile_id", cp.id)
        .maybeSingle()
    : { data: null };
  return (
    <>
      <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
      <div className="page page--narrow">
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
      </div>
      <ChurchProfileForm profile={profile} churchProfile={cp} />
    </>
  );
}
