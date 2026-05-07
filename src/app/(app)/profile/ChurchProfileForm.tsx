"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ChurchProfile = Database["public"]["Tables"]["church_profiles"]["Row"];

const MUSICAL_APPROACHES = [
  "Vocals Only",
  "Piano / Organ Centric",
  "Acoustic Guitar Centric",
  "Based on volunteer availability",
  "Rock Band Configuration",
  "Full band including aux instruments, horns, strings, etc",
];
const MUSIC_VALUES = [
  "Music exists to support the sermon",
  "Musical excellence is something we strive for",
  "We're known for our music",
];
const PRODUCTION_LEVELS = [
  "Minimal / Intentionally Low production",
  "Basic / Medium production",
  "High Production is implemented on occasion",
  "Every service is highly produced and coordinated",
];
const WORSHIP_THEOLOGIES = ["Conservative", "Liturgical", "Charismatic"];

export function ChurchProfileForm({
  profile,
  churchProfile: cp,
}: {
  profile: Profile;
  churchProfile: ChurchProfile | null;
}) {
  const [churchName, setChurchName] = useState(cp?.church_name ?? profile.display_name);
  const [contactName, setContactName] = useState(cp?.contact_name ?? "");
  const [denomination, setDenomination] = useState(cp?.denomination ?? "");
  const [address, setAddress] = useState(cp?.address ?? "");
  const [city, setCity] = useState(cp?.city ?? "");
  const [stateVal, setStateVal] = useState(cp?.state ?? "");
  const [zip, setZip] = useState(cp?.zip ?? "");
  const [capacity, setCapacity] = useState<number | "">(cp?.capacity ?? "");
  const [serviceCount, setServiceCount] = useState<number | "">(cp?.service_count ?? "");
  const [musicalStyle, setMusicalStyle] = useState(cp?.musical_style ?? "");
  const [musicalApproach, setMusicalApproach] = useState(cp?.musical_approach ?? "");
  const [musicValue, setMusicValue] = useState(cp?.music_value ?? "");
  const [productionLevel, setProductionLevel] = useState(cp?.production_level ?? "");
  const [worshipTheology, setWorshipTheology] = useState(cp?.worship_theology ?? "");
  const [additionalValues, setAdditionalValues] = useState(cp?.additional_worship_values ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const [{ error: profErr }, { error: cpErr }] = await Promise.all([
      supabase.from("profiles").update({ display_name: churchName }).eq("id", profile.id),
      supabase.from("church_profiles").update({
        church_name: churchName,
        contact_name: contactName || null,
        denomination: denomination || null,
        address: address || null,
        city,
        state: stateVal,
        zip: zip || null,
        capacity: capacity === "" ? null : Number(capacity),
        service_count: serviceCount === "" ? null : Number(serviceCount),
        musical_style: musicalStyle || null,
        musical_approach: musicalApproach || null,
        music_value: musicValue || null,
        production_level: productionLevel || null,
        worship_theology: worshipTheology || null,
        additional_worship_values: additionalValues || null,
      }).eq("profile_id", profile.id),
    ]);
    if (profErr || cpErr) setError((profErr ?? cpErr)!.message);
    else setSaved(true);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} style={{ padding: "32px 32px 80px", maxWidth: 720 }}>

      <Section title="About your church">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="churchName">Church name</label>
            <input id="churchName" type="text" className="input" value={churchName} onChange={e => setChurchName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="contactName">Contact name</label>
            <input id="contactName" type="text" className="input" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Worship director or pastor" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label" htmlFor="denomination">Denomination / Association</label>
            <input id="denomination" type="text" className="input" value={denomination} onChange={e => setDenomination(e.target.value)} placeholder="e.g. Southern Baptist, Non-denominational, PCA" />
          </div>
        </div>
      </Section>

      <Section title="Location">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label" htmlFor="address">Street address</label>
            <input id="address" type="text" className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Church St" />
          </div>
          <div className="field">
            <label className="label" htmlFor="city">City</label>
            <input id="city" type="text" className="input" value={city} onChange={e => setCity(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="state">State</label>
            <input id="state" type="text" className="input" value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="TX" maxLength={2} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="zip">ZIP code</label>
            <input id="zip" type="text" className="input" value={zip} onChange={e => setZip(e.target.value)} placeholder="78701" />
          </div>
        </div>
      </Section>

      <Section title="Ministry details">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="capacity">Seating capacity</label>
            <input id="capacity" type="number" className="input" min={1} value={capacity}
              onChange={e => setCapacity(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 250" />
          </div>
          <div className="field">
            <label className="label" htmlFor="serviceCount">Services per week</label>
            <input id="serviceCount" type="number" className="input" min={1} value={serviceCount}
              onChange={e => setServiceCount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 2" />
          </div>
        </div>
      </Section>

      <Section title="Musical character">
        <div className="field">
          <label className="label" htmlFor="musicalStyle">Musical style (your own words)</label>
          <input id="musicalStyle" type="text" className="input" value={musicalStyle} onChange={e => setMusicalStyle(e.target.value)}
            placeholder="e.g. Contemporary worship, traditional hymns, blend of both" />
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label className="label">Musical approach</label>
          <RadioCards options={MUSICAL_APPROACHES} value={musicalApproach} onChange={setMusicalApproach} cols={2} />
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label className="label">The value of music in your service</label>
          <RadioCards options={MUSIC_VALUES} value={musicValue} onChange={setMusicValue} cols={1} />
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label className="label">Production level</label>
          <RadioCards options={PRODUCTION_LEVELS} value={productionLevel} onChange={setProductionLevel} cols={2} />
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label className="label">Worship theology</label>
          <RadioCards options={WORSHIP_THEOLOGIES} value={worshipTheology} onChange={setWorshipTheology} cols={3} />
        </div>
      </Section>

      <Section title="Additional worship values">
        <div className="field">
          <textarea className="textarea" rows={4} value={additionalValues} onChange={e => setAdditionalValues(e.target.value)}
            placeholder="Share anything else about your worship culture, what you look for in musicians, or special requirements…" />
        </div>
      </Section>

      <StatusBar error={error} saved={saved} saving={saving} />
    </form>
  );
}

function RadioCards({ options, value, onChange, cols = 2 }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(active ? "" : opt)} style={{
            border: `1.5px solid ${active ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
            borderRadius: "var(--sm-radius-sm)", padding: "10px 14px",
            background: active ? "rgba(228,123,2,0.06)" : "var(--sm-bg-1)",
            textAlign: "left", cursor: "pointer", fontSize: 13.5, lineHeight: 1.4,
            color: active ? "var(--sm-fg-1)" : "var(--sm-fg-2)",
            fontWeight: active ? 600 : 400,
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid var(--sm-border-subtle)" }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 20px" }}>{title}</h3>
      {children}
    </div>
  );
}

function StatusBar({ error, saved, saving }: { error: string | null; saved: boolean; saving: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: "10px 14px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-success)", fontSize: 13.5 }}>
          Profile saved successfully.
        </div>
      )}
      <button type="submit" className="btn btn--primary btn--lg" disabled={saving} style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
