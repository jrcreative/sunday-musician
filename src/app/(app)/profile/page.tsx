import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MusicianProfileForm } from "./MusicianProfileForm";
import { ChurchProfileForm } from "./ChurchProfileForm";
import { ProfileCompleteness } from "./ProfileCompleteness";

// Compute a 0–100 completeness score from the fields the public-facing
// profile uses. Returns the labels for any missing required fields so the
// meter can tell the user what's left.
function musicianCompleteness(mp: {
  bio: string;
  city: string;
  state: string;
  primary_instrument: string;
  instruments: string[];
  fee_min: number;
  fee_max: number;
  is_volunteer: boolean;
  travel_radius_miles: number;
  youtube_links: string[];
  denomination_tags: string[];
} | null) {
  if (!mp) return { percent: 0, missing: ["complete profile"] };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "city / state", ok: !!mp.city && !!mp.state },
    { label: "primary instrument", ok: !!mp.primary_instrument },
    { label: "instruments list", ok: mp.instruments.length > 0 },
    { label: "bio (40+ chars)", ok: mp.bio.trim().length >= 40 },
    { label: "fee range", ok: mp.is_volunteer || (mp.fee_min > 0 && mp.fee_max > 0) },
    { label: "travel radius", ok: mp.travel_radius_miles > 0 },
    { label: "denomination tags", ok: mp.denomination_tags.length > 0 },
    { label: "a video link", ok: mp.youtube_links.some(u => u.trim().length > 0) },
  ];
  const ok = checks.filter(c => c.ok).length;
  return {
    percent: Math.round((ok / checks.length) * 100),
    missing: checks.filter(c => !c.ok).map(c => c.label),
  };
}

function churchCompleteness(cp: {
  church_name: string;
  city: string;
  state: string;
  capacity: number | null;
  service_count: number | null;
  musical_style: string | null;
  denomination: string | null;
  worship_theology: string | null;
  music_value: string | null;
  contact_name: string | null;
} | null) {
  if (!cp) return { percent: 0, missing: ["complete profile"] };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "church name", ok: !!cp.church_name },
    { label: "city / state", ok: !!cp.city && !!cp.state },
    { label: "contact person", ok: !!cp.contact_name },
    { label: "denomination", ok: !!cp.denomination },
    { label: "capacity", ok: !!cp.capacity },
    { label: "service count", ok: !!cp.service_count },
    { label: "musical style", ok: !!cp.musical_style },
    { label: "worship theology", ok: !!cp.worship_theology },
  ];
  const ok = checks.filter(c => c.ok).length;
  return {
    percent: Math.round((ok / checks.length) * 100),
    missing: checks.filter(c => !c.ok).map(c => c.label),
  };
}

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
