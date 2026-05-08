import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import { MusicianProfileForm } from "./MusicianProfileForm";
import { ChurchProfileForm } from "./ChurchProfileForm";
import { PayoutSettings } from "./PayoutSettings";
import { CardOnFile } from "./CardOnFile";

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
    const { data: stripeAcct } = mp
      ? await supabase
          .from("stripe_accounts")
          .select("charges_enabled, payouts_enabled, details_submitted")
          .eq("musician_profile_id", mp.id)
          .maybeSingle()
      : { data: null };
    return (
      <>
        <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
        <div className="page page--narrow">
          <PayoutSettings initial={stripeAcct ?? null} />
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
