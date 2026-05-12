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
  service_end_time: string | null;
  service_timezone: string | null;
  offered_fee: number | null;
  fee_type: string;
  instruments_needed: string[];
  rehearsals: string;
  notes: string | null;
  status: string;
  church_profile_id: string;
  use_church_location: boolean;
  location_verified_at: string | null;
  church_location_verified_at: string | null;
  church_musical_style: string | null;
  tech_setup: string[];
  setlist_url: string | null;
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
  display_name: string;
  available: boolean;
  instruments: string[];
  primary_instrument: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  travel_radius_miles: number;
  bio: string;
  denomination_tags: string[];
  experience_notes: string;
  gear_notes: string;
  is_volunteer: boolean;
  fee_min: number;
  fee_max: number;
  rating: number;
  review_count: number;
  payment_ready: boolean;
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
    .select("id, instruments, primary_instrument, city, state, lat, lng, travel_radius_miles, bio, denomination_tags, experience_notes, gear_notes, is_volunteer, fee_min, fee_max, rating, review_count, available, profiles(display_name)")
    .eq("profile_id", user.id)
    .maybeSingle() as unknown as {
      data: {
        id: string;
        instruments: string[] | null;
        primary_instrument: string | null;
        city: string;
        state: string;
        lat: number | null;
        lng: number | null;
        travel_radius_miles: number;
        bio: string;
        denomination_tags: string[] | null;
        experience_notes: string;
        gear_notes: string;
        is_volunteer: boolean;
        fee_min: number;
        fee_max: number;
        rating: number;
        review_count: number;
        available: boolean;
        profiles: { display_name: string } | null;
      } | null;
    };

  const musicianId = mp?.id;
  const { data: stripeAccount } = musicianId
    ? await supabase
        .from("stripe_accounts")
        .select("charges_enabled, payouts_enabled, details_submitted")
        .eq("musician_profile_id", musicianId)
        .maybeSingle() as unknown as {
          data: { charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean } | null;
        }
    : { data: null };

  const musicianMeta: MusicianMeta = {
    display_name: mp?.profiles?.display_name ?? "You",
    available: mp?.available ?? true,
    instruments: mp?.instruments ?? [],
    primary_instrument: mp?.primary_instrument ?? "",
    city: mp?.city ?? "",
    state: mp?.state ?? "",
    lat: mp?.lat ?? null,
    lng: mp?.lng ?? null,
    travel_radius_miles: mp?.travel_radius_miles ?? 0,
    bio: mp?.bio ?? "",
    denomination_tags: mp?.denomination_tags ?? [],
    experience_notes: mp?.experience_notes ?? "",
    gear_notes: mp?.gear_notes ?? "",
    is_volunteer: mp?.is_volunteer ?? false,
    fee_min: mp?.fee_min ?? 0,
    fee_max: mp?.fee_max ?? 0,
    rating: mp?.rating ?? 0,
    review_count: mp?.review_count ?? 0,
    payment_ready: !!stripeAccount?.charges_enabled && !!stripeAccount?.payouts_enabled && !!stripeAccount?.details_submitted,
  };

  const today = new Date().toISOString().split("T")[0];

  // Fetch this musician's unavailability so we can hide requests on blocked dates.
  const { data: blocks } = musicianId
    ? await supabase
        .from("unavailability_blocks")
        .select("start_date, end_date")
        .eq("musician_profile_id", musicianId)
        .gte("end_date", today)
    : { data: [] as { start_date: string; end_date: string }[] };

  const { data: rows } = await supabase
    .from("service_requests")
    .select("id, title, service_type, service_date, service_time, service_end_time, service_timezone, offered_fee, fee_type, instruments_needed, rehearsals, tech_setup, setlist_url, notes, status, church_profile_id, use_church_location, location_lat, location_lng, location_city, location_state, location_formatted_address, location_verified_at, church_profiles(church_name, city, state, lat, lng, address_verified_at, musical_style)")
    .eq("status", "open")
    .gte("service_date", today)
    .order("service_date", { ascending: true }) as unknown as {
      data: Array<{
        id: string; title: string; service_type: string; service_date: string;
        service_time: string | null; service_end_time: string | null; service_timezone: string | null; offered_fee: number | null; fee_type: string;
        instruments_needed: string[]; rehearsals: string; notes: string | null;
        tech_setup: string[]; setlist_url: string | null;
        status: string; church_profile_id: string; use_church_location: boolean;
        location_lat: number | null; location_lng: number | null; location_city: string | null;
        location_state: string | null; location_formatted_address: string | null; location_verified_at: string | null;
        church_profiles: { church_name: string; city: string; state: string; lat: number | null; lng: number | null; address_verified_at: string | null; musical_style: string | null } | null;
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
      service_end_time: r.service_end_time,
      service_timezone: r.service_timezone,
      offered_fee: r.offered_fee,
      fee_type: r.fee_type,
      instruments_needed: r.instruments_needed,
      rehearsals: r.rehearsals,
      notes: r.notes,
      status: r.status,
      church_profile_id: r.church_profile_id,
      use_church_location: r.use_church_location,
      location_verified_at: r.location_verified_at,
      church_location_verified_at: r.church_profiles?.address_verified_at ?? null,
      church_musical_style: r.church_profiles?.musical_style ?? null,
      tech_setup: r.tech_setup ?? [],
      setlist_url: r.setlist_url,
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
