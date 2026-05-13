"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { INSTRUMENT_OPTIONS, uniqueInstruments } from "@/lib/instruments";
import { scoreRequestQuality } from "@/lib/requests/quality";
import { formatServiceTimeRange, getBrowserTimeZone, normalizeServiceTimeForInput } from "@/lib/requests/time";
import { RequestQualityCard } from "../RequestQualityCard";
import { VerifiedAddressInput, type VerifiedAddressValue } from "@/components/VerifiedAddressInput";

const SERVICE_TYPES = [
  "Sunday morning",
  "Sunday evening",
  "Wednesday service",
  "Special service",
  "Funeral",
  "Wedding",
  "Conference / retreat",
  "Christmas / Easter",
];

const TECH_SETUP = [
  "In-ear monitors",
  "Wedge monitors",
  "Click track",
  "Charts provided",
  "House piano/keys",
  "House drum kit",
  "House bass amp",
  "Direct boxes available",
];

const STEPS = ["Service details", "Musician needs", "Logistics & fee", "Review"];

type FormData = {
  title: string;
  serviceType: string;
  date: string;
  time: string;
  endTime: string;
  useChurchLocation: boolean;
  locationAddress: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  locationFormattedAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  hasRehearsal: boolean;
  rehearsalDate: string;
  rehearsalStartTime: string;
  rehearsalEndTime: string;
  rehearsalNotes: string;
  instruments: string[];
  rehearsals: string;
  setlistUrl: string;
  techSetup: string[];
  fee: string;
  feeType: string;
  notes: string;
};

type ExistingRequest = {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  service_time: string | null;
  service_end_time?: string | null;
  service_timezone?: string | null;
  use_church_location?: boolean;
  location_address?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_formatted_address?: string | null;
  location_verified_at?: string | null;
  instruments_needed: string[];
  rehearsals: string | null;
  setlist_url: string | null;
  tech_setup: string[];
  offered_fee: number | null;
  fee_type: string;
  notes: string | null;
};

type ChurchLocation = {
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
  address_verified_at: string | null;
} | null;

/**
 * Encodes structured rehearsal date/time into the rehearsals string field.
 * Format: "REHEARSAL_DATE:<date>|REHEARSAL_START:<start>|REHEARSAL_END:<end>|NOTES:<notes>"
 * or "None" when there is no rehearsal.
 */
function encodeRehearsalString(hasRehearsal: boolean, date: string, start: string, end: string, notes: string): string {
  if (!hasRehearsal) return "None — show up Sunday morning";
  const parts: string[] = [];
  if (date) parts.push(`REHEARSAL_DATE:${date}`);
  if (start) parts.push(`REHEARSAL_START:${start}`);
  if (end) parts.push(`REHEARSAL_END:${end}`);
  if (notes.trim()) parts.push(`NOTES:${notes.trim()}`);
  return parts.length ? parts.join("|") : "Rehearsal — details TBD";
}

/**
 * Parses a rehearsals string back into structured fields.
 */
function decodeRehearsalString(raw: string | null | undefined): {
  hasRehearsal: boolean;
  rehearsalDate: string;
  rehearsalStartTime: string;
  rehearsalEndTime: string;
  rehearsalNotes: string;
} {
  const s = raw ?? "";
  if (!s || s.startsWith("None")) {
    return { hasRehearsal: false, rehearsalDate: "", rehearsalStartTime: "", rehearsalEndTime: "", rehearsalNotes: "" };
  }
  if (!s.includes("REHEARSAL_DATE:") && !s.includes("REHEARSAL_START:")) {
    // Legacy free-text entry — preserve as notes
    return { hasRehearsal: true, rehearsalDate: "", rehearsalStartTime: "", rehearsalEndTime: "", rehearsalNotes: s };
  }
  const get = (key: string) => {
    const match = s.match(new RegExp(`${key}:([^|]*)`));
    return match ? match[1].trim() : "";
  };
  return {
    hasRehearsal: true,
    rehearsalDate: get("REHEARSAL_DATE"),
    rehearsalStartTime: get("REHEARSAL_START"),
    rehearsalEndTime: get("REHEARSAL_END"),
    rehearsalNotes: get("NOTES"),
  };
}

export function NewRequestForm({
  existingRequest,
  churchLocation,
}: {
  existingRequest?: ExistingRequest;
  churchLocation?: ChurchLocation;
}) {
  const router = useRouter();
  const isEditing = !!existingRequest;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<FormData>(() => {
    if (existingRequest) {
      const decoded = decodeRehearsalString(existingRequest.rehearsals);
      return {
        title: existingRequest.title,
        serviceType: existingRequest.service_type,
        date: existingRequest.service_date,
        time: normalizeServiceTimeForInput(existingRequest.service_time) || "10:00",
        endTime: normalizeServiceTimeForInput(existingRequest.service_end_time),
        useChurchLocation: existingRequest.use_church_location ?? true,
        locationAddress: existingRequest.location_address ?? "",
        locationCity: existingRequest.location_city ?? "",
        locationState: existingRequest.location_state ?? "",
        locationZip: existingRequest.location_zip ?? "",
        locationFormattedAddress: existingRequest.location_formatted_address ?? "",
        locationLat: existingRequest.location_lat ?? null,
        locationLng: existingRequest.location_lng ?? null,
        hasRehearsal: decoded.hasRehearsal,
        rehearsalDate: decoded.rehearsalDate,
        rehearsalStartTime: decoded.rehearsalStartTime,
        rehearsalEndTime: decoded.rehearsalEndTime,
        rehearsalNotes: decoded.rehearsalNotes,
        instruments: uniqueInstruments(existingRequest.instruments_needed),
        rehearsals: existingRequest.rehearsals ?? "",
        setlistUrl: existingRequest.setlist_url ?? "",
        techSetup: existingRequest.tech_setup,
        fee: existingRequest.offered_fee != null ? String(existingRequest.offered_fee) : "",
        feeType: existingRequest.fee_type,
        notes: existingRequest.notes ?? "",
      };
    }
    return {
      title: "",
      serviceType: "Sunday morning",
      date: "",
      time: "10:00",
      endTime: "",
      useChurchLocation: true,
      locationAddress: "",
      locationCity: "",
      locationState: "",
      locationZip: "",
      locationFormattedAddress: "",
      locationLat: null,
      locationLng: null,
      hasRehearsal: false,
      rehearsalDate: "",
      rehearsalStartTime: "",
      rehearsalEndTime: "",
      rehearsalNotes: "",
      instruments: [],
      rehearsals: "None — show up Sunday morning",
      setlistUrl: "",
      techSetup: [],
      fee: "",
      feeType: "Per service",
      notes: "",
    };
  });
  const [locationSearch, setLocationSearch] = useState(data.locationFormattedAddress || [data.locationAddress, data.locationCity, data.locationState, data.locationZip].filter(Boolean).join(", "));

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setData(d => ({ ...d, [k]: v }));
  }

  function toggleArr(k: "instruments" | "techSetup", v: string) {
    setData(d => ({
      ...d,
      [k]: d[k].includes(v) ? d[k].filter((x: string) => x !== v) : [...d[k], v],
    }));
  }

  const qualityScore = scoreRequestQuality({
    title: data.title,
    serviceType: data.serviceType,
    serviceDate: data.date,
    serviceTime: data.time,
    useChurchLocation: data.useChurchLocation,
    churchLocationVerified: !!churchLocation?.address_verified_at,
    locationVerified: !!data.locationLat && !!data.locationLng && !!data.locationFormattedAddress,
    instrumentsNeeded: data.instruments,
    rehearsals: encodeRehearsalString(data.hasRehearsal, data.rehearsalDate, data.rehearsalStartTime, data.rehearsalEndTime, data.rehearsalNotes),
    setlistUrl: data.setlistUrl,
    techSetup: data.techSetup,
    offeredFee: data.fee,
    feeType: data.feeType,
    notes: data.notes,
  });

  function clearRequestLocationVerification() {
    setData(d => ({
      ...d,
      locationFormattedAddress: "",
      locationLat: null,
      locationLng: null,
    }));
  }

  function applyVerifiedLocation(address: VerifiedAddressValue) {
    setData(d => ({
      ...d,
      locationAddress: address.streetAddress,
      locationCity: address.city,
      locationState: address.state,
      locationZip: address.zip,
      locationFormattedAddress: address.formattedAddress,
      locationLat: address.lat,
      locationLng: address.lng,
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!data.useChurchLocation && (data.locationLat == null || data.locationLng == null)) {
        throw new Error("Verify the alternate service location before posting.");
      }
      const fields = {
        title: data.title || "Untitled request",
        service_type: data.serviceType,
        service_date: data.date,
        service_time: normalizeServiceTimeForInput(data.time) || null,
        service_end_time: normalizeServiceTimeForInput(data.endTime) || null,
        service_timezone: getBrowserTimeZone(),
        location: data.useChurchLocation ? null : (data.locationFormattedAddress || data.locationAddress || null),
        use_church_location: data.useChurchLocation,
        location_address: data.useChurchLocation ? null : data.locationAddress || null,
        location_city: data.useChurchLocation ? null : data.locationCity || null,
        location_state: data.useChurchLocation ? null : data.locationState || null,
        location_zip: data.useChurchLocation ? null : data.locationZip || null,
        instruments_needed: uniqueInstruments(data.instruments),
        rehearsals: encodeRehearsalString(data.hasRehearsal, data.rehearsalDate, data.rehearsalStartTime, data.rehearsalEndTime, data.rehearsalNotes),
        setlist_url: data.setlistUrl || null,
        tech_setup: data.techSetup,
        offered_fee: data.fee ? parseFloat(data.fee) : null,
        fee_type: data.feeType,
        notes: data.notes || null,
      };

      if (isEditing && existingRequest) {
        const res = await fetch(`/api/requests/${existingRequest.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const payload = await res.json().catch(() => ({})) as { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Could not update request");
        router.push(`/requests/${existingRequest.id}`);
      } else {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const payload = await res.json().catch(() => ({})) as { id?: string; error?: string };
        if (!res.ok || !payload.id) throw new Error(payload.error ?? "Could not create request");
        router.push(`/requests/${payload.id}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                background: i < step ? "var(--sm-accent)" : i === step ? "var(--sm-accent)" : "var(--sm-bg-3)",
                color: i <= step ? "#fff" : "var(--sm-fg-3)",
                flexShrink: 0,
              }}>
                {i < step ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                ) : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i === step ? "var(--sm-fg-1)" : "var(--sm-fg-3)", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 1, background: i < step ? "var(--sm-accent)" : "var(--sm-border-subtle)", flex: 1, margin: "0 8px", marginBottom: 22 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Service details */}
      {step === 0 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Tell us about the service</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>This is what musicians will see first. Be plain — what&apos;s the service, when is it, where is it.</p>
          <div className="sm-row-2" style={{ gap: "16px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Request title</label>
              <input className="input" placeholder="e.g. Sunday morning — pianist needed"
                value={data.title} onChange={e => set("title", e.target.value)} />
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>A short headline so musicians can scan their inbox.</div>
            </div>
            <div>
              <label className="label">Service type</label>
              <select className="select" value={data.serviceType} onChange={e => set("serviceType", e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={data.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="label">Service start time</label>
              <input type="time" className="input" value={data.time} onChange={e => set("time", e.target.value)} />
            </div>
            <div>
              <label className="label">Service end time</label>
              <input type="time" className="input" value={data.endTime} onChange={e => set("endTime", e.target.value)} />
            </div>

            {/* Rehearsal subsection */}
            <div style={{ gridColumn: "1 / -1", paddingTop: 8 }}>
              <div style={{ padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14.5, fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={data.hasRehearsal}
                    onChange={e => set("hasRehearsal", e.target.checked)}
                  />
                  Has rehearsal
                </label>
                <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5, marginLeft: 26 }}>
                  Check this if musicians need to arrive for a rehearsal before the service.
                </div>
                {data.hasRehearsal && (
                  <div style={{ marginTop: 16 }}>
                    <div className="sm-row-2" style={{ gap: "12px 16px" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="label">Rehearsal date</label>
                        <input
                          type="date"
                          className="input"
                          value={data.rehearsalDate}
                          onChange={e => set("rehearsalDate", e.target.value)}
                        />
                        <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 4 }}>
                          The rehearsal may be on a different day than the service.
                        </div>
                      </div>
                      <div>
                        <label className="label">Rehearsal start time</label>
                        <input
                          type="time"
                          className="input"
                          value={data.rehearsalStartTime}
                          onChange={e => set("rehearsalStartTime", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Rehearsal end time</label>
                        <input
                          type="time"
                          className="input"
                          value={data.rehearsalEndTime}
                          onChange={e => set("rehearsalEndTime", e.target.value)}
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="label">Rehearsal notes (optional)</label>
                        <input
                          className="input"
                          placeholder="e.g. full band only, bring charts"
                          value={data.rehearsalNotes}
                          onChange={e => set("rehearsalNotes", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1", paddingTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14.5 }}>
                <input
                  type="checkbox"
                  checked={data.useChurchLocation}
                  onChange={e => set("useChurchLocation", e.target.checked)}
                />
                Use my church address for matching
              </label>
              {data.useChurchLocation ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: churchLocation?.address_verified_at ? "var(--sm-status-success)" : "var(--sm-fg-4)" }}>
                  {churchLocation?.address_verified_at
                    ? `Matches will use ${churchLocation.formatted_address ?? [churchLocation.address, churchLocation.city, churchLocation.state, churchLocation.zip].filter(Boolean).join(", ")}.`
                    : "Verify your church address in your profile for accurate distance matching."}
                </p>
              ) : (
                <div style={{ marginTop: 14, padding: 16, border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                  <VerifiedAddressInput
                    id="serviceLocation"
                    label="Service location"
                    value={locationSearch}
                    verifiedAddress={data.locationFormattedAddress && data.locationLat != null && data.locationLng != null ? {
                      formattedAddress: data.locationFormattedAddress,
                      streetAddress: data.locationAddress,
                      lat: data.locationLat,
                      lng: data.locationLng,
                      city: data.locationCity,
                      state: data.locationState,
                      zip: data.locationZip,
                    } : null}
                    placeholder="123 Venue St, Austin, TX 78701"
                    help="Verify the address so musicians can trust the commute."
                    required={!data.useChurchLocation}
                    onValueChange={setLocationSearch}
                    onVerified={applyVerifiedLocation}
                    onClear={clearRequestLocationVerification}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Musician needs */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Who do you need?</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>Pick everything you need filled. You can ask one musician to cover multiple roles.</p>
          <label className="label">Instruments / roles needed</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 24 }}>
            {INSTRUMENT_OPTIONS.map(i => (
              <button
                key={i}
                type="button"
                onClick={() => toggleArr("instruments", i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: `1px solid ${data.instruments.includes(i) ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)",
                  background: data.instruments.includes(i) ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "var(--sm-bg-1)",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--sm-fg-1)",
                  textAlign: "left",
                  transition: "border-color var(--sm-dur-base) var(--sm-ease)",
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: `1.5px solid ${data.instruments.includes(i) ? "var(--sm-accent)" : "var(--sm-border)"}`,
                  background: data.instruments.includes(i) ? "var(--sm-accent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all var(--sm-dur-base) var(--sm-ease)",
                }}>
                  {data.instruments.includes(i) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {i}
              </button>
            ))}
          </div>
          <div className="sm-row-2" style={{ gap: "16px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Setlist / repertoire link</label>
              <input className="input" placeholder="Planning Center, shared doc, or Spotify playlist"
                value={data.setlistUrl} onChange={e => set("setlistUrl", e.target.value)} />
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>Optional. Helps musicians know if they&apos;re a fit.</div>
            </div>
          </div>
          {data.hasRehearsal && (
            <div style={{ marginTop: 16, padding: "12px 16px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", fontSize: 13.5, color: "var(--sm-fg-2)" }}>
              <strong style={{ fontWeight: 600 }}>Rehearsal:</strong>{" "}
              {[
                data.rehearsalDate,
                data.rehearsalStartTime && data.rehearsalEndTime
                  ? `${data.rehearsalStartTime} – ${data.rehearsalEndTime}`
                  : data.rehearsalStartTime || data.rehearsalEndTime || "",
                data.rehearsalNotes,
              ].filter(Boolean).join(" · ") || "Date and time set in service details."}
              {" "}<button type="button" className="btn btn--ghost btn--sm" style={{ verticalAlign: "middle" }} onClick={() => setStep(0)}>Edit</button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Logistics & fee */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Logistics &amp; fee</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>What&apos;s the tech setup like, and what are you offering. Fees can be negotiated in the message thread.</p>
          <label className="label">Tech setup at the venue</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 24 }}>
            {TECH_SETUP.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleArr("techSetup", t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: `1px solid ${data.techSetup.includes(t) ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)",
                  background: data.techSetup.includes(t) ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "var(--sm-bg-1)",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--sm-fg-1)",
                  textAlign: "left",
                  transition: "border-color var(--sm-dur-base) var(--sm-ease)",
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: `1.5px solid ${data.techSetup.includes(t) ? "var(--sm-accent)" : "var(--sm-border)"}`,
                  background: data.techSetup.includes(t) ? "var(--sm-accent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all var(--sm-dur-base) var(--sm-ease)",
                }}>
                  {data.techSetup.includes(t) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {t}
              </button>
            ))}
          </div>
          <div className="sm-row-2" style={{ gap: "16px 20px" }}>
            <div>
              <label className="label">Offered fee</label>
              <div style={{ display: "flex" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 12px",
                  border: "1px solid var(--sm-border)",
                  borderRight: "none",
                  borderRadius: "3px 0 0 3px",
                  color: "var(--sm-fg-3)",
                  background: "var(--sm-bg-2)",
                  fontSize: 14,
                }}>$</span>
                <input className="input" style={{ borderRadius: "0 3px 3px 0" }}
                  placeholder="200" value={data.fee} onChange={e => set("fee", e.target.value)} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>Treat this as a starting offer. Musicians can counter.</div>
            </div>
            <div>
              <label className="label">Fee type</label>
              <select className="select" value={data.feeType} onChange={e => set("feeType", e.target.value)}>
                <option>Per service</option>
                <option>Per service (incl. rehearsal)</option>
                <option>Per hour</option>
                <option>Honorarium</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Notes / vibe (optional)</label>
              <textarea className="textarea" rows={4}
                placeholder="Anything else worth knowing — congregation size, vibe of the service, songs you definitely want, denominational context, accessibility, parking, etc."
                value={data.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & post */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Looks good?</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>You can edit any section before posting. Once you post, musicians who match will see this in their feed.</p>

          <div style={{ marginBottom: 18 }}>
            <RequestQualityCard score={qualityScore} />
          </div>

          {[
            {
              heading: "Service",
              onEdit: () => setStep(0),
              rows: [
                ["Title", data.title || <em style={{ color: "var(--sm-fg-4)" }}>untitled</em>],
                ["Type", data.serviceType],
                ["Date & time", data.date ? `${data.date} at ${formatServiceTimeRange(data.time, data.endTime)}` : <em style={{ color: "var(--sm-fg-4)" }}>not set</em>],
                ["Rehearsal", data.hasRehearsal ? (
                  [
                    data.rehearsalDate || "date TBD",
                    data.rehearsalStartTime && data.rehearsalEndTime
                      ? `${data.rehearsalStartTime} – ${data.rehearsalEndTime}`
                      : data.rehearsalStartTime ? `from ${data.rehearsalStartTime}` : data.rehearsalEndTime ? `until ${data.rehearsalEndTime}` : "",
                    data.rehearsalNotes,
                  ].filter(Boolean).join(" · ")
                ) : "None"],
                ["Location", data.useChurchLocation ? "Church address" : (data.locationFormattedAddress || <em style={{ color: "var(--sm-fg-4)" }}>alternate location not verified</em>)],
              ],
            },
            {
              heading: "Musician needs",
              onEdit: () => setStep(1),
              rows: [
                ["Instruments", data.instruments.length ? data.instruments.join(", ") : <em style={{ color: "var(--sm-fg-4)" }}>none selected</em>],
                ["Setlist", data.setlistUrl || <em style={{ color: "var(--sm-fg-4)" }}>not provided</em>],
              ],
            },
            {
              heading: "Logistics",
              onEdit: () => setStep(2),
              rows: [
                ["Tech", data.techSetup.length ? data.techSetup.join(", ") : <em style={{ color: "var(--sm-fg-4)" }}>none</em>],
                ["Fee", data.fee ? `$${data.fee} · ${data.feeType}` : <em style={{ color: "var(--sm-fg-4)" }}>not set</em>],
                ["Notes", data.notes || <em style={{ color: "var(--sm-fg-4)" }}>none</em>],
              ],
            },
          ].map(block => (
            <div key={block.heading} style={{
              border: "1px solid var(--sm-border-subtle)",
              borderRadius: "var(--sm-radius-sm)",
              padding: "18px 20px",
              marginBottom: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)" }}>
                  {block.heading}
                </h4>
                <button
                  type="button"
                  onClick={block.onEdit}
                  className="btn btn--ghost btn--sm"
                >
                  Edit
                </button>
              </div>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 16px" }}>
                {block.rows.map(([label, value], i) => (
                  <Fragment key={i}>
                    <dt style={{ fontSize: 13, color: "var(--sm-fg-3)", fontWeight: 500 }}>{label}</dt>
                    <dd style={{ margin: 0, fontSize: 13.5, color: "var(--sm-fg-1)" }}>{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          ))}

          {error && (
            <div style={{ padding: "12px 16px", background: "color-mix(in srgb, var(--sm-status-error) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--sm-status-error) 30%, transparent)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--sm-border-subtle)" }}>
        {step === 0 ? (
          <button type="button" className="btn btn--ghost" onClick={() => router.push(isEditing ? `/requests/${existingRequest!.id}` : "/requests")}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setStep(s => s - 1)}>
            ← Back
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={step === 0 && !data.useChurchLocation && !data.locationFormattedAddress}
            title={step === 0 && !data.useChurchLocation && !data.locationFormattedAddress ? "Verify the service location before continuing" : undefined}
            onClick={() => setStep(s => s + 1)}
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (isEditing ? "Saving…" : "Posting…") : (isEditing ? "Save changes" : "Post request")}
          </button>
        )}
      </div>
    </div>
  );
}
