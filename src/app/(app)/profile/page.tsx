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
    const { percent, missing } = musicianCompleteness(mp);
    return (
      <>
        <ProfileCompleteness
          percent={percent}
          missing={missing}
          previewHref={mp ? `/musicians/${mp.id}` : null}
          previewLabel="View as a church sees me"
        />
        <MusicianProfileForm profile={profile} musicianProfile={mp} />
      </>
    );
  }

  const { data: cp } = await supabase
    .from("church_profiles").select("*").eq("profile_id", user.id).single();
  const { percent, missing } = churchCompleteness(cp);
  return (
    <>
      <ProfileCompleteness
        percent={percent}
        missing={missing}
        previewHref={null}
        previewLabel="View public profile"
      />
      <ChurchProfileForm profile={profile} churchProfile={cp} />
    </>
  );
}
