import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { DateCell, KpiCard, StatusPill } from "../_components/AdminPrimitives";
import { MatchAssistButton } from "./MatchAssistClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  request?: string;
  city?: string;
  instrument?: string;
};

type RequestRow = {
  id: string;
  title: string;
  service_date: string;
  service_time: string | null;
  status: "open" | "in_progress" | "filled" | "cancelled";
  location_city: string | null;
  location_state: string | null;
  instruments_needed: string[];
  offered_fee: number | null;
  fee_type: string;
  notes: string | null;
  applications: { id: string }[];
  threads: { id: string }[];
  bookings: { id: string }[];
  church_profiles: { church_name: string; city: string; state: string } | null;
};

type MusicianRow = {
  id: string;
  profile_id: string;
  city: string;
  state: string;
  instruments: string[];
  primary_instrument: string;
  available: boolean;
  rating: number;
  review_count: number;
  fee_min: number;
  fee_max: number;
  profiles: { display_name: string; email: string } | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function cityForRequest(row: RequestRow) {
  return (row.location_city || row.church_profiles?.city || "Unknown").trim() || "Unknown";
}

function requestUrgency(row: RequestRow, nowMs: number) {
  const daysOut = Math.ceil((new Date(`${row.service_date}T12:00:00`).getTime() - nowMs) / MS_PER_DAY);
  const applicantCount = row.applications.length;
  const threadCount = row.threads.length;
  let score = 0;
  if (daysOut <= 7) score += 4;
  else if (daysOut <= 14) score += 3;
  else if (daysOut <= 30) score += 1;
  if (applicantCount === 0) score += 3;
  else if (applicantCount === 1) score += 1;
  if (threadCount === 0) score += 1;
  return { score, daysOut };
}

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function musicianMatches(musician: MusicianRow, request: RequestRow | null, cityFilter: string, instrumentFilter: string) {
  const musicianCity = musician.city.toLowerCase();
  const musicianInstruments = [...musician.instruments, musician.primary_instrument].join(" ").toLowerCase();
  const requestCity = request ? cityForRequest(request).toLowerCase() : "";
  const requestInstrument = request?.instruments_needed[0]?.toLowerCase() ?? "";
  return (!cityFilter || musicianCity.includes(cityFilter))
    && (!instrumentFilter || musicianInstruments.includes(instrumentFilter))
    && (!request || !requestCity || musicianCity === requestCity || musician.state === (request.location_state || request.church_profiles?.state))
    && (!requestInstrument || musicianInstruments.includes(requestInstrument));
}

function defaultMessage(request: RequestRow) {
  const instrument = request.instruments_needed.join(", ") || "music";
  const date = new Date(`${request.service_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `Sunday Musician admin note: ${request.church_profiles?.church_name ?? "A church"} has an open ${instrument} request in ${cityForRequest(request)} on ${date}. Your profile looks like a strong fit. Reply here if you are available or have questions.`;
}

export default async function AdminMatchAssistPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const nowMs = now.getTime();
  const today = isoDay(now);
  const horizon = isoDay(new Date(nowMs + 60 * MS_PER_DAY));
  const cityFilter = normalize(params.city);
  const instrumentFilter = normalize(params.instrument);
  const admin = createAdminClient();

  const { data: requestRows } = await admin
    .from("service_requests")
    .select(`
      id, title, service_date, service_time, status, location_city, location_state,
      instruments_needed, offered_fee, fee_type, notes,
      applications ( id ),
      threads ( id ),
      bookings ( id ),
      church_profiles ( church_name, city, state )
    `)
    .in("status", ["open", "in_progress"])
    .gte("service_date", today)
    .lte("service_date", horizon)
    .order("service_date", { ascending: true })
    .limit(250);

  const openRequests = ((requestRows ?? []) as unknown as RequestRow[])
    .filter(r => r.bookings.length === 0)
    .map(r => ({ ...r, urgency: requestUrgency(r, nowMs) }))
    .filter(r => r.urgency.score >= 3 || r.applications.length < 2)
    .sort((a, b) => b.urgency.score - a.urgency.score || a.service_date.localeCompare(b.service_date));

  const selectedRequest = openRequests.find(r => r.id === params.request) ?? openRequests[0] ?? null;

  const [{ data: musicianRows }, { data: invitedRows }, { data: blockedRows }] = await Promise.all([
    admin
      .from("musician_profiles")
      .select(`
        id, profile_id, city, state, instruments, primary_instrument, available,
        rating, review_count, fee_min, fee_max,
        profiles ( display_name, email )
      `)
      .eq("available", true)
      .limit(400),
    selectedRequest
      ? admin.from("threads").select("musician_profile_id").eq("request_id", selectedRequest.id)
      : { data: [] as Array<{ musician_profile_id: string }> },
    selectedRequest
      ? admin
        .from("unavailability_blocks")
        .select("musician_profile_id")
        .lte("start_date", selectedRequest.service_date)
        .gte("end_date", selectedRequest.service_date)
      : { data: [] as Array<{ musician_profile_id: string }> },
  ]);

  const invitedIds = new Set((invitedRows ?? []).map(t => t.musician_profile_id));
  const blockedIds = new Set((blockedRows ?? []).map(b => b.musician_profile_id));
  const musicians = ((musicianRows ?? []) as unknown as MusicianRow[])
    .filter(m => !invitedIds.has(m.id))
    .filter(m => musicianMatches(m, selectedRequest, cityFilter, instrumentFilter))
    .sort((a, b) => {
      const aBlocked = blockedIds.has(a.id) ? 1 : 0;
      const bBlocked = blockedIds.has(b.id) ? 1 : 0;
      return aBlocked - bBlocked || b.rating - a.rating || b.review_count - a.review_count;
    })
    .slice(0, 80);

  const noApplicantCount = openRequests.filter(r => r.applications.length === 0).length;
  const weekCount = openRequests.filter(r => r.urgency.daysOut <= 7).length;

  return (
    <>
      <AdminTopbar title="Manual match assist" sub="Intervene on thin requests" />
      <div className="a-page">
        <div className="kpi-grid">
          <KpiCard label="Struggling requests" value={openRequests.length} context="open, unbooked, low activity" />
          <KpiCard label="No applicants" value={noApplicantCount} context="highest intervention priority" />
          <KpiCard label="Inside 7 days" value={weekCount} context="date pressure" />
          <KpiCard label="Candidate musicians" value={musicians.length} context="after current filters" />
        </div>

        <form className="a-table-toolbar" action="/admin/match" style={{ marginBottom: 18 }}>
          {selectedRequest && <input type="hidden" name="request" value={selectedRequest.id} />}
          <input className="input" name="city" placeholder="Musician city" defaultValue={params.city ?? ""} style={{ width: 190 }} />
          <input className="input" name="instrument" placeholder="Instrument" defaultValue={params.instrument ?? ""} style={{ width: 190 }} />
          <button className="btn btn--primary btn--sm" type="submit">Filter musicians</button>
          <Link className="btn btn--ghost btn--sm" href="/admin/match" style={{ textDecoration: "none" }}>Reset</Link>
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) minmax(0, 1fr)", gap: 18 }} className="a-split-grid">
          <div className="a-table-wrap">
            <div className="a-table-toolbar">
              <span className="count"><strong>{openRequests.length}</strong> requests</span>
            </div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Date</th>
                  <th className="num">Apps</th>
                </tr>
              </thead>
              <tbody>
                {openRequests.map(r => {
                  const active = selectedRequest?.id === r.id;
                  return (
                    <tr key={r.id} data-selected={active ? "true" : undefined}>
                      <td>
                        <Link href={`/admin/match?request=${r.id}`} style={{ fontWeight: 700, color: "var(--sm-fg-1)", textDecoration: "none" }}>{r.title}</Link>
                        <div className="secondary">{cityForRequest(r)} · {r.instruments_needed.join(", ") || "Unspecified"}</div>
                        <div style={{ marginTop: 5 }}>
                          <StatusPill tone={r.urgency.daysOut <= 7 ? "error" : r.applications.length === 0 ? "warn" : "info"}>
                            {r.urgency.daysOut <= 0 ? "Today" : `${r.urgency.daysOut}d out`}
                          </StatusPill>
                        </div>
                      </td>
                      <td><DateCell value={r.service_date} /></td>
                      <td className="num">{r.applications.length}</td>
                    </tr>
                  );
                })}
                {openRequests.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>No struggling requests.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="a-table-wrap">
            <div className="a-table-toolbar">
              <span className="count">
                {selectedRequest ? (
                  <><strong>{musicians.length}</strong> available musicians for <strong>{selectedRequest.title}</strong></>
                ) : "Select a request"}
              </span>
              {selectedRequest && (
                <div className="right">
                  <Link href={`/admin/liquidity?city=${encodeURIComponent(cityForRequest(selectedRequest))}&instrument=${encodeURIComponent(selectedRequest.instruments_needed[0] ?? "")}`} className="btn btn--ghost btn--sm" style={{ textDecoration: "none" }}>Liquidity view</Link>
                </div>
              )}
            </div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Musician</th>
                  <th>Location</th>
                  <th>Instruments</th>
                  <th>Rating</th>
                  <th>Availability</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {selectedRequest && musicians.map(m => {
                  const blocked = blockedIds.has(m.id);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{m.profiles?.display_name ?? "Musician"}</div>
                        <div className="secondary">{m.profiles?.email ?? "No email"}</div>
                        <div className="secondary">${m.fee_min}-{m.fee_max}</div>
                      </td>
                      <td>{m.city}, {m.state}</td>
                      <td>{(m.instruments.length ? m.instruments : [m.primary_instrument]).join(", ")}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{Number(m.rating).toFixed(1)}</div>
                        <div className="secondary">{m.review_count} reviews</div>
                      </td>
                      <td><StatusPill tone={blocked ? "warn" : "success"}>{blocked ? "Check calendar" : "Available"}</StatusPill></td>
                      <td>
                        <MatchAssistButton requestId={selectedRequest.id} musicianProfileId={m.id} defaultMessage={defaultMessage(selectedRequest)} />
                      </td>
                    </tr>
                  );
                })}
                {(!selectedRequest || musicians.length === 0) && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>No candidate musicians match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
