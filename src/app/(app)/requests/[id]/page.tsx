import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { Avatar } from "@/components/Avatar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CancelRequestButton } from "./CancelRequestButton";
import { InvitePotentialMatchButton } from "./InvitePotentialMatchButton";
import { musicianCompleteness } from "@/app/(app)/profile/completeness";
import { matchingInstruments } from "@/lib/instruments";
import {
  REQUEST_STATUS_CHIP,
  REQUEST_STATUS_LABEL,
  requestDisplayStatus,
} from "@/lib/requests/status";

function distanceMiles(
  from: { lat: number | null; lng: number | null },
  to: { lat: number | null; lng: number | null }
) {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;
  const earthRadiusMiles = 3958.8;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  type RequestRow = {
    id: string; church_profile_id: string; title: string; service_type: string;
    service_date: string; service_time: string | null; location: string | null;
    instruments_needed: string[]; rehearsals: string; tech_setup: string[];
    offered_fee: number | null; fee_type: string; setlist_url: string | null;
    notes: string | null; status: string; created_at: string;
    church_profiles: { church_name: string; city: string; state: string; lat: number | null; lng: number | null } | null;
  };
  type ApplicationRow = {
    id: string; request_id: string; musician_profile_id: string; message: string | null; created_at: string;
    musician_profiles: {
      id: string; profile_id: string; primary_instrument: string; city: string; state: string;
      fee_min: number; fee_max: number;
      profiles: { display_name: string; avatar_url: string | null } | null;
    } | null;
  };
  type PotentialMatch = {
    id: string;
    profile_id: string;
    city: string;
    state: string;
    lat: number | null;
    lng: number | null;
    instruments: string[];
    primary_instrument: string;
    experience_notes: string;
    gear_notes: string;
    is_volunteer: boolean;
    fee_min: number;
    fee_max: number;
    bio: string;
    denomination_tags: string[];
    rating: number;
    review_count: number;
    travel_radius_miles: number;
    verified: boolean;
    display_name: string;
    avatar_url: string | null;
    completeness: number;
    matchedInstruments: string[];
    distance: number | null;
    areaLabel: string;
  };

  const [{ data: request }, { data: profile }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("*, church_profiles(church_name, city, state, lat, lng)")
      .eq("id", id)
      .single() as unknown as Promise<{ data: RequestRow | null; error: unknown }>,
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!request) notFound();

  const isMusician = profile?.role === "musician";
  const display = requestDisplayStatus(request.status, request.service_date);
  const d = new Date(request.service_date + "T12:00:00");
  const churchLocation = [request.church_profiles?.city, request.church_profiles?.state].filter(Boolean).join(", ");

  // Church-side: fetch applications
  let applications: ApplicationRow[] | null = null;
  let potentialMatches: PotentialMatch[] = [];
  if (!isMusician) {
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
        .select("id, profile_id, city, state, lat, lng, instruments, primary_instrument, experience_notes, gear_notes, is_volunteer, fee_min, fee_max, bio, denomination_tags, rating, review_count, available, travel_radius_miles, profiles(display_name, avatar_url, verified)")
        .eq("available", true)
        .limit(150) as unknown as Promise<{
          data: Array<{
            id: string; profile_id: string; city: string; state: string; lat: number | null; lng: number | null;
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
    const churchCoords = {
      lat: request.church_profiles?.lat ?? null,
      lng: request.church_profiles?.lng ?? null,
    };

    potentialMatches = (musicians ?? [])
      .map(m => {
        const matched = matchingInstruments(
          request.instruments_needed,
          m.instruments ?? [],
          m.primary_instrument
        );
        const distance = distanceMiles(churchCoords, { lat: m.lat, lng: m.lng });
        const withinTravelRadius = distance == null
          ? m.state === request.church_profiles?.state
          : distance <= (m.travel_radius_miles || 0);
        const completeness = musicianCompleteness({
          bio: m.bio,
          city: m.city,
          state: m.state,
          primary_instrument: m.primary_instrument,
          instruments: m.instruments ?? [],
          fee_min: m.fee_min,
          fee_max: m.fee_max,
          is_volunteer: m.is_volunteer,
          travel_radius_miles: m.travel_radius_miles,
          denomination_tags: m.denomination_tags ?? [],
          experience_notes: m.experience_notes,
          gear_notes: m.gear_notes,
        }).percent;

        return {
          ...m,
          verified: !!m.profiles?.verified,
          display_name: m.profiles?.display_name ?? "Musician",
          avatar_url: m.profiles?.avatar_url ?? null,
          completeness,
          matchedInstruments: matched,
          distance,
          areaLabel: distance == null
            ? `${m.city}, ${m.state}`
            : `${Math.round(distance)} mi away`,
          isPotentialMatch: !contactedMusicianIds.has(m.id) &&
            !unavailableMusicianIds.has(m.id) &&
            matched.length > 0 &&
            withinTravelRadius,
        };
      })
      .filter(m => m.isPotentialMatch)
      .map(m => ({
        id: m.id,
        profile_id: m.profile_id,
        city: m.city,
        state: m.state,
        lat: m.lat,
        lng: m.lng,
        instruments: m.instruments,
        primary_instrument: m.primary_instrument,
        experience_notes: m.experience_notes,
        gear_notes: m.gear_notes,
        is_volunteer: m.is_volunteer,
        fee_min: m.fee_min,
        fee_max: m.fee_max,
        bio: m.bio,
        denomination_tags: m.denomination_tags,
        rating: m.rating,
        review_count: m.review_count,
        travel_radius_miles: m.travel_radius_miles,
        verified: m.verified,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        completeness: m.completeness,
        matchedInstruments: m.matchedInstruments,
        distance: m.distance,
        areaLabel: m.areaLabel,
      }))
      .sort((a, b) =>
        Number(b.verified) - Number(a.verified) ||
        Number(b.rating) - Number(a.rating) ||
        b.completeness - a.completeness ||
        b.review_count - a.review_count ||
        a.display_name.localeCompare(b.display_name)
      )
      .slice(0, 8);
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--sm-border-subtle)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
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
                  {request.service_time && <><span>·</span><span>{request.service_time}</span></>}
                  {churchLocation && <><span>·</span><span>{churchLocation}</span></>}
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
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Instruments needed</h3>
                {request.instruments_needed.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.instruments_needed.map((i: string) => <span key={i} className="chip">{i}</span>)}
                  </div>
                ) : (
                  <span style={{ color: "var(--sm-fg-4)", fontSize: 14 }}>Not specified</span>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Rehearsals</h3>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-1)" }}>{request.rehearsals}</p>
              </div>

              {request.tech_setup.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Tech setup</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.tech_setup.map((t: string) => <span key={t} className="chip chip--outline">{t}</span>)}
                  </div>
                </div>
              )}

              {request.setlist_url && (
                <div>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Setlist</h3>
                  <a href={request.setlist_url} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--sm-accent)", fontSize: 14.5, textDecoration: "underline" }}>
                    View setlist →
                  </a>
                </div>
              )}
            </div>

            {request.notes && (
              <div style={{ marginBottom: 32, padding: "18px 20px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", borderLeft: "3px solid var(--sm-border-strong)" }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 8px" }}>Notes</h3>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-2)", lineHeight: 1.6 }}>{request.notes}</p>
              </div>
            )}

            {/* Church view: applicants */}
            {!isMusician && (
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
                      const mp = app.musician_profiles as { id: string; profiles: { display_name: string; avatar_url: string | null } | null; primary_instrument: string; city: string; state: string; fee_min: number; fee_max: number };
                      const name = mp?.profiles?.display_name ?? "Musician";
                      return (
                        <div key={app.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                          <Avatar src={mp?.profiles?.avatar_url} name={name} size={44} colorIndex={i} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 2 }}>{name}</div>
                            <div style={{ fontSize: 13, color: "var(--sm-fg-3)" }}>{mp?.primary_instrument} · {mp?.city}, {mp?.state}</div>
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
                      Verified first, then rating and profile strength
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
              {request.service_time && (
                <>
                  <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Time</dt>
                  <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>{request.service_time}</dd>
                </>
              )}
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Status</dt>
              <dd style={{ margin: isMusician ? 0 : "0 0 16px" }}>
                <span className={REQUEST_STATUS_CHIP[display]}>{REQUEST_STATUS_LABEL[display]}</span>
              </dd>
              {!isMusician && (
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
