import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import { OpenRequestsClient } from "./OpenRequestsClient";

export type OpenRequest = {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  service_time: string | null;
  offered_fee: number | null;
  fee_type: string;
  instruments_needed: string[];
  rehearsals: string;
  notes: string | null;
  status: string;
  church_profile_id: string;
  church_name: string;
  church_city: string;
  church_state: string;
  service_lat: number | null;
  service_lng: number | null;
  service_city: string;
  service_state: string;
  service_location_label: string;
};

export type MusicianMeta = {
  instruments: string[];
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  travel_radius_miles: number;
};

export default async function OpenRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "musician") redirect("/requests");

  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id, instruments, city, state, lat, lng, travel_radius_miles")
    .eq("profile_id", user.id)
    .maybeSingle();

  const musicianMeta: MusicianMeta = {
    instruments: (mp as { instruments: string[] | null } | null)?.instruments ?? [],
    city: (mp as { city: string } | null)?.city ?? "",
    state: (mp as { state: string } | null)?.state ?? "",
    lat: (mp as { lat: number | null } | null)?.lat ?? null,
    lng: (mp as { lng: number | null } | null)?.lng ?? null,
    travel_radius_miles: (mp as { travel_radius_miles: number } | null)?.travel_radius_miles ?? 0,
  };

  const today = new Date().toISOString().split("T")[0];

  // Fetch this musician's unavailability so we can hide requests on blocked dates.
  const musicianId = (mp as { id: string } | null)?.id;
  const { data: blocks } = musicianId
    ? await supabase
        .from("unavailability_blocks")
        .select("start_date, end_date")
        .eq("musician_profile_id", musicianId)
        .gte("end_date", today)
    : { data: [] as { start_date: string; end_date: string }[] };

  const { data: rows } = await supabase
    .from("service_requests")
    .select("id, title, service_type, service_date, service_time, offered_fee, fee_type, instruments_needed, rehearsals, notes, status, church_profile_id, use_church_location, location_lat, location_lng, location_city, location_state, location_formatted_address, church_profiles(church_name, city, state, lat, lng)")
    .eq("status", "open")
    .gte("service_date", today)
    .order("service_date", { ascending: true }) as unknown as {
      data: Array<{
        id: string; title: string; service_type: string; service_date: string;
        service_time: string | null; offered_fee: number | null; fee_type: string;
        instruments_needed: string[]; rehearsals: string; notes: string | null;
        status: string; church_profile_id: string; use_church_location: boolean;
        location_lat: number | null; location_lng: number | null; location_city: string | null;
        location_state: string | null; location_formatted_address: string | null;
        church_profiles: { church_name: string; city: string; state: string; lat: number | null; lng: number | null } | null;
      }> | null;
    };

  const blockedRanges = (blocks ?? []) as { start_date: string; end_date: string }[];
  const isBlocked = (d: string) => blockedRanges.some(b => d >= b.start_date && d <= b.end_date);

  const requests: OpenRequest[] = (rows ?? []).filter(r => !isBlocked(r.service_date)).map(r => {
    const serviceCity = r.use_church_location ? r.church_profiles?.city ?? "" : r.location_city ?? "";
    const serviceState = r.use_church_location ? r.church_profiles?.state ?? "" : r.location_state ?? "";
    return {
      id: r.id,
      title: r.title,
      service_type: r.service_type,
      service_date: r.service_date,
      service_time: r.service_time,
      offered_fee: r.offered_fee,
      fee_type: r.fee_type,
      instruments_needed: r.instruments_needed,
      rehearsals: r.rehearsals,
      notes: r.notes,
      status: r.status,
      church_profile_id: r.church_profile_id,
      church_name: r.church_profiles?.church_name ?? "Church",
      church_city: r.church_profiles?.city ?? "",
      church_state: r.church_profiles?.state ?? "",
      service_lat: r.use_church_location ? r.church_profiles?.lat ?? null : r.location_lat,
      service_lng: r.use_church_location ? r.church_profiles?.lng ?? null : r.location_lng,
      service_city: serviceCity,
      service_state: serviceState,
      service_location_label: r.use_church_location
        ? [serviceCity, serviceState].filter(Boolean).join(", ")
        : r.location_formatted_address ?? [serviceCity, serviceState].filter(Boolean).join(", "),
    };
  });

  return (
    <>
      <Topbar title="Open Requests" crumbs={[{ label: "Open Requests" }]} />
      <OpenRequestsClient requests={requests} musicianMeta={musicianMeta} />
    </>
  );
}
