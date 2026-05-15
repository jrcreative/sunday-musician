"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { VerifiedAddressInput, type VerifiedAddressValue } from "@/components/VerifiedAddressInput";
import { INSTRUMENT_OPTIONS, instrumentsIncludeAll } from "@/lib/instruments";
import { distanceMiles } from "@/lib/locations/distance";

const DISTANCE_OPTIONS = [
  { value: 10,   label: "Within 10 miles" },
  { value: 25,   label: "Within 25 miles" },
  { value: 50,   label: "Within 50 miles" },
  { value: 100,  label: "Within 100 miles" },
  { value: 9999, label: "Any distance" },
];

type Musician = {
  id: string;
  profile_id: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  instruments: string[];
  primary_instrument: string;
  is_volunteer: boolean;
  fee_min: number;
  fee_max: number;
  travel_radius_miles: number;
  bio: string;
  rating: number;
  review_count: number;
  available: boolean;
  profiles: { display_name: string; avatar_url: string | null } | null;
};
type ViewerLocation = {
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
  address_verified_at: string | null;
};
export function FindMusiciansClient({
  musicians,
  viewerLocation,
  isChurch,
  blocks,
}: {
  musicians: Musician[];
  viewerLocation: ViewerLocation | null;
  isChurch: boolean;
  blocks: { musician_profile_id: string; start_date: string; end_date: string }[];
}) {
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [dateNeeded, setDateNeeded] = useState("");
  const [maxDistance, setMaxDistance] = useState(9999);
  const [query, setQuery] = useState("");
  const [useCustomOrigin, setUseCustomOrigin] = useState(false);
  const [originSearch, setOriginSearch] = useState("");
  const [customOrigin, setCustomOrigin] = useState<VerifiedAddressValue | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeOrigin = useMemo(() => {
    if (useCustomOrigin && customOrigin) {
      return {
        lat: customOrigin.lat,
        lng: customOrigin.lng,
        city: customOrigin.city,
        state: customOrigin.state,
        label: customOrigin.formattedAddress,
      };
    }
    if (!viewerLocation) return null;
    return {
      lat: viewerLocation.lat,
      lng: viewerLocation.lng,
      city: viewerLocation.city,
      state: viewerLocation.state,
      label: viewerLocation.formatted_address ?? [viewerLocation.city, viewerLocation.state].filter(Boolean).join(", "),
    };
  }, [customOrigin, useCustomOrigin, viewerLocation]);

  const activeFilterCount = [
    selectedInstruments.length > 0,
    dateNeeded !== "",
    maxDistance !== 9999,
    useCustomOrigin && !!customOrigin,
  ].filter(Boolean).length;

  // Map musicianId → list of blocked ranges, for fast date checks.
  const blocksByMusician = useMemo(() => {
    const map = new Map<string, { start_date: string; end_date: string }[]>();
    for (const b of blocks) {
      const arr = map.get(b.musician_profile_id) ?? [];
      arr.push({ start_date: b.start_date, end_date: b.end_date });
      map.set(b.musician_profile_id, arr);
    }
    return map;
  }, [blocks]);

  const filtered = useMemo(() => {
    return musicians.filter(m => {
      // Master toggle: unavailable musicians never appear in browse.
      if (!m.available) return false;
      if (query) {
        const q = query.toLowerCase();
        const nameMatch = m.profiles?.display_name.toLowerCase().includes(q);
        const instrMatch = m.instruments.some(i => i.toLowerCase().includes(q));
        if (!nameMatch && !instrMatch) return false;
      }
      if (selectedInstruments.length > 0) {
        if (!instrumentsIncludeAll(selectedInstruments, [m.primary_instrument, ...m.instruments].filter(Boolean))) return false;
      }
      if (dateNeeded) {
        const ranges = blocksByMusician.get(m.id) ?? [];
        if (ranges.some(r => dateNeeded >= r.start_date && dateNeeded <= r.end_date)) return false;
      }
      if (maxDistance !== 9999) {
        const distance = activeOrigin ? distanceMiles(activeOrigin, { lat: m.lat, lng: m.lng }) : null;
        if (distance == null) {
          const radius = m.travel_radius_miles ?? 0;
          if (radius < maxDistance && radius !== 9999) return false;
        } else if (distance > maxDistance) {
          return false;
        }
      }
      if (isChurch && activeOrigin) {
        const distance = distanceMiles(activeOrigin, { lat: m.lat, lng: m.lng });
        if (distance == null) {
          if (m.state.toLowerCase() !== activeOrigin.state.toLowerCase()) return false;
        } else if (distance > (m.travel_radius_miles || 0)) {
          return false;
        }
      }
      return true;
    });
  }, [musicians, query, selectedInstruments, dateNeeded, maxDistance, blocksByMusician, isChurch, activeOrigin]);

  function toggleInstrument(i: string) {
    setSelectedInstruments(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  }

  function clearAll() {
    setSelectedInstruments([]);
    setDateNeeded("");
    setMaxDistance(9999);
    setQuery("");
    setUseCustomOrigin(false);
    setCustomOrigin(null);
  }

  function clearCustomOriginVerification() {
    setCustomOrigin(null);
  }

  const locationLabel = isChurch ? "Your church" : "Your location";

  return (
    <div className="page">
      <div className="sm-find-mobile-bar">
        <button type="button" className="sm-find-filter-pill" onClick={() => setFiltersOpen(true)}>
          Filters
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
        <div className="sm-find-mobile-count">
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "musician" : "musicians"}
        </div>
      </div>
      {filtersOpen && <button type="button" className="sm-find-filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
      <div className="sm-split sm-split--with-rail">

        {/* Filter sidebar */}
        <aside className={`sm-find-filters ${filtersOpen ? "sm-find-filters--open" : ""}`} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22, background: "var(--sm-bg-1)" }}>
          <div className="sm-find-filter-sheet-header">
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">×</button>
            <div>Filters</div>
            <button type="button" onClick={clearAll} disabled={activeFilterCount === 0}>Reset</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)" }}>
              Filters
              {activeFilterCount > 0 && (
                <span style={{ marginLeft: 8, background: "var(--sm-accent)", color: "#fff", fontSize: 11, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--sm-fg-3)", padding: 0 }}>
                Clear all
              </button>
            )}
          </div>

          {viewerLocation && (viewerLocation.city || viewerLocation.state) && (
            <div style={{ marginBottom: 16, padding: "8px 10px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", fontSize: 12.5, color: "var(--sm-fg-3)" }}>
              {locationLabel}: {activeOrigin?.label ?? [viewerLocation.city, viewerLocation.state].filter(Boolean).join(", ")}
            </div>
          )}

          {isChurch && (
            <FilterSection label="Search location">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", color: "var(--sm-fg-2)" }}>
                <input type="checkbox" checked={useCustomOrigin} onChange={e => setUseCustomOrigin(e.target.checked)} />
                Search from another service location
              </label>
              {useCustomOrigin && (
                <div style={{ marginTop: 10 }}>
                  <VerifiedAddressInput
                    id="searchOrigin"
                    label="Service location"
                    value={originSearch}
                    verifiedAddress={customOrigin}
                    placeholder="123 Venue St, Austin, TX 78701"
                    help="Verified locations make distance filtering more accurate."
                    onValueChange={setOriginSearch}
                    onVerified={setCustomOrigin}
                    onClear={clearCustomOriginVerification}
                  />
                </div>
              )}
            </FilterSection>
          )}

          {/* Instrument */}
          <FilterSection label="Instrument">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {INSTRUMENT_OPTIONS.map(i => {
                const active = selectedInstruments.includes(i);
                return (
                  <button key={i} type="button" onClick={() => toggleInstrument(i)} style={{
                    border: `1.5px solid ${active ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                    borderRadius: "var(--sm-radius-sm)", padding: "4px 10px",
                    background: active ? "rgba(228,123,2,0.07)" : "var(--sm-bg-1)",
                    cursor: "pointer", fontSize: 12.5,
                    color: active ? "var(--sm-accent)" : "var(--sm-fg-2)",
                    fontWeight: active ? 600 : 400,
                  }}>{i}</button>
                );
              })}
            </div>
          </FilterSection>

          {/* Date available */}
          <FilterSection label="Date needed">
            <input
              type="date"
              className="input"
              value={dateNeeded}
              onChange={e => setDateNeeded(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            {dateNeeded && (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--sm-fg-4)", lineHeight: 1.4 }}>
                Hides musicians blocked on this date
              </p>
            )}
          </FilterSection>

          {/* Distance */}
          <FilterSection label={`Distance from ${isChurch ? "service location" : "you"}`} noBorder>
            <select className="select" value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value))}>
              {DISTANCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {maxDistance !== 9999 && (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--sm-fg-4)", lineHeight: 1.4 }}>
                Shows musicians within {maxDistance} miles of the search location
              </p>
            )}
          </FilterSection>
          <div className="sm-find-filter-sheet-actions">
            <button type="button" className="btn btn--primary" onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} {filtered.length === 1 ? "musician" : "musicians"}
            </button>
          </div>
        </aside>

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Search bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 380, minWidth: 220 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--sm-fg-4)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by name or instrument"
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <span style={{ fontSize: 14, color: "var(--sm-fg-2)" }}>
              <strong style={{ color: "var(--sm-fg-1)" }}>{filtered.length}</strong> {filtered.length === 1 ? "musician" : "musicians"}
            </span>
          </div>

          {/* Active filter chips */}
          {(selectedInstruments.length > 0 || dateNeeded || maxDistance !== 9999) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>Filtering by:</span>
              {selectedInstruments.map(i => (
                <ActiveChip key={i} label={i} onRemove={() => toggleInstrument(i)} />
              ))}
              {dateNeeded && (
                <ActiveChip label={`Available ${dateNeeded}`} onRemove={() => setDateNeeded("")} />
              )}
              {maxDistance !== 9999 && (
                <ActiveChip label={`Within ${maxDistance} mi`} onRemove={() => setMaxDistance(9999)} />
              )}
            </div>
          )}

          {/* Cards */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
              <h3 style={{ color: "var(--sm-fg-1)", margin: "0 0 8px", fontSize: 18 }}>No musicians match those filters</h3>
              <p style={{ margin: "0 0 18px" }}>Try widening your distance or removing a filter.</p>
              <button className="btn btn--secondary" onClick={clearAll}>Clear filters</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))", gap: 18 }}>
              {filtered.map(m => {
                const name = m.profiles?.display_name ?? "Musician";
                const idx = m.id.charCodeAt(0) % 6;
                const feeLabel = m.is_volunteer ? "Volunteer" : `$${m.fee_min}–$${m.fee_max}`;
                return (
                  <Link key={m.id} href={`/musicians/${m.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)",
                      padding: 20, background: "var(--sm-bg-1)", display: "flex", flexDirection: "column",
                      gap: 12, cursor: "pointer", height: "100%",
                    }}>
                      <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                        <Avatar src={m.profiles?.avatar_url} name={name} size={52} colorIndex={idx} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--sm-fg-1)" }}>{name}</div>
                          <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 2 }}>{m.city}, {m.state}</div>
                          {m.rating > 0 && (
                            <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 3 }}>
                              <span style={{ color: "var(--sm-accent)" }}>★ {m.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {m.instruments.slice(0, 3).map(i => <span key={i} className="chip">{i}</span>)}
                        {m.instruments.length > 3 && <span className="chip">+{m.instruments.length - 3}</span>}
                      </div>
                      {m.bio && (
                        <p style={{ fontSize: 13, color: "var(--sm-fg-2)", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {m.bio}
                        </p>
                      )}
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--sm-border-subtle)", fontSize: 13, marginTop: "auto" }}>
                        <span style={{ color: m.is_volunteer ? "var(--sm-status-success)" : "var(--sm-fg-2)", fontWeight: 500 }}>
                          {feeLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({ label, children, noBorder }: { label: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{ padding: "14px 0", borderTop: noBorder ? "none" : "1px solid var(--sm-border-subtle)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--sm-fg-1)" }}>{label}</div>
      {children}
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip chip--accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", lineHeight: 1 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </span>
  );
}
