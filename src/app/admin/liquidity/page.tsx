import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { DateCell, KpiCard, StatusPill } from "../_components/AdminPrimitives";

export const dynamic = "force-dynamic";

type SearchParams = {
  city?: string;
  instrument?: string;
  from?: string;
  to?: string;
  sort?: string;
};

type RequestRow = {
  id: string;
  title: string;
  service_date: string;
  status: "open" | "in_progress" | "filled" | "cancelled";
  location_city: string | null;
  location_state: string | null;
  instruments_needed: string[];
  offered_fee: number | null;
  fee_type: string;
  created_at: string;
  applications: { id: string }[];
  bookings: { id: string }[];
  church_profiles: { church_name: string; city: string; state: string } | null;
};

type MusicianRow = {
  id: string;
  city: string;
  state: string;
  instruments: string[];
  primary_instrument: string;
  available: boolean;
  rating: number;
  review_count: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function cityForRequest(row: RequestRow) {
  return (row.location_city || row.church_profiles?.city || "Unknown").trim() || "Unknown";
}

function stateForRequest(row: RequestRow) {
  return (row.location_state || row.church_profiles?.state || "").trim();
}

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntries(map: Map<string, number>, limit = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function BarList({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <div style={{ display: "grid", gap: 9 }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--sm-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            <span className="a-num" style={{ color: "var(--sm-fg-3)" }}>{value}</span>
          </div>
          <div style={{ height: 8, background: "var(--sm-bg-3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct(value, total)}%`, height: "100%", background: "var(--sm-accent)" }} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="secondary" style={{ fontSize: 13 }}>No rows for this filter.</div>}
    </div>
  );
}

export default async function AdminLiquidityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = isoDay(new Date(now.getTime() - 30 * MS_PER_DAY));
  const defaultTo = isoDay(new Date(now.getTime() + 60 * MS_PER_DAY));
  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  const cityFilter = normalize(params.city);
  const instrumentFilter = normalize(params.instrument);
  const sort = params.sort ?? "date";

  const admin = createAdminClient();
  const [requestsRes, musiciansRes] = await Promise.all([
    admin
      .from("service_requests")
      .select(`
        id, title, service_date, status, location_city, location_state, instruments_needed,
        offered_fee, fee_type, created_at,
        applications ( id ),
        bookings ( id ),
        church_profiles ( church_name, city, state )
      `)
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date", { ascending: true })
      .limit(1000),
    admin
      .from("musician_profiles")
      .select("id, city, state, instruments, primary_instrument, available, rating, review_count")
      .eq("available", true)
      .limit(1000),
  ]);

  const allRequests = ((requestsRes.data ?? []) as unknown as RequestRow[]);
  const allMusicians = ((musiciansRes.data ?? []) as MusicianRow[]);
  const requests = allRequests.filter(r => {
    const city = cityForRequest(r).toLowerCase();
    const instruments = r.instruments_needed.join(" ").toLowerCase();
    return (!cityFilter || city.includes(cityFilter))
      && (!instrumentFilter || instruments.includes(instrumentFilter));
  });
  const musicians = allMusicians.filter(m => {
    const city = m.city.toLowerCase();
    const instruments = [...m.instruments, m.primary_instrument].join(" ").toLowerCase();
    return (!cityFilter || city.includes(cityFilter))
      && (!instrumentFilter || instruments.includes(instrumentFilter));
  });

  const requestCity = new Map<string, number>();
  const requestInstrument = new Map<string, number>();
  const requestDate = new Map<string, number>();
  const musicianCityInstrument = new Map<string, number>();
  const cityInstrumentDemand = new Map<string, number>();

  for (const request of requests) {
    const city = cityForRequest(request);
    inc(requestCity, city);
    inc(requestDate, request.service_date);
    for (const instrument of request.instruments_needed.length ? request.instruments_needed : ["Unspecified"]) {
      inc(requestInstrument, instrument);
      inc(cityInstrumentDemand, `${city}|||${instrument}`);
    }
  }
  for (const musician of musicians) {
    const instruments = musician.instruments.length ? musician.instruments : [musician.primary_instrument || "Unspecified"];
    for (const instrument of instruments) inc(musicianCityInstrument, `${musician.city || "Unknown"}|||${instrument}`);
  }

  const unfilled = requests.filter(r => r.bookings.length === 0 && ["open", "in_progress"].includes(r.status));
  const thinCells = [...cityInstrumentDemand.entries()]
    .map(([key, demand]) => {
      const supply = musicianCityInstrument.get(key) ?? 0;
      const [city, instrument] = key.split("|||");
      return { city, instrument, demand, supply, gap: demand - supply };
    })
    .sort((a, b) => b.gap - a.gap || b.demand - a.demand)
    .slice(0, 16);

  const sortedUnfilled = [...unfilled].sort((a, b) => {
    if (sort === "city") return cityForRequest(a).localeCompare(cityForRequest(b));
    if (sort === "instrument") return (a.instruments_needed[0] ?? "").localeCompare(b.instruments_needed[0] ?? "");
    if (sort === "applications") return a.applications.length - b.applications.length;
    return a.service_date.localeCompare(b.service_date);
  });

  const totalRequests = requests.length;
  const totalMusicians = musicians.length;
  const totalDemand = [...requestCity.values()].reduce((s, v) => s + v, 0);
  const totalInstrumentDemand = [...requestInstrument.values()].reduce((s, v) => s + v, 0);

  return (
    <>
      <AdminTopbar title="Liquidity dashboard" sub="Marketplace supply and demand" />
      <div className="a-page">
        <form className="a-table-toolbar" style={{ marginBottom: 18 }} action="/admin/liquidity">
          <input className="input" name="city" placeholder="City" defaultValue={params.city ?? ""} style={{ width: 180 }} />
          <input className="input" name="instrument" placeholder="Instrument" defaultValue={params.instrument ?? ""} style={{ width: 190 }} />
          <input className="input" type="date" name="from" defaultValue={from} style={{ width: 150 }} />
          <input className="input" type="date" name="to" defaultValue={to} style={{ width: 150 }} />
          <select className="input" name="sort" defaultValue={sort} style={{ width: 150 }}>
            <option value="date">Sort by date</option>
            <option value="city">Sort by city</option>
            <option value="instrument">Sort by instrument</option>
            <option value="applications">Fewest applicants</option>
          </select>
          <button className="btn btn--primary btn--sm" type="submit">Filter</button>
          <Link className="btn btn--ghost btn--sm" href="/admin/liquidity" style={{ textDecoration: "none" }}>Reset</Link>
        </form>

        <div className="kpi-grid">
          <KpiCard label="Requests" value={totalRequests} context={`${from} to ${to}`} />
          <KpiCard label="Available musicians" value={totalMusicians} context="matching current filters" />
          <KpiCard label="Unfilled requests" value={unfilled.length} context={`${pct(unfilled.length, totalRequests)}% of visible demand`} />
          <KpiCard label="Thin city/instrument cells" value={thinCells.filter(c => c.gap > 0).length} context="demand exceeds listed supply" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 18 }} className="a-responsive-grid">
          <section className="chart-card">
            <h3>Requests by city</h3>
            <div className="sub">Where demand is clustering</div>
            <BarList rows={topEntries(requestCity)} total={Math.max(totalDemand, 1)} />
          </section>
          <section className="chart-card">
            <h3>Requests by instrument</h3>
            <div className="sub">Top requested roles</div>
            <BarList rows={topEntries(requestInstrument)} total={Math.max(totalInstrumentDemand, 1)} />
          </section>
          <section className="chart-card">
            <h3>Requests by date</h3>
            <div className="sub">Upcoming demand spikes</div>
            <BarList rows={topEntries(requestDate, 12)} total={Math.max(totalDemand, 1)} />
          </section>
        </div>

        <div className="chart-card" style={{ marginBottom: 18 }}>
          <h3>Supply heatmap</h3>
          <div className="sub">Darker cells need manual sourcing or recruiting</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {thinCells.map(cell => {
              const urgent = cell.gap > 0;
              return (
                <div key={`${cell.city}-${cell.instrument}`} style={{
                  border: "1px solid var(--sm-border-subtle)",
                  borderRadius: 3,
                  padding: 12,
                  background: urgent ? `rgba(184,33,5,${Math.min(0.08 + cell.gap * 0.04, 0.28)})` : "var(--sm-bg-2)",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{cell.city}</div>
                  <div style={{ color: "var(--sm-fg-3)", fontSize: 12.5, marginTop: 2 }}>{cell.instrument}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 9, fontSize: 12 }}>
                    <span><strong>{cell.demand}</strong> requests</span>
                    <span><strong>{cell.supply}</strong> musicians</span>
                    <StatusPill tone={urgent ? "error" : "success"}>{urgent ? `${cell.gap} gap` : "Covered"}</StatusPill>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="a-table-wrap">
          <div className="a-table-toolbar">
            <span className="count"><strong>{sortedUnfilled.length}</strong> unfilled requests</span>
            <div className="right">
              <Link className="btn btn--ghost btn--sm" href="/admin/match" style={{ textDecoration: "none" }}>Open match assist</Link>
            </div>
          </div>
          <table className="a-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>City</th>
                <th>Instrument</th>
                <th>Date</th>
                <th>Status</th>
                <th className="num">Applicants</th>
                <th className="num">Supply</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedUnfilled.map(r => {
                const city = cityForRequest(r);
                const instrument = r.instruments_needed[0] ?? "Unspecified";
                const supply = musicianCityInstrument.get(`${city}|||${instrument}`) ?? 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div className="secondary">{r.church_profiles?.church_name ?? "Church"}</div>
                    </td>
                    <td>{city}{stateForRequest(r) ? `, ${stateForRequest(r)}` : ""}</td>
                    <td>{r.instruments_needed.join(", ") || "Unspecified"}</td>
                    <td><DateCell value={r.service_date} /></td>
                    <td><StatusPill tone={r.status === "open" ? "info" : "warn"}>{r.status.replace("_", " ")}</StatusPill></td>
                    <td className="num">{r.applications.length}</td>
                    <td className="num">{supply}</td>
                    <td><Link href={`/admin/match?request=${r.id}`} className="btn btn--ghost btn--sm" style={{ textDecoration: "none" }}>Assist</Link></td>
                  </tr>
                );
              })}
              {sortedUnfilled.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>No unfilled requests match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
