import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound, redirect } from "next/navigation";
import { NewRequestForm } from "../../new/NewRequestForm";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: request } = await supabase
    .from("service_requests")
    .select("id, title, service_type, service_date, service_time, service_end_time, service_timezone, use_church_location, location_address, location_city, location_state, location_zip, location_lat, location_lng, location_formatted_address, location_verified_at, instruments_needed, rehearsals, setlist_url, tech_setup, offered_fee, fee_type, notes, church_profile_id")
    .eq("id", id)
    .single();

  if (!request) notFound();

  // Verify ownership
  const { data: cp } = await supabase
    .from("church_profiles")
    .select("id, address, city, state, zip, lat, lng, formatted_address, address_verified_at")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!cp || cp.id !== request.church_profile_id) notFound();

  return (
    <>
      <Topbar
        title="Edit request"
        crumbs={[{ label: "Requests", href: "/requests" }, { label: request.title, href: `/requests/${id}` }, { label: "Edit" }]}
      />
      <NewRequestForm
        existingRequest={{
          id: request.id,
          title: request.title,
          service_type: request.service_type,
          service_date: request.service_date,
          service_time: request.service_time,
          service_end_time: request.service_end_time,
          service_timezone: request.service_timezone,
          use_church_location: request.use_church_location,
          location_address: request.location_address,
          location_city: request.location_city,
          location_state: request.location_state,
          location_zip: request.location_zip,
          location_lat: request.location_lat,
          location_lng: request.location_lng,
          location_formatted_address: request.location_formatted_address,
          location_verified_at: request.location_verified_at,
          instruments_needed: request.instruments_needed ?? [],
          rehearsals: request.rehearsals,
          setlist_url: request.setlist_url,
          tech_setup: request.tech_setup ?? [],
          offered_fee: request.offered_fee,
          fee_type: request.fee_type,
          notes: request.notes,
        }}
        churchLocation={cp}
      />
    </>
  );
}
