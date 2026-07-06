import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MusicianProfileForm } from "./MusicianProfileForm";
import { ChurchProfileForm } from "./ChurchProfileForm";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { churchCompleteness, musicianCompleteness } from "./completeness";

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

    const { data: stripeAccount } = mp
      ? await supabase
          .from("stripe_accounts")
          .select("charges_enabled, payouts_enabled, details_submitted")
          .eq("musician_profile_id", mp.id)
          .maybeSingle()
      : { data: null };
    const paymentReady = !!stripeAccount?.charges_enabled && !!stripeAccount?.payouts_enabled && !!stripeAccount?.details_submitted;

    const { data: blocks } = mp
      ? await supabase
          .from("unavailability_blocks")
          .select("id")
          .eq("musician_profile_id", mp.id)
          .limit(1)
      : { data: [] as { id: string }[] };

    const { percent, missing, requiredMissing } = musicianCompleteness(mp, paymentReady, (blocks?.length ?? 0) > 0);
    return (
      <>
        <ProfileCompleteness
          percent={percent}
          missing={missing}
          requiredMissing={requiredMissing}
          previewHref={mp ? `/musicians/${mp.id}` : null}
          previewLabel="View as a church sees me"
        />
        <MusicianProfileForm profile={profile} musicianProfile={mp} />
      </>
    );
  }

  const { data: cp } = await supabase
    .from("church_profiles").select("*").eq("profile_id", user.id).single();
  const { percent, missing, requiredMissing } = churchCompleteness(cp);
  return (
    <>
      <ProfileCompleteness
        percent={percent}
        missing={missing}
        requiredMissing={requiredMissing}
        previewHref={null}
        previewLabel="View public profile"
      />
      <ChurchProfileForm profile={profile} churchProfile={cp} />
    </>
  );
}
