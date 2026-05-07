import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import { MusicianProfileForm } from "./MusicianProfileForm";
import { ChurchProfileForm } from "./ChurchProfileForm";

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
    return (
      <>
        <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
        <MusicianProfileForm profile={profile} musicianProfile={mp} />
      </>
    );
  }

  const { data: cp } = await supabase
    .from("church_profiles").select("*").eq("profile_id", user.id).single();
  return (
    <>
      <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
      <ChurchProfileForm profile={profile} churchProfile={cp} />
    </>
  );
}
