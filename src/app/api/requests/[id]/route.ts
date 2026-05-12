import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniqueInstruments } from "@/lib/instruments";
import { verifyUsAddress, type VerifiedAddress } from "@/lib/locations/verification";
import { normalizeServiceTimeForInput } from "@/lib/requests/time";

type RequestPayload = {
  title?: string;
  service_type?: string;
  service_date?: string;
  service_time?: string | null;
  service_end_time?: string | null;
  service_timezone?: string | null;
  use_church_location?: boolean;
  location_address?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  instruments_needed?: string[];
  rehearsals?: string;
  setlist_url?: string | null;
  tech_setup?: string[];
  offered_fee?: number | null;
  fee_type?: string;
  notes?: string | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "church") {
    return NextResponse.json({ error: "Only churches can update requests" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as RequestPayload | null;
  if (!body?.service_date) {
    return NextResponse.json({ error: "Service date is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: request, error: requestErr } = await admin
    .from("service_requests")
    .select("id, church_profile_id")
    .eq("id", id)
    .maybeSingle();
  if (requestErr || !request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const { data: churchProfile, error: churchErr } = await admin
    .from("church_profiles")
    .select("id")
    .eq("profile_id", active.user.id)
    .maybeSingle();
  if (churchErr || !churchProfile || churchProfile.id !== request.church_profile_id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const useChurchLocation = body.use_church_location ?? true;
  let alternateLocation: VerifiedAddress | null = null;
  if (!useChurchLocation) {
    const verifiedLocation = await verifyUsAddress({
      address: body.location_address,
      city: body.location_city,
      state: body.location_state,
      zip: body.location_zip,
    });
    if (!verifiedLocation.ok) {
      return NextResponse.json({ error: verifiedLocation.error }, { status: verifiedLocation.status });
    }
    alternateLocation = verifiedLocation.address;
  }

  const fields = {
    title: body.title || "Untitled request",
    service_type: body.service_type || "Sunday morning",
    service_date: body.service_date,
    service_time: normalizeServiceTimeForInput(body.service_time) || null,
    service_end_time: normalizeServiceTimeForInput(body.service_end_time) || null,
    service_timezone: body.service_timezone?.trim() || null,
    location: useChurchLocation ? null : alternateLocation?.formattedAddress ?? null,
    use_church_location: useChurchLocation,
    location_address: useChurchLocation ? null : body.location_address?.trim() || null,
    location_city: useChurchLocation ? null : alternateLocation?.city ?? null,
    location_state: useChurchLocation ? null : alternateLocation?.state ?? null,
    location_zip: useChurchLocation ? null : alternateLocation?.zip || null,
    location_lat: useChurchLocation ? null : alternateLocation?.lat ?? null,
    location_lng: useChurchLocation ? null : alternateLocation?.lng ?? null,
    location_formatted_address: useChurchLocation ? null : alternateLocation?.formattedAddress ?? null,
    location_verified_at: useChurchLocation ? null : new Date().toISOString(),
    instruments_needed: uniqueInstruments(body.instruments_needed ?? []),
    rehearsals: body.rehearsals ?? "None",
    setlist_url: body.setlist_url || null,
    tech_setup: body.tech_setup ?? [],
    offered_fee: body.offered_fee ?? null,
    fee_type: body.fee_type || "Per service",
    notes: body.notes || null,
  };

  const { error: updateErr } = await admin
    .from("service_requests")
    .update(fields)
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}
