import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { FindMusiciansClient } from "./FindMusiciansClient";
import { redirect } from "next/navigation";

export default async function FindPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const isChurch = profile?.role === "church";

  let viewerLocation: { city: string; state: string; zip: string | null } | null = null;

  if (isChurch) {
    const { data: cp } = await supabase
      .from("church_profiles").select("city, state, zip").eq("profile_id", user.id).single();
    viewerLocation = cp;
  } else {
    const { data: mp } = await supabase
      .from("musician_profiles")
      .select("city, state")
      .eq("profile_id", user.id)
      .maybeSingle() as unknown as { data: { city: string; state: string } | null };
    if (mp) viewerLocation = { city: mp.city, state: mp.state, zip: null };
  }

  const { data: musicians } = await supabase
    .from("musician_profiles")
    .select(`*, profiles(display_name, avatar_url)`)
    .order("rating", { ascending: false })
    .limit(100);

  // Pull future unavailability blocks for all listed musicians so the client
  // can filter by a specific date without round-tripping.
  const today = new Date().toISOString().slice(0, 10);
  const ids = (musicians ?? []).map(m => (m as { id: string }).id);
  const { data: blocks } = ids.length > 0
    ? await supabase
        .from("unavailability_blocks")
        .select("musician_profile_id, start_date, end_date")
        .in("musician_profile_id", ids)
        .gte("end_date", today)
    : { data: [] as { musician_profile_id: string; start_date: string; end_date: string }[] };

  return (
    <>
      <Topbar title={isChurch ? "Find musicians" : "Browse musicians"} />
      <FindMusiciansClient
        musicians={(musicians ?? []) as unknown as Parameters<typeof FindMusiciansClient>[0]["musicians"]}
        viewerLocation={viewerLocation}
        isChurch={isChurch}
        blocks={(blocks ?? []) as { musician_profile_id: string; start_date: string; end_date: string }[]}
      />
    </>
  );
}
