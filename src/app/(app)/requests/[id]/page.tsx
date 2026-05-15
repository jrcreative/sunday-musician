import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { Avatar } from "@/components/Avatar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CancelRequestButton } from "./CancelRequestButton";
import { InvitePotentialMatchButton } from "./InvitePotentialMatchButton";
import { buildPotentialMatches, type PotentialMatch } from "@/lib/matches/potential";
import { scoreServiceReadiness } from "@/lib/matches/readiness";
import {
  REQUEST_STATUS_CHIP,
  REQUEST_STATUS_LABEL,
  requestDisplayStatus,
} from "@/lib/requests/status";
import { scoreRequestQuality } from "@/lib/requests/quality";
import { formatServiceTimeRange } from "@/lib/requests/time";
import { RequestQualityCard } from "../RequestQualityCard";

function spotifyPlaylistEmbedUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value || value.startsWith("<")) return null;

  const uriMatch = value.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch) return `https://open.spotify.com/embed/playlist/${uriMatch[1]}`;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "open.spotify.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    const playlistIndex = parts.indexOf("playlist");
    const playlistId = playlistIndex >= 0 ? parts[playlistIndex + 1] : null;

    return playlistId ? `https://open.spotify.com/embed/playlist/${playlistId}` : null;
  } catch {
    return null;
  }
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  type RequestRow = {
    id: string; church_profile_id: string; title: string; service_type: string;
    service_date: string; service_time: string | null; location: string | null;
    service_end_time: string | null;
    service_timezone: string | null;
    use_church_location: boolean; location_lat: number | null; location_lng: number | null;
    location_city: string | null; location_state: string | null; location_formatted_address: string | null;
    location_verified_at: string | null;
    instruments_needed: string[]; rehearsals: string; tech_setup: string[];
    offered_fee: number | null; fee_type: string; setlist_url: string | null;
    notes: string | null; status: string; created_at: string;
    church_profiles: {
      church_name: string; city: string; state: string; lat: number | null; lng: number | null;
      address_verified_at: string | null; musical_style: string | null;
    } | null;
  };
  type ApplicationRow = {
    id: string; request_id: string; musician_profile_id: string; message: string | null; created_at: string;
    musician_profiles: {
      id: string; profile_id: string; primary_instrument: string; city: string; state: string;
      lat: number | null; lng: number | null; instruments: string[]; experience_notes: string; gear_notes: string;
      fee_min: number; fee_max: number; is_volunteer: boolean; bio: string; denomination_tags: string[];
      rating: number; review_count: number; available: boolean; travel_radius_miles: number;
      profiles: { display_name: string; avatar_url: string | null } | null;
    } | null;
  };
  type AcceptedBookingRow = {
    id: string; thread_id: string; fee: number | null; fee_type: string | null; accepted_at: string;
    musician_profiles: {
      id: string; primary_instrument: string; city: string; state: string;
      rating: number; review_count: number;
      profiles: { display_name: string; avatar_url: string | null } | null;
    } | null;
  };
  const [{ data: request }, { data: profile }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("*, church_profiles(church_name, city, state, lat, lng, address_verified_at, musical_style)")
      .eq("id", id)
      .single() as unknown as Promise<{ data: RequestRow | null; error: unknown }>,
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!request) notFound();

  const isMusician = profile?.role === "musician";
  const display = requestDisplayStatus(request.status, request.service_date);
  const isFilled = display === "filled";
  const d = new Date(request.service_date + "T12:00:00");
  const serviceTimeLabel = formatServiceTimeRange(request.service_time, request.service_end_time);
  const serviceLocation = request.use_church_location
    ? [request.church_profiles?.city, request.church_profiles?.state].filter(Boolean).join(", ")
    : request.location_formatted_address ?? [request.location_city, request.location_state].filter(Boolean).join(", ");
  const qualityScore = !isFilled ? scoreRequestQuality({
    title: request.title,
    serviceType: request.service_type,
    serviceDate: request.service_date,
    serviceTime: request.service_time,
    useChurchLocation: request.use_church_location,
    churchLocationVerified: !!request.church_profiles?.address_verified_at,
    locationVerified: !!request.location_verified_at,
    instrumentsNeeded: request.instruments_needed,
    rehearsals: request.rehearsals,
    setlistUrl: request.setlist_url,
    techSetup: request.tech_setup,
    offeredFee: request.offered_fee,
    feeType: request.fee_type,
    notes: request.notes,
  }) : null;
  const serviceCoords = {
    lat: request.use_church_location ? request.church_profiles?.lat ?? null : request.location_lat,
    lng: request.use_church_location ? request.church_profiles?.lng ?? null : request.location_lng,
  };
  const serviceCoordsVerified = request.use_church_location
    ? !!request.church_profiles?.address_verified_at
    : !!request.location_verified_at;
  const serviceState = request.use_church_location ? request.church_profiles?.state : request.location_state;
  const spotifySetlistEmbedUrl = request.setlist_url ? spotifyPlaylistEmbedUrl(request.setlist_url) : null;

  // Church-side: show booking details for filled requests, otherwise show matching workflow.
  let applications: ApplicationRow[] | null = null;
  let acceptedBooking: AcceptedBookingRow | null = null;
  let potentialMatches: PotentialMatch[] = [];
  let unavailableMusicianIdsForRequest = new Set<string>();
  if (!isMusician) {
    if (isFilled) {
      const { data } = await supabase
        .from("bookings")
        .select("id, thread_id, fee, fee_type, accepted_at, musician_profiles(id, primary_instrument, city, state, rating, review_count, profiles(display_name, avatar_url))")
        .eq("request_id", id)
        .is("cancelled_at", null)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as { data: AcceptedBookingRow | null; error: unknown };
      acceptedBooking = data;
    } else {
      const { data } = await supabase
        .from("applications")
        .select("*, musician_profiles(*, profiles(display_name, avatar_url))")
        .eq("request_id", id)
        .order("created_at", { ascending: false }) as unknown as { data: ApplicationRow[] | null; error: unknown };
      applications = data;

      const [{ data: threads }, { data: blocks }, { data: musicians }] = await Promise.all([
        supabase
          .from("threads")
          .select("musician_profile_id")
          .eq("request_id", id) as unknown as Promise<{ data: { musician_profile_id: string }[] | null; error: unknown }>,
        supabase
          .from("unavailability_blocks")
          .select("musician_profile_id, start_date, end_date")
          .lte("start_date", request.service_date)
          .gte("end_date", request.service_date) as unknown as Promise<{ data: { musician_profile_id: string; start_date: string; end_date: string }[] | null; error: unknown }>,
        supabase
          .from("musician_profiles")
          .select("id, profile_id, city, state, lat, lng, address_verified_at, instruments, primary_instrument, experience_notes, gear_notes, is_volunteer, fee_min, fee_max, bio, denomination_tags, rating, review_count, available, travel_radius_miles, profiles(display_name, avatar_url, verified)")
          .eq("available", true)
          .limit(150) as unknown as Promise<{
            data: Array<{
              id: string; profile_id: string; city: string; state: string; lat: number | null; lng: number | null;
              address_verified_at: string | null;
              instruments: string[]; primary_instrument: string; experience_notes: string; gear_notes: string;
              is_volunteer: boolean; fee_min: number; fee_max: number; bio: string; denomination_tags: string[];
              rating: number; review_count: number; available: boolean; travel_radius_miles: number;
              profiles: { display_name: string; avatar_url: string | null; verified: boolean } | null;
            }> | null;
            error: unknown;
          }>,
      ]);

      const contactedMusicianIds = new Set([
        ...(applications ?? []).map(app => app.musician_profile_id),
        ...(threads ?? []).map(thread => thread.musician_profile_id),
      ]);
      const unavailableMusicianIds = new Set((blocks ?? []).map(block => block.musician_profile_id));
      unavailableMusicianIdsForRequest = unavailableMusicianIds;
      applications = (applications ?? []).sort((a, b) => {
        const aMp = a.musician_profiles;
        const bMp = b.musician_profiles;
        if (!aMp || !bMp) return Number(!!bMp) - Number(!!aMp);
        const aScore = scoreServiceReadiness({
          title: request.title,
          serviceType: request.service_type,
          serviceStyle: request.church_profiles?.musical_style ?? null,
          serviceDate: request.service_date,
          serviceTime: request.service_time,
          useChurchLocation: request.use_church_location,
          churchLocationVerified: !!request.church_profiles?.address_verified_at,
          locationVerified: !!request.location_verified_at,
          instrumentsNeeded: request.instruments_needed,
          rehearsals: request.rehearsals,
          techSetup: request.tech_setup,
          offeredFee: request.offered_fee,
          feeType: request.fee_type,
          setlistUrl: request.setlist_url,
          notes: request.notes,
          serviceCoords: serviceCoordsVerified ? serviceCoords : null,
          serviceState,
        }, {
          displayName: aMp.profiles?.display_name ?? "Musician",
          available: aMp.available,
          instruments: aMp.instruments ?? [],
          primaryInstrument: aMp.primary_instrument,
          city: aMp.city,
          state: aMp.state,
          lat: aMp.lat,
          lng: aMp.lng,
          travelRadiusMiles: aMp.travel_radius_miles,
          bio: aMp.bio,
          denominationTags: aMp.denomination_tags ?? [],
          experienceNotes: aMp.experience_notes,
          gearNotes: aMp.gear_notes,
          isVolunteer: aMp.is_volunteer,
          feeMin: aMp.fee_min,
          feeMax: aMp.fee_max,
          rating: aMp.rating,
          reviewCount: aMp.review_count,
          blockedOnServiceDate: unavailableMusicianIds.has(aMp.id),
        }).percent;
        const bScore = scoreServiceReadiness({
          title: request.title,
          serviceType: request.service_type,
          serviceStyle: request.church_profiles?.musical_style ?? null,
          serviceDate: request.service_date,
          serviceTime: request.service_time,
          useChurchLocation: request.use_church_location,
          churchLocationVerified: !!request.church_profiles?.address_verified_at,
          locationVerified: !!request.location_verified_at,
          instrumentsNeeded: request.instruments_needed,
          rehearsals: request.rehearsals,
          techSetup: request.tech_setup,
          offeredFee: request.offered_fee,
          feeType: request.fee_type,
          setlistUrl: request.setlist_url,
          notes: request.notes,
          serviceCoords: serviceCoordsVerified ? serviceCoords : null,
          serviceState,
        }, {
          displayName: bMp.profiles?.display_name ?? "Musician",
          available: bMp.available,
          instruments: bMp.instruments ?? [],
          primaryInstrument: bMp.primary_instrument,
          city: bMp.city,
          state: bMp.state,
          lat: bMp.lat,
          lng: bMp.lng,
          travelRadiusMiles: bMp.travel_radius_miles,
          bio: bMp.bio,
          denominationTags: bMp.denomination_tags ?? [],
          experienceNotes: bMp.experience_notes,
          gearNotes: bMp.gear_notes,
          isVolunteer: bMp.is_volunteer,
          feeMin: bMp.fee_min,
          feeMax: bMp.fee_max,
          rating: bMp.rating,
          reviewCount: bMp.review_count,
          blockedOnServiceDate: unavailableMusicianIds.has(bMp.id),
        }).percent;
        return bScore - aScore;
      });
      potentialMatches = buildPotentialMatches({
        musicians: musicians ?? [],
        instrumentsNeeded: request.instruments_needed,
        serviceCoords,
        serviceCoordsVerified,
        serviceState,
        serviceType: request.service_type,
        serviceStyle: request.church_profiles?.musical_style ?? null,
        serviceDate: request.service_date,
        serviceTime: request.service_time,
        useChurchLocation: request.use_church_location,
        churchLocationVerified: !!request.church_profiles?.address_verified_at,
        locationVerified: !!request.location_verified_at,
        rehearsals: request.rehearsals,
        techSetup: request.tech_setup,
        offeredFee: request.offered_fee,
        feeType: request.fee_type,
        setlistUrl: request.setlist_url,
        notes: request.notes,
        contactedMusicianIds,
        unavailableMusicianIds,
      });
    }
  }

  // Musician-side: check if they have a thread for this request
  let threadId: string | null = null;
  if (isMusician) {
    const { data: mp } = await supabase
      .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();
    if (mp) {
      const { data: thread } = await supabase
        .from("threads").select("id")
        .eq("musician_profile_id", mp.id)
        .eq("request_id", id)
        .maybeSingle();
      threadId = thread?.id ?? null;
    }
  }

  const crumbBase = isMusician
    ? [{ label: "Open Requests", href: "/open-requests" }]
    : [{ label: "Requests", href: "/requests" }];

  return (
    <>
      <Topbar
        title={request.title}
        crumbs={[...crumbBase, { label: request.title }]}
      />
      <div className="page">
        <div className="sm-split sm-split--profile" style={{ gap: 32 }}>

          {/* Main content */}
          <div>
            {/* Header */}
            <div className="sm-mobile-stack-header" style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--sm-border-subtle)" }}>
              <div style={{ minWidth: 0 }}>
                <div className="sm-mobile-stack-header" style={{ marginBottom: 8 }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{request.title}</h2>
                  <span className={REQUEST_STATUS_CHIP[display]}>{REQUEST_STATUS_LABEL[display]}</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--sm-fg-3)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {isMusician && request.church_profiles && (
                    <><span style={{ fontWeight: 500, color: "var(--sm-fg-2)" }}>{request.church_profiles.church_name}</span><span>·</span></>
                  )}
                  <span>{request.service_type}</span>
                  <span>·</span>
                  <span>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                  {serviceTimeLabel && <><span>·</span><span>{serviceTimeLabel}</span></>}
                  {serviceLocation && <><span>·</span><span>{serviceLocation}</span></>}
                </div>
              </div>
              {!isMusician && display === "open" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={`/requests/${request.id}/edit`} className="btn btn--ghost btn--sm">Edit request</Link>
                  <CancelRequestButton requestId={request.id} requestTitle={request.title} />
                </div>
              )}
            </div>

            {/* Details grid */}
            <div className="sm-row-2" style={{ gap: "24px 40px", marginBottom: 32 }}>
              <div style={{ padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Instruments needed</h3>
                {request.instruments_needed.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.instruments_needed.map((i: string) => <span key={i} className="chip">{i}</span>)}
                  </div>
                ) : (
                  <span style={{ color: "var(--sm-fg-4)", fontSize: 14 }}>Not specified</span>
                )}
              </div>

              <div style={{ padding: "16px 18px", border: "1px solid color-mix(in srgb, var(--sm-accent) 24%, var(--sm-border-subtle))", borderRadius: "var(--sm-radius-sm)", background: "color-mix(in srgb, var(--sm-accent) 5%, var(--sm-bg-1))" }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Rehearsal schedule</h3>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sm-accent)", marginTop: 7, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 15.5, color: "var(--sm-fg-1)", fontWeight: 600, lineHeight: 1.45, whiteSpace: "pre-line" }}>{request.rehearsals}</p>
                </div>
              </div>

              {request.tech_setup.length > 0 && (
                <div style={{ padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Tech setup</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.tech_setup.map((t: string) => <span key={t} className="chip chip--outline">{t}</span>)}
                  </div>
                </div>
              )}

              {request.setlist_url && (
                <div style={spotifySetlistEmbedUrl ? { gridColumn: "1 / -1" } : undefined}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Setlist</h3>
                  {spotifySetlistEmbedUrl ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <iframe
                        src={spotifySetlistEmbedUrl}
                        title={`${request.title} Spotify playlist`}
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: 352,
                          border: 0,
                          borderRadius: "var(--sm-radius-sm)",
                          background: "var(--sm-bg-3)",
                        }}
                      />
                      <a href={request.setlist_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--sm-accent)", fontSize: 13.5, textDecoration: "underline" }}>
                        Open playlist in Spotify →
                      </a>
                    </div>
                  ) : (
                    <a href={request.setlist_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--sm-accent)", fontSize: 14.5, textDecoration: "underline" }}>
                      View setlist →
                    </a>
                  )}
                </div>
              )}
            </div>

            {request.notes && (
              <div style={{ marginBottom: 32, padding: "18px 20px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", borderLeft: "3px solid var(--sm-border-strong)" }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 8px" }}>Notes</h3>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-2)", lineHeight: 1.6 }}>{request.notes}</p>
              </div>
            )}

            {!isMusician && qualityScore && (
              <div style={{ marginBottom: 32 }}>
                <RequestQualityCard score={qualityScore} />
              </div>
            )}

            {/* Church view */}
            {!isMusician && isFilled && (
              <section style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 16px" }}>
                  Confirmed musician
                </h3>
                {acceptedBooking?.musician_profiles ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                    <Avatar
                      src={acceptedBooking.musician_profiles.profiles?.avatar_url}
                      name={acceptedBooking.musician_profiles.profiles?.display_name ?? "Musician"}
                      size={52}
                      colorIndex={0}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <Link href={`/musicians/${acceptedBooking.musician_profiles.id}`} style={{ fontWeight: 700, fontSize: 16, color: "var(--sm-fg-1)", textDecoration: "none" }}>
                          {acceptedBooking.musician_profiles.profiles?.display_name ?? "Musician"}
                        </Link>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--sm-status-success)", background: "rgba(16, 122, 82, 0.08)", padding: "2px 7px", borderRadius: 10 }}>
                          Accepted
                        </span>
                      </div>
                      <div style={{ fontSize: 13.5, color: "var(--sm-fg-3)", marginBottom: 10 }}>
                        {acceptedBooking.musician_profiles.primary_instrument} · {acceptedBooking.musician_profiles.city}, {acceptedBooking.musician_profiles.state}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--sm-fg-3)" }}>
                        <span>
                          {acceptedBooking.fee != null ? `$${acceptedBooking.fee} / ${(acceptedBooking.fee_type ?? request.fee_type).toLowerCase()}` : "Fee not set"}
                        </span>
                        <span>
                          Accepted {new Date(acceptedBooking.accepted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span style={{ color: acceptedBooking.musician_profiles.rating > 0 ? "var(--sm-accent)" : "var(--sm-fg-4)" }}>
                          ★ {acceptedBooking.musician_profiles.rating > 0 ? acceptedBooking.musician_profiles.rating : "New"}{acceptedBooking.musician_profiles.review_count > 0 ? ` (${acceptedBooking.musician_profiles.review_count})` : ""}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <Link href={`/musicians/${acceptedBooking.musician_profiles.id}`} className="btn btn--ghost btn--sm">Profile</Link>
                      <Link href={`/messages/${acceptedBooking.thread_id}`} className="btn btn--primary btn--sm">Message</Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "28px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)", background: "var(--sm-bg-1)" }}>
                    This request is filled, but the accepted musician details are not available.
                  </div>
                )}
              </section>
            )}

            {!isMusician && !isFilled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: 0 }}>
                    Interested musicians
                    <span style={{ marginLeft: 8, background: "var(--sm-bg-3)", color: "var(--sm-fg-3)", fontSize: 11.5, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>
                      {applications?.length ?? 0}
                    </span>
                  </h3>
                  <Link href="/find" className="btn btn--ghost btn--sm">Browse musicians</Link>
                </div>

                {applications && applications.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {applications.map((app, i) => {
                      const mp = app.musician_profiles;
                      const name = mp?.profiles?.display_name ?? "Musician";
                      const readiness = mp ? scoreServiceReadiness({
                        title: request.title,
                        serviceType: request.service_type,
                        serviceStyle: request.church_profiles?.musical_style ?? null,
                        serviceDate: request.service_date,
                        serviceTime: request.service_time,
                        useChurchLocation: request.use_church_location,
                        churchLocationVerified: !!request.church_profiles?.address_verified_at,
                        locationVerified: !!request.location_verified_at,
                        instrumentsNeeded: request.instruments_needed,
                        rehearsals: request.rehearsals,
                        techSetup: request.tech_setup,
                        offeredFee: request.offered_fee,
                        feeType: request.fee_type,
                        setlistUrl: request.setlist_url,
                        notes: request.notes,
                        serviceCoords: serviceCoordsVerified ? serviceCoords : null,
                        serviceState,
                      }, {
                        displayName: name,
                        available: mp.available,
                        instruments: mp.instruments ?? [],
                        primaryInstrument: mp.primary_instrument,
                        city: mp.city,
                        state: mp.state,
                        lat: mp.lat,
                        lng: mp.lng,
                        travelRadiusMiles: mp.travel_radius_miles,
                        bio: mp.bio,
                        denominationTags: mp.denomination_tags ?? [],
                        experienceNotes: mp.experience_notes,
                        gearNotes: mp.gear_notes,
                        isVolunteer: mp.is_volunteer,
                        feeMin: mp.fee_min,
                        feeMax: mp.fee_max,
                        rating: mp.rating,
                        reviewCount: mp.review_count,
                        blockedOnServiceDate: unavailableMusicianIdsForRequest.has(mp.id),
                      }) : null;
                      return (
                        <div key={app.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                          <Avatar src={mp?.profiles?.avatar_url} name={name} size={44} colorIndex={i} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 2 }}>{name}</div>
                            <div style={{ fontSize: 13, color: "var(--sm-fg-3)" }}>{mp?.primary_instrument} · {mp?.city}, {mp?.state}</div>
                            {readiness && (
                              <>
                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--sm-accent)", background: "rgba(228,123,2,0.08)", padding: "2px 7px", borderRadius: 10 }}>
                                    {readiness.percent}% service readiness
                                  </span>
                                  <span style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>{readiness.label}</span>
                                </div>
                                <p style={{ fontSize: 13, color: "var(--sm-fg-2)", margin: "7px 0 0", lineHeight: 1.45 }}>
                                  {readiness.explanation}
                                </p>
                              </>
                            )}
                            {app.message && <p style={{ fontSize: 13.5, color: "var(--sm-fg-2)", margin: "8px 0 0", lineHeight: 1.5 }}>{app.message}</p>}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <Link href={`/musicians/${mp?.id}`} className="btn btn--ghost btn--sm">Profile</Link>
                            <Link href={`/messages?musician=${mp?.id}`} className="btn btn--primary btn--sm">Message</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
                    <p style={{ margin: "0 0 16px" }}>No one has applied yet. Invite a musician or wait for matches.</p>
                    <Link href="/find" className="btn btn--secondary">Browse musicians</Link>
                  </div>
                )}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: 0 }}>
                      Potential matches
                      <span style={{ marginLeft: 8, background: "var(--sm-bg-3)", color: "var(--sm-fg-3)", fontSize: 11.5, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>
                        {potentialMatches.length}
                      </span>
                    </h3>
                    <span style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>
                      Ranked by service readiness
                    </span>
                  </div>

                  {potentialMatches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {potentialMatches.map((match, i) => {
                        const feeLabel = match.is_volunteer
                          ? "Volunteer"
                          : match.fee_min > 0
                            ? `$${match.fee_min}-${match.fee_max}`
                            : "Fee not set";
                        return (
                          <div key={match.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                            <Avatar src={match.avatar_url} name={match.display_name} size={44} colorIndex={i + 3} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                                <Link href={`/musicians/${match.id}`} style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", textDecoration: "none" }}>
                                  {match.display_name}
                                </Link>
                                {match.verified && (
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--sm-status-success)", background: "rgba(16, 122, 82, 0.08)", padding: "1px 7px", borderRadius: 10 }}>
                                    Verified
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: "var(--sm-fg-3)" }}>
                                {match.primary_instrument} · {match.areaLabel} · {feeLabel}
                              </div>
                              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--sm-accent)", background: "rgba(228,123,2,0.08)", padding: "2px 7px", borderRadius: 10 }}>
                                  {match.readiness.percent}% service readiness
                                </span>
                                <span style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>{match.readiness.label}</span>
                              </div>
                              <p style={{ fontSize: 13, color: "var(--sm-fg-2)", margin: "7px 0 0", lineHeight: 1.45 }}>
                                {match.readiness.explanation}
                              </p>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                                <span style={{ color: match.rating > 0 ? "var(--sm-accent)" : "var(--sm-fg-4)" }}>
                                  ★ {match.rating > 0 ? match.rating : "New"}{match.review_count > 0 ? ` (${match.review_count})` : ""}
                                </span>
                                <span>{match.completeness}% profile</span>
                                <span>{match.matchedInstruments.join(", ")}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
                              <Link href={`/musicians/${match.id}`} className="btn btn--ghost btn--sm">Profile</Link>
                              {display === "open" && (
                                <InvitePotentialMatchButton requestId={request.id} musicianProfileId={match.id} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "34px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
                      <p style={{ margin: "0 0 8px", color: "var(--sm-fg-1)", fontWeight: 600 }}>No strong matches yet</p>
                      <p style={{ margin: 0, fontSize: 14 }}>Try adding more roles, checking location data, or browsing all musicians.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Musician view: contact CTA */}
            {isMusician && (
              <div style={{ padding: "24px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", border: "1px solid var(--sm-border-subtle)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>
                  Interested in this role?
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--sm-fg-3)", lineHeight: 1.5 }}>
                  Message {request.church_profiles?.church_name ?? "the church"} to introduce yourself and express your interest.
                </p>
                {threadId ? (
                  <Link href={`/messages/${threadId}`} className="btn btn--primary">
                    Continue conversation →
                  </Link>
                ) : (
                  <Link href={`/messages?church_id=${request.church_profile_id}&request_id=${id}`} className="btn btn--primary">
                    Message {request.church_profiles?.church_name ?? "church"}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Aside */}
          <aside style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22, position: "sticky", top: 90 }}>
            <dl style={{ margin: 0 }}>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Offered fee</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--sm-fg-1)" }}>
                {request.offered_fee != null ? (
                  <>${request.offered_fee} <span style={{ fontWeight: 400, color: "var(--sm-fg-3)", fontSize: 13 }}>/ {request.fee_type.toLowerCase()}</span></>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--sm-fg-4)" }}>Not set</span>
                )}
              </dd>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Date</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>
                {d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </dd>
              {serviceTimeLabel && (
                <>
                  <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Time</dt>
                  <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>{serviceTimeLabel}</dd>
                </>
              )}
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Status</dt>
              <dd style={{ margin: isMusician ? 0 : "0 0 16px" }}>
                <span className={REQUEST_STATUS_CHIP[display]}>{REQUEST_STATUS_LABEL[display]}</span>
              </dd>
              {!isMusician && !isFilled && (
                <>
                  <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Applicants</dt>
                  <dd style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>
                    {applications?.length ?? 0}
                  </dd>
                </>
              )}
            </dl>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--sm-border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
              {isMusician ? (
                <>
                  {threadId ? (
                    <Link href={`/messages/${threadId}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                      View conversation
                    </Link>
                  ) : (
                    <Link href={`/messages?church_id=${request.church_profile_id}&request_id=${id}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                      Message church
                    </Link>
                  )}
                  <Link href="/open-requests" className="btn btn--ghost" style={{ textAlign: "center", textDecoration: "none" }}>
                    ← Back to requests
                  </Link>
                </>
              ) : isFilled ? (
                acceptedBooking ? (
                  <Link href={`/messages/${acceptedBooking.thread_id}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                    View conversation
                  </Link>
                ) : (
                  <Link href="/requests" className="btn btn--ghost" style={{ textAlign: "center", textDecoration: "none" }}>
                    ← Back to requests
                  </Link>
                )
              ) : (
                <Link href="/find" className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                  Find a musician
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
