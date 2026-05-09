"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OpenRequest, MusicianMeta } from "./page";
import { INSTRUMENT_OPTIONS, instrumentsOverlap, uniqueInstruments } from "@/lib/instruments";

export function OpenRequestsClient({
  requests,
  musicianMeta,
}: {
  requests: OpenRequest[];
  musicianMeta: MusicianMeta;
}) {
  const [instrFilter, setInstrFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [areaOnly, setAreaOnly] = useState(musicianMeta.state !== "");

  const myInstrumentList = uniqueInstruments(musicianMeta.instruments);
  const myInstruments = new Set(myInstrumentList);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (instrFilter.length > 0) {
        if (!instrumentsOverlap(instrFilter, r.instruments_needed)) return false;
      }
      if (dateFilter) {
        if (r.service_date !== dateFilter) return false;
      }
      if (areaOnly && musicianMeta.state) {
        if (r.church_state.toLowerCase() !== musicianMeta.state.toLowerCase()) return false;
      }
      return true;
    });
  }, [requests, instrFilter, dateFilter, areaOnly, musicianMeta.state]);

  // Separate matched (overlaps musician's own instruments) from others
  const matched = filtered.filter(r =>
    r.instruments_needed.length === 0 ||
    instrumentsOverlap(r.instruments_needed, myInstrumentList)
  );
  const others = filtered.filter(r =>
    r.instruments_needed.length > 0 &&
    !instrumentsOverlap(r.instruments_needed, myInstrumentList)
  );

  function toggleInstr(i: string) {
    setInstrFilter(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  const activeCount = instrFilter.length + (dateFilter ? 1 : 0) + (areaOnly ? 1 : 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, padding: "24px 32px 80px", alignItems: "start" }}>

      {/* ── Filters ── */}
      <aside style={{ position: "sticky", top: 90 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)" }}>
            Filters {activeCount > 0 && <span style={{ marginLeft: 4, background: "var(--sm-accent)", color: "#fff", fontSize: 10.5, padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>{activeCount}</span>}
          </span>
          {activeCount > 0 && (
            <button onClick={() => { setInstrFilter([]); setDateFilter(""); setAreaOnly(false); }}
              style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--sm-accent)", cursor: "pointer", fontWeight: 500 }}>
              Clear all
            </button>
          )}
        </div>

        {/* Area filter */}
        {musicianMeta.state && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Area</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--sm-fg-1)", cursor: "pointer" }}>
              <input type="checkbox" checked={areaOnly} onChange={e => setAreaOnly(e.target.checked)} style={{ accentColor: "var(--sm-accent)" }} />
              My state ({musicianMeta.state})
            </label>
          </div>
        )}

        {/* Date filter */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Date</div>
          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ fontSize: 13.5, padding: "6px 10px", width: "100%" }}
          />
          {dateFilter && (
            <button onClick={() => setDateFilter("")}
              style={{ background: "none", border: "none", padding: "4px 0 0", fontSize: 12, color: "var(--sm-accent)", cursor: "pointer" }}>
              Clear date
            </button>
          )}
        </div>

        {/* Instrument filter — only show musician's own instruments if they have any */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Instrument</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(myInstrumentList.length > 0 ? myInstrumentList : INSTRUMENT_OPTIONS).map(i => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: instrFilter.includes(i) ? "var(--sm-fg-1)" : "var(--sm-fg-2)", cursor: "pointer", fontWeight: instrFilter.includes(i) ? 600 : 400 }}>
                <input
                  type="checkbox"
                  checked={instrFilter.includes(i)}
                  onChange={() => toggleInstr(i)}
                  style={{ accentColor: "var(--sm-accent)" }}
                />
                {i}
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Results ── */}
      <div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>No matching requests</h3>
            <p style={{ margin: 0, fontSize: 14 }}>Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {matched.length > 0 && (
              <Section
                label={`Matching your instruments (${matched.length})`}
                accent
                requests={matched}
                myInstruments={myInstruments}
              />
            )}
            {others.length > 0 && (
              <Section
                label={`Other open requests (${others.length})`}
                requests={others}
                myInstruments={myInstruments}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, requests, myInstruments, accent }: {
  label: string;
  requests: OpenRequest[];
  myInstruments: Set<string>;
  accent?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: accent ? "var(--sm-accent)" : "var(--sm-fg-3)", marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map(r => <RequestCard key={r.id} r={r} myInstruments={myInstruments} />)}
      </div>
    </div>
  );
}

function RequestCard({ r, myInstruments }: { r: OpenRequest; myInstruments: Set<string> }) {
  const d = new Date(r.service_date + "T12:00:00");
  const location = [r.church_city, r.church_state].filter(Boolean).join(", ");

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center",
      padding: "18px 22px", border: "1px solid var(--sm-border-subtle)",
      borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)",
    }}>
      {/* Date block */}
      <div style={{ textAlign: "center", paddingRight: 20, borderRight: "1px solid var(--sm-border-subtle)", minWidth: 64 }}>
        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
          {d.toLocaleDateString("en-US", { month: "short" })}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 2 }}>
          {d.getDate()}
        </div>
        <div style={{ fontSize: 11, color: "var(--sm-fg-3)", marginTop: 2 }}>
          {d.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
      </div>

      {/* Info */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 3 }}>{r.title}</div>
        <div style={{ fontSize: 13, color: "var(--sm-fg-3)", display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontWeight: 500, color: "var(--sm-fg-2)" }}>{r.church_name}</span>
          {location && <span>· {location}</span>}
          <span>· {r.service_type}</span>
          {r.offered_fee != null && <span>· ${r.offered_fee} {r.fee_type.toLowerCase()}</span>}
        </div>
        {r.instruments_needed.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.instruments_needed.map(i => (
              <span key={i} className={myInstruments.has(i) ? "chip chip--accent" : "chip"}>
                {i}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
        <Link href={`/requests/${r.id}`} className="btn btn--primary btn--sm">View request</Link>
        <Link href={`/messages?church_id=${r.church_profile_id}&request_id=${r.id}`} className="btn btn--ghost btn--sm">Message church</Link>
      </div>
    </div>
  );
}
