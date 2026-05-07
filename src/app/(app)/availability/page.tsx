import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import { AvailabilityClient } from "./AvailabilityClient";
import { syncIcalConnection } from "@/lib/calendar/sync-connection";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1h

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "musician") redirect("/dashboard");

  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id, available")
    .eq("profile_id", user.id)
    .single();
  if (!mp) redirect("/profile");

  // Lazy resync: if any iCal feed is older than the threshold, sync before render.
  // Errors are swallowed (we still want the page to render); per-connection
  // last_error gets set by the sync function for surfacing.
  const { data: connectionsForSync } = await supabase
    .from("calendar_connections")
    .select("id, musician_profile_id, ical_url, kind, last_synced_at")
    .eq("musician_profile_id", mp.id)
    .eq("kind", "ical");

  const now = Date.now();
  await Promise.allSettled(
    (connectionsForSync ?? [])
      .filter(c => c.ical_url && (!c.last_synced_at || now - new Date(c.last_synced_at).getTime() > STALE_AFTER_MS))
      .map(c => syncIcalConnection(supabase, {
        id: c.id,
        musician_profile_id: c.musician_profile_id,
        ical_url: c.ical_url!,
      }))
  );

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: blocks }, { data: connections }] = await Promise.all([
    supabase
      .from("unavailability_blocks")
      .select("id, start_date, end_date, source, note")
      .eq("musician_profile_id", mp.id)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    supabase
      .from("calendar_connections")
      .select("id, kind, label, ical_url, last_synced_at, last_error")
      .eq("musician_profile_id", mp.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <>
      <Topbar title="Availability" crumbs={[{ label: "Availability" }]} />
      <AvailabilityClient
        musicianId={mp.id}
        masterAvailable={mp.available}
        initialBlocks={blocks ?? []}
        initialConnections={connections ?? []}
      />
    </>
  );
}
