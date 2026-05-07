"use client";

import { useMemo, useState } from "react";

const INSTRUMENTS = [
  "Acoustic Guitar", "Electric Guitar", "Bass Guitar", "Piano / Keys", "Organ",
  "Drums", "Cajon / Hand Percussion", "Violin", "Viola", "Cello",
  "Trumpet", "Trombone", "Saxophone", "Flute", "Clarinet",
  "Lead Vocals", "Background Vocals", "Other",
];

const AV_COLORS = ["#f5d8b8","#d8e4f5","#d8f5dd","#f5d8d8","#ebd8f5","#f5ecd8"];
const AV_TEXT   = ["#8a5a05","#1159af","#13612e","#b82105","#5b1faf","#8a5a05"];

type Musician = {
  id: string;
  city: string;
  state: string;
  instruments: string[];
  primary_instrument: string;
  years_experience: number;
  is_volunteer: boolean;
  fee_min: number;
  fee_max: number;
  travel_radius_miles: number;
  bio: string;
  rating: number;
  review_count: number;
  available: boolean;
  profiles: { display_name: string } | null;
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("");
}

export function HomeClient({ musicians }: { musicians: Musician[] }) {
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return musicians.filter(m => {
      if (query) {
        const q = query.toLowerCase();
        if (
          !m.profiles?.display_name.toLowerCase().includes(q) &&
          !m.instruments.some(i => i.toLowerCase().includes(q))
        ) return false;
      }
      if (selectedInstruments.length > 0) {
        if (!selectedInstruments.some(sel =>
          m.instruments.some(mi => mi.toLowerCase().includes(sel.toLowerCase()))
        )) return false;
      }
      if (availableOnly && !m.available) return false;
      return true;
    });
  }, [musicians, query, selectedInstruments, availableOnly]);

  function toggleInstrument(i: string) {
    setSelectedInstruments(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  }

  const activeCount = [selectedInstruments.length > 0, availableOnly].filter(Boolean).length;

  return (
    <>
      <div className="sm-split sm-split--filter">

        {/* Filters */}
        <aside className="sm-find-filters" style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22, background: "var(--sm-bg-1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)" }}>
              Filters
              {activeCount > 0 && (
                <span style={{ marginLeft: 6, background: "var(--sm-accent)", color: "#fff", fontSize: 10.5, padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>
                  {activeCount}
                </span>
              )}
            </span>
            {activeCount > 0 && (
              <button onClick={() => { setSelectedInstruments([]); setAvailableOnly(false); }}
                style={{ background: "none", border: "none", fontSize: 12, color: "var(--sm-accent)", cursor: "pointer", padding: 0 }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--sm-fg-1)", cursor: "pointer" }}>
              <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} style={{ accentColor: "var(--sm-accent)" }} />
              Available now
            </label>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            Instrument
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {INSTRUMENTS.map(i => {
              const active = selectedInstruments.includes(i);
              return (
                <button key={i} type="button" onClick={() => toggleInstrument(i)} style={{
                  border: `1.5px solid ${active ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)", padding: "4px 10px",
                  background: active ? "rgba(228,123,2,0.07)" : "var(--sm-bg-1)",
                  cursor: "pointer", fontSize: 12.5,
                  color: active ? "var(--sm-accent)" : "var(--sm-fg-2)",
                  fontWeight: active ? 600 : 400,
                }}>
                  {i}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Results */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--sm-fg-4)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input className="input" style={{ paddingLeft: 34 }} placeholder="Search by name or instrument"
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <span style={{ fontSize: 14, color: "var(--sm-fg-3)" }}>
              <strong style={{ color: "var(--sm-fg-1)" }}>{filtered.length}</strong> musicians
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)", background: "var(--sm-bg-1)" }}>
              <p style={{ margin: "0 0 14px" }}>No musicians match those filters.</p>
              <button className="btn btn--ghost btn--sm" onClick={() => { setSelectedInstruments([]); setAvailableOnly(false); setQuery(""); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
              {filtered.map(m => {
                const name = m.profiles?.display_name ?? "Musician";
                const idx = m.id.charCodeAt(0) % 6;
                const feeLabel = m.is_volunteer ? "Volunteer" : m.fee_min > 0 ? `$${m.fee_min}–$${m.fee_max}` : "";
                return (
                  <div
                    key={m.id}
                    onClick={() => setModalOpen(true)}
                    style={{
                      border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)",
                      padding: 20, background: "var(--sm-bg-1)", display: "flex", flexDirection: "column",
                      gap: 12, cursor: "pointer",
                      transition: "border-color var(--sm-dur-base) var(--sm-ease), box-shadow var(--sm-dur-base) var(--sm-ease)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--sm-accent)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(228,123,2,0.08)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--sm-border-subtle)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                      <div style={{ width: 52, height: 52, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 17, color: AV_TEXT[idx], flexShrink: 0 }}>
                        {initials(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--sm-fg-1)" }}>{name}</div>
                        <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 2 }}>{m.city}, {m.state}</div>
                        {m.years_experience > 0 && (
                          <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 3 }}>
                            {m.rating > 0 && <span style={{ color: "var(--sm-accent)", marginRight: 6 }}>★ {m.rating}</span>}
                            {m.years_experience} yrs exp
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--sm-border-subtle)", fontSize: 13, marginTop: "auto" }}>
                      <span style={{ color: m.available ? "var(--sm-status-success)" : "var(--sm-fg-4)", fontWeight: 500 }}>
                        {m.available ? "● Available" : "○ Not available"}
                      </span>
                      {feeLabel && (
                        <span style={{ color: m.is_volunteer ? "var(--sm-status-success)" : "var(--sm-fg-2)", fontWeight: 500 }}>
                          {feeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sign-up modal */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--sm-bg-1)", borderRadius: "var(--sm-radius-sm)",
              padding: "40px 36px", maxWidth: 420, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--sm-fg-4)", fontSize: 20, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>

            <div style={{ width: 48, height: 48, borderRadius: "var(--sm-radius-sm)", background: "rgba(228,123,2,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sm-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em", color: "var(--sm-fg-1)" }}>
              Create a free account
            </h2>
            <p style={{ fontSize: 14.5, color: "var(--sm-fg-3)", margin: "0 0 28px", lineHeight: 1.6 }}>
              Sign up to view full musician profiles, send messages, and post or respond to service requests.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="/auth/signup?role=church" className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none", padding: "11px 20px", fontSize: 14.5 }}>
                Join as a church
              </a>
              <a href="/auth/signup?role=musician" className="btn btn--secondary" style={{ textAlign: "center", textDecoration: "none", padding: "11px 20px", fontSize: 14.5 }}>
                Join as a musician
              </a>
            </div>

            <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 13, color: "var(--sm-fg-4)" }}>
              Already have an account?{" "}
              <a href="/auth/login" style={{ color: "var(--sm-accent)", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
