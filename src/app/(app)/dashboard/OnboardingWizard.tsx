"use client";

// First-run onboarding: walks a new user through the core profile questions
// in a modal before they do anything else. Every step saves on Continue and
// can be skipped; once finished or dismissed we set a per-user localStorage
// flag and the dashboard completeness bar takes over as the reminder.
// ponytail: dismissal is per-device (localStorage). Move to a DB column if
// cross-device nagging ever matters.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { INSTRUMENT_OPTIONS, uniqueInstruments } from "@/lib/instruments";
import { VerifiedAddressInput, verifyAddressQuery, type VerifiedAddressValue } from "@/components/VerifiedAddressInput";
import { inferTimeZoneForUsLocation } from "@/lib/locations/timezone";
import { WORSHIP_THEOLOGIES } from "@/lib/worship-theologies";

type Profile = { id: string; display_name: string | null };
type MusicianProfile = Pick<
  Database["public"]["Tables"]["musician_profiles"]["Row"],
  "bio" | "instruments" | "instruments_detail" | "is_volunteer" | "fee_min"
  | "denomination_tags" | "music_format_tags"
  | "years_in_ministry" | "gear_notes" | "travel_radius_miles" | "formatted_address"
>;
type ChurchProfile = Pick<
  Database["public"]["Tables"]["church_profiles"]["Row"],
  "id" | "church_name" | "contact_name" | "denomination" | "formatted_address"
  | "capacity" | "service_count" | "musical_style" | "music_value" | "worship_theology"
>;
type InstrumentEntry = { instrument: string; skill: string; isVolunteer?: boolean; feeMin?: number };

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Professional"];
const TRAVEL_OPTIONS = [
  { value: 10, label: "Within 10 miles" },
  { value: 25, label: "Within 25 miles" },
  { value: 50, label: "Within 50 miles" },
  { value: 100, label: "Within 100 miles" },
  { value: 200, label: "Within 200 miles" },
  { value: 9999, label: "Willing to travel anywhere" },
];
const DENOMINATION_OPTIONS = [
  "Open to any denomination / tradition",
  "Non-denominational", "Baptist", "Southern Baptist", "Catholic",
  "Presbyterian", "Methodist", "Pentecostal / Charismatic", "Lutheran",
  "Episcopal / Anglican", "Reformed", "Church of Christ", "Nazarene",
  "Assembly of God",
];
const OPEN_ANY_DENOMINATION = DENOMINATION_OPTIONS[0];
const MUSICAL_FORMAT_OPTIONS = [
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

function dismissKey(profileId: string) {
  return `sm-onboarding-dismissed:${profileId}`;
}

export function OnboardingWizard(props:
  | { role: "musician"; profile: Profile; musicianProfile: MusicianProfile | null }
  | { role: "church"; profile: Profile; churchProfile: ChurchProfile | null }
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // A <dialog> without showModal() is display:none, so we always render it
  // and only open it when this user hasn't already finished or skipped.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (!localStorage.getItem(dismissKey(props.profile.id))) dialog.showModal();
  }, [props.profile.id]);

  function dismiss() {
    localStorage.setItem(dismissKey(props.profile.id), new Date().toISOString());
    dialogRef.current?.close();
    router.refresh();
  }

  if (props.role === "musician" && !props.musicianProfile) return null;
  if (props.role === "church" && !props.churchProfile) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={dismiss}
      onCancel={dismiss}
      aria-label="Set up your profile"
      style={{
        width: "min(640px, calc(100vw - 32px))",
        maxHeight: "min(85vh, 760px)",
        border: "1px solid var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)",
        padding: 0,
        background: "var(--sm-bg-1)",
        color: "var(--sm-fg-1)",
      }}
    >
      {props.role === "musician"
        ? <MusicianSteps profile={props.profile} mp={props.musicianProfile!} onDone={dismiss} />
        : <ChurchSteps profile={props.profile} cp={props.churchProfile!} onDone={dismiss} />}
    </dialog>
  );
}

// ── Shared step chrome ─────────────────────────────────────────────────────

function StepShell({
  step, total, title, intro, children, onSkip, onContinue, saving, error, isLast,
}: {
  step: number;
  total: number;
  title: string;
  intro?: string;
  children: React.ReactNode;
  onSkip: () => void;
  onContinue: () => void;
  saving: boolean;
  error: string | null;
  isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", maxHeight: "inherit" }}>
      <div style={{ padding: "24px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--sm-fg-3)" }}>
            Set up your profile · Step {step} of {total}
          </span>
        </div>
        <div role="progressbar" aria-label="Profile setup progress" aria-valuenow={step} aria-valuemin={0} aria-valuemax={total}
          style={{ height: 4, borderRadius: 999, background: "var(--sm-bg-3)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ width: `${(step / total) * 100}%`, height: "100%", background: "var(--sm-accent)", transition: "width 200ms ease" }} />
        </div>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 6px" }}>{title}</h2>
        {intro && <p style={{ fontSize: 14, color: "var(--sm-fg-3)", margin: "0 0 4px", lineHeight: 1.5 }}>{intro}</p>}
      </div>
      <div style={{ padding: "16px 28px", overflowY: "auto", flex: 1 }}>
        {children}
      </div>
      <div style={{ padding: "16px 28px 22px", borderTop: "1px solid var(--sm-border-subtle)" }}>
        {error && (
          <div role="alert" style={{ padding: "10px 14px", marginBottom: 12, background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button type="button" onClick={onSkip} disabled={saving} className="btn btn--ghost btn--sm" style={{ color: "var(--sm-fg-3)" }}>
            Skip (you can do this later)
          </button>
          <button type="button" onClick={onContinue} className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : isLast ? "Finish" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chips({ options, selected, onToggle }: {
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(tag => {
        const active = selected.includes(tag);
        return (
          <button key={tag} type="button" aria-pressed={active} onClick={() => onToggle(tag)} style={{
            border: `1.5px solid ${active ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
            borderRadius: "var(--sm-radius-sm)", padding: "5px 12px",
            background: active ? "rgba(228,123,2,0.07)" : "var(--sm-bg-1)",
            cursor: "pointer", fontSize: 13.5,
            color: active ? "var(--sm-accent)" : "var(--sm-fg-2)",
            fontWeight: active ? 600 : 400,
          }}>{tag}</button>
        );
      })}
    </div>
  );
}

function RadioCards({ options, value, onChange, cols = 1 }: {
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
          <button key={opt} type="button" aria-pressed={active} onClick={() => onChange(active ? "" : opt)} style={{
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

// ── Musician flow ──────────────────────────────────────────────────────────

function MusicianSteps({ profile, mp, onDone }: { profile: Profile; mp: MusicianProfile; onDone: () => void }) {
  const TOTAL = 5;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState(mp.bio ?? "");
  const [instruments, setInstruments] = useState<InstrumentEntry[]>(() => {
    const detail = mp.instruments_detail as InstrumentEntry[] | null;
    if (detail && Array.isArray(detail) && detail.length > 0) return detail;
    // Legacy rows predate instruments_detail; seed from the flat list so
    // Continue doesn't wipe existing instruments and fee data.
    if (mp.instruments?.length) {
      return uniqueInstruments(mp.instruments).map(i => ({
        instrument: i, skill: "Intermediate", isVolunteer: mp.is_volunteer, feeMin: mp.fee_min,
      }));
    }
    return [{ instrument: "", skill: "Intermediate", isVolunteer: true, feeMin: 0 }];
  });
  const [denominationTags, setDenominationTags] = useState<string[]>(
    mp.denomination_tags?.length ? mp.denomination_tags : []
  );
  const [musicFormatTags, setMusicFormatTags] = useState<string[]>(mp.music_format_tags ?? []);
  const [yearsInMinistry, setYearsInMinistry] = useState<number | "">(mp.years_in_ministry ?? "");
  const [gearNotes, setGearNotes] = useState(mp.gear_notes ?? "");
  const [travelRadius, setTravelRadius] = useState(mp.travel_radius_miles ?? 25);
  const [addressSearch, setAddressSearch] = useState(mp.formatted_address ?? "");
  const [verifiedAddress, setVerifiedAddress] = useState<VerifiedAddressValue | null>(null);

  function advance() {
    setError(null);
    if (step >= TOTAL) onDone();
    else setStep(step + 1);
  }

  // No router.refresh() here: the dashboard only renders the wizard while
  // completeness < 100, so refreshing mid-flow can unmount the open dialog.
  // dismiss() refreshes once when the wizard closes.
  async function save(fields: Database["public"]["Tables"]["musician_profiles"]["Update"]) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("musician_profiles").update(fields).eq("profile_id", profile.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    advance();
  }

  // Continue can outrun VerifiedAddressInput's blur-triggered verify, so
  // resolve typed-but-unverified text ourselves before saving.
  async function resolveTypedAddress(existingFormatted: string | null): Promise<VerifiedAddressValue | null | "failed"> {
    if (verifiedAddress) return verifiedAddress;
    const q = addressSearch.trim();
    if (!q || q === (existingFormatted ?? "")) return null;
    setSaving(true);
    setError(null);
    try {
      const v = await verifyAddressQuery(q);
      setVerifiedAddress(v);
      setAddressSearch(v.formattedAddress);
      return v;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify address");
      return "failed";
    } finally {
      setSaving(false);
    }
  }

  const steps: Record<number, { title: string; intro?: string; body: React.ReactNode; onContinue: () => void }> = {
    1: {
      title: `Welcome, ${profile.display_name?.trim().split(/\s+/)[0] ?? "friend"}!`,
      intro: "Churches choose musicians by their profile. A few minutes now gets you booked faster. First, introduce yourself.",
      body: (
        <div className="field">
          <label className="label" htmlFor="obBio">Bio</label>
          <textarea id="obBio" className="textarea" rows={5} value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell churches about yourself and your heart for worship. Mention bands you've played with, albums, or churches you've served." />
        </div>
      ),
      onContinue: () => save({ bio }),
    },
    2: {
      title: "What do you play?",
      intro: "Requests are matched to your instruments, so this is the most important step.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {instruments.map((entry, i) => (
            <div key={i} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="select" aria-label="Instrument" value={entry.instrument} style={{ flex: 1 }}
                  onChange={e => setInstruments(prev => prev.map((p, idx) => idx === i ? { ...p, instrument: e.target.value } : p))}>
                  <option value="">Select instrument…</option>
                  {INSTRUMENT_OPTIONS.map(inst => <option key={inst}>{inst}</option>)}
                </select>
                <select className="select" aria-label="Skill level" value={entry.skill} style={{ width: 150 }}
                  onChange={e => setInstruments(prev => prev.map((p, idx) => idx === i ? { ...p, skill: e.target.value } : p))}>
                  {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                </select>
                {instruments.length > 1 && (
                  <button type="button" aria-label={`Remove ${entry.instrument || "instrument"}`}
                    onClick={() => setInstruments(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sm-fg-4)", fontSize: 22, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13.5 }}>
                  <input type="checkbox" checked={entry.isVolunteer ?? true}
                    onChange={e => setInstruments(prev => prev.map((p, idx) => idx === i ? { ...p, isVolunteer: e.target.checked } : p))} />
                  Open to volunteering (no pay required)
                </label>
                {!(entry.isVolunteer ?? true) && (
                  <div style={{ marginTop: 10, maxWidth: 200 }}>
                    <label className="label" htmlFor={`obFee-${i}`} style={{ fontSize: 12 }}>Fee ($ / service)</label>
                    <input id={`obFee-${i}`} type="number" className="input" min={0} value={entry.feeMin ?? 0}
                      onChange={e => setInstruments(prev => prev.map((p, idx) => idx === i ? { ...p, feeMin: Number(e.target.value) } : p))} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}
            onClick={() => setInstruments(prev => [...prev, { instrument: "", skill: "Intermediate", isVolunteer: true, feeMin: 0 }])}>
            + Add instrument
          </button>
          <p className="help" style={{ margin: 0 }}>The first instrument listed is shown as your primary instrument.</p>
        </div>
      ),
      onContinue: () => {
        const kept = instruments.filter(e => e.instrument);
        const instrumentsArr = uniqueInstruments(kept.map(e => e.instrument));
        const paid = kept.filter(e => !(e.isVolunteer ?? true));
        save({
          instruments_detail: kept,
          instruments: instrumentsArr,
          primary_instrument: instrumentsArr[0] ?? "",
          is_volunteer: paid.length === 0,
          fee_min: paid.length > 0 ? Math.min(...paid.map(e => e.feeMin ?? 0)) : 0,
          fee_max: paid.length > 0 ? Math.max(...paid.map(e => e.feeMin ?? 0)) : 0,
        });
      },
    },
    3: {
      title: "Where are you comfortable serving?",
      body: (
        <>
          <div className="field">
            <label className="label">Denomination / tradition</label>
            <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Select denominations you&apos;re comfortable leading worship in.</p>
            <Chips options={DENOMINATION_OPTIONS} selected={denominationTags}
              onToggle={tag => setDenominationTags(prev => {
                if (prev.includes(tag)) return prev.filter(t => t !== tag);
                if (tag === OPEN_ANY_DENOMINATION) return [tag];
                return [...prev.filter(t => t !== OPEN_ANY_DENOMINATION), tag];
              })} />
          </div>
          <div className="field" style={{ marginTop: 20 }}>
            <label className="label">Musical formats</label>
            <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Select the service formats you&apos;re comfortable playing in.</p>
            <Chips options={MUSICAL_FORMAT_OPTIONS} selected={musicFormatTags}
              onToggle={tag => setMusicFormatTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </div>
        </>
      ),
      onContinue: () => save({ denomination_tags: denominationTags, music_format_tags: musicFormatTags }),
    },
    4: {
      title: "Your experience",
      body: (
        <>
          <div className="field">
            <label className="label" htmlFor="obYears">Years in worship ministry</label>
            <input id="obYears" type="number" className="input" min={0} max={60} value={yearsInMinistry}
              onChange={e => setYearsInMinistry(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" style={{ maxWidth: 160 }} />
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label" htmlFor="obGear">Gear / setup</label>
            <textarea id="obGear" className="textarea" rows={4} value={gearNotes} onChange={e => setGearNotes(e.target.value)}
              placeholder="Describe your rig, pedalboard, keyboard, or drum setup, and anything the church should provide." />
          </div>
        </>
      ),
      onContinue: () => save({ years_in_ministry: yearsInMinistry === "" ? null : yearsInMinistry, gear_notes: gearNotes }),
    },
    5: {
      title: "Where are you based?",
      intro: "Churches search within your travel radius, so a verified address helps you show up in more matches.",
      body: (
        <>
          <VerifiedAddressInput
            id="obAddress"
            label="Home base address"
            value={addressSearch}
            verifiedAddress={verifiedAddress}
            placeholder="123 Main St, Portland, OR 97201"
            onValueChange={setAddressSearch}
            onVerified={setVerifiedAddress}
            onClear={() => setVerifiedAddress(null)}
          />
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label" htmlFor="obTravel">Willing to travel</label>
            <select id="obTravel" className="select" value={travelRadius} onChange={e => setTravelRadius(Number(e.target.value))}>
              {TRAVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </>
      ),
      onContinue: async () => {
        const addr = await resolveTypedAddress(mp.formatted_address);
        if (addr === "failed") return;
        save({
          travel_radius_miles: travelRadius,
          ...(addr ? {
            address: addr.streetAddress || null,
            city: addr.city,
            state: addr.state,
            zip: addr.zip || null,
            lat: addr.lat,
            lng: addr.lng,
            formatted_address: addr.formattedAddress,
            address_verified_at: new Date().toISOString(),
          } : {}),
        });
      },
    },
  };

  const current = steps[step];
  return (
    <StepShell step={step} total={TOTAL} title={current.title} intro={current.intro}
      onSkip={advance} onContinue={current.onContinue} saving={saving} error={error} isLast={step === TOTAL}>
      {current.body}
    </StepShell>
  );
}

// ── Church flow ────────────────────────────────────────────────────────────

function ChurchSteps({ profile, cp, onDone }: { profile: Profile; cp: ChurchProfile; onDone: () => void }) {
  const TOTAL = 4;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [churchName, setChurchName] = useState(cp.church_name || profile.display_name || "");
  const [contactName, setContactName] = useState(cp.contact_name ?? "");
  const [denomination, setDenomination] = useState(cp.denomination ?? "");
  const [addressSearch, setAddressSearch] = useState(cp.formatted_address ?? "");
  const [verifiedAddress, setVerifiedAddress] = useState<VerifiedAddressValue | null>(null);
  const [capacity, setCapacity] = useState<number | "">(cp.capacity ?? "");
  const [serviceCount, setServiceCount] = useState<number | "">(cp.service_count ?? "");
  const [musicalStyle, setMusicalStyle] = useState(cp.musical_style ?? "");
  const [musicValue, setMusicValue] = useState(cp.music_value ?? "");
  const [worshipTheology, setWorshipTheology] = useState(cp.worship_theology ?? "");

  function advance() {
    setError(null);
    if (step >= TOTAL) onDone();
    else setStep(step + 1);
  }

  // No router.refresh() mid-flow (see MusicianSteps.save). serviceTimezone
  // mirrors ChurchProfileForm: address saves must keep request timezones in
  // sync for requests that use the church's location.
  async function save(
    fields: Database["public"]["Tables"]["church_profiles"]["Update"],
    opts?: { displayName?: string; serviceTimezone?: string | null },
  ) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const [{ error: cpErr }, profErr, tzErr] = await Promise.all([
      supabase.from("church_profiles").update(fields).eq("profile_id", profile.id),
      opts?.displayName
        ? supabase.from("profiles").update({ display_name: opts.displayName }).eq("id", profile.id).then(r => r.error)
        : Promise.resolve(null),
      opts?.serviceTimezone
        ? supabase.from("service_requests").update({ service_timezone: opts.serviceTimezone })
            .eq("church_profile_id", cp.id).eq("use_church_location", true).then(r => r.error)
        : Promise.resolve(null),
    ]);
    setSaving(false);
    if (cpErr || profErr || tzErr) { setError((cpErr ?? profErr ?? tzErr)!.message); return; }
    advance();
  }

  async function resolveTypedAddress(): Promise<VerifiedAddressValue | null | "failed"> {
    if (verifiedAddress) return verifiedAddress;
    const q = addressSearch.trim();
    if (!q || q === (cp.formatted_address ?? "")) return null;
    setSaving(true);
    setError(null);
    try {
      const v = await verifyAddressQuery(q);
      setVerifiedAddress(v);
      setAddressSearch(v.formattedAddress);
      return v;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify address");
      return "failed";
    } finally {
      setSaving(false);
    }
  }

  const steps: Record<number, { title: string; intro?: string; body: React.ReactNode; onContinue: () => void }> = {
    1: {
      title: "Welcome! Tell musicians who you are.",
      intro: "Musicians decide whether a request is a fit based on your church profile. A few minutes now means faster yeses later.",
      body: (
        <>
          <div className="field">
            <label className="label" htmlFor="obChurchName">Church name</label>
            <input id="obChurchName" className="input" value={churchName} onChange={e => setChurchName(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label className="label" htmlFor="obContact">Contact name</label>
            <input id="obContact" className="input" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Worship director or pastor" />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label className="label" htmlFor="obDenom">Denomination / Association</label>
            <input id="obDenom" className="input" value={denomination} onChange={e => setDenomination(e.target.value)} placeholder="e.g. Southern Baptist, Non-denominational, PCA" />
          </div>
        </>
      ),
      onContinue: () => save(
        { church_name: churchName, contact_name: contactName || null, denomination: denomination || null },
        { displayName: churchName || undefined }
      ),
    },
    2: {
      title: "Where is your church?",
      intro: "Your address is how nearby musicians find you.",
      body: (
        <VerifiedAddressInput
          id="obChurchAddress"
          label="Church address"
          value={addressSearch}
          verifiedAddress={verifiedAddress}
          placeholder="123 Church St, Portland, OR 97201"
          onValueChange={setAddressSearch}
          onVerified={setVerifiedAddress}
          onClear={() => setVerifiedAddress(null)}
        />
      ),
      onContinue: async () => {
        const addr = await resolveTypedAddress();
        if (addr === "failed") return;
        if (!addr) { advance(); return; }
        save({
          address: addr.streetAddress || null,
          city: addr.city,
          state: addr.state,
          zip: addr.zip || null,
          lat: addr.lat,
          lng: addr.lng,
          formatted_address: addr.formattedAddress,
          address_verified_at: new Date().toISOString(),
        }, { serviceTimezone: inferTimeZoneForUsLocation({ state: addr.state, lng: addr.lng }) });
      },
    },
    3: {
      title: "About your services",
      body: (
        <div className="sm-row-2">
          <div className="field">
            <label className="label" htmlFor="obCapacity">Seating capacity</label>
            <input id="obCapacity" type="number" className="input" min={1} value={capacity}
              onChange={e => setCapacity(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 250" />
          </div>
          <div className="field">
            <label className="label" htmlFor="obServices">Services per week</label>
            <input id="obServices" type="number" className="input" min={1} value={serviceCount}
              onChange={e => setServiceCount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 2" />
          </div>
        </div>
      ),
      onContinue: () => save({
        capacity: capacity === "" ? null : Number(capacity),
        service_count: serviceCount === "" ? null : Number(serviceCount),
      }),
    },
    4: {
      title: "Your musical character",
      intro: "This helps musicians know what a Sunday with you sounds like.",
      body: (
        <>
          <div className="field">
            <label className="label" htmlFor="obStyle">Musical style (your own words)</label>
            <input id="obStyle" className="input" value={musicalStyle} onChange={e => setMusicalStyle(e.target.value)}
              placeholder="e.g. Contemporary worship, traditional hymns, blend of both" />
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label className="label">The value of music in your service</label>
            <RadioCards options={MUSIC_VALUES} value={musicValue} onChange={setMusicValue} />
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label className="label">Worship theology</label>
            <RadioCards options={WORSHIP_THEOLOGIES} value={worshipTheology} onChange={setWorshipTheology} cols={2} />
          </div>
        </>
      ),
      onContinue: () => save({
        musical_style: musicalStyle || null,
        music_value: musicValue || null,
        worship_theology: worshipTheology || null,
      }),
    },
  };

  const current = steps[step];
  return (
    <StepShell step={step} total={TOTAL} title={current.title} intro={current.intro}
      onSkip={advance} onContinue={current.onContinue} saving={saving} error={error} isLast={step === TOTAL}>
      {current.body}
    </StepShell>
  );
}
