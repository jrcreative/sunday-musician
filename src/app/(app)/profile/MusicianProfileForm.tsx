"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { INSTRUMENT_OPTIONS, uniqueInstruments } from "@/lib/instruments";
import { AvatarUploader } from "./AvatarUploader";
import { VerifiedAddressInput, type VerifiedAddressValue } from "@/components/VerifiedAddressInput";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type MusicianProfile = Database["public"]["Tables"]["musician_profiles"]["Row"];
type InstrumentEntry = { instrument: string; skill: string; isVolunteer?: boolean; feeMin?: number };
type VideoEntry = { url: string; title: string; description: string };
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
const CHURCH_SIZE_OPTIONS = ["0–150", "150–500", "500–1000", "1000+"];
const PRACTICE_TIME_OPTIONS = [
  "Just the service (no separate rehearsal needed)",
  "1 run-through or sound check",
  "1 full rehearsal",
  "2 or more rehearsals",
];
const LEAD_TIME_OPTIONS = [
  "Same week is fine",
  "1–2 weeks notice",
  "2–4 weeks notice",
  "A month or more",
];

function videoEntriesFromProfile(mp: MusicianProfile | null): VideoEntry[] {
  const profileVideos = mp?.profile_videos;
  if (Array.isArray(profileVideos)) {
    const videos = profileVideos
      .map(video => {
        if (!video || typeof video !== "object" || Array.isArray(video)) return null;
        const entry = video as Record<string, unknown>;
        return {
          url: typeof entry.url === "string" ? entry.url : "",
          title: typeof entry.title === "string" ? entry.title : "",
          description: typeof entry.description === "string" ? entry.description : "",
        };
      })
      .filter((video): video is VideoEntry => !!video);
    if (videos.length > 0) return videos;
  }

  if (mp?.youtube_links?.length) {
    return mp.youtube_links.map(url => ({ url, title: "", description: "" }));
  }

  return [{ url: "", title: "", description: "" }];
}

export function MusicianProfileForm({
  profile,
  musicianProfile: mp,
}: {
  profile: Profile;
  musicianProfile: MusicianProfile | null;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(mp?.bio ?? "");
  const [available, setAvailable] = useState(mp?.available ?? true);
  const [instruments, setInstruments] = useState<InstrumentEntry[]>(() => {
    const detail = mp?.instruments_detail as InstrumentEntry[] | null;
    if (detail && Array.isArray(detail) && detail.length > 0) return detail;
    if (mp?.instruments?.length) return uniqueInstruments(mp.instruments).map(i => ({ instrument: i, skill: "Intermediate" }));
    return [];
  });
  const [experienceNotes, setExperienceNotes] = useState(mp?.experience_notes ?? "");
  const [gearNotes, setGearNotes] = useState(mp?.gear_notes ?? "");
  const [city, setCity] = useState(mp?.city ?? "");
  const [stateVal, setStateVal] = useState(mp?.state ?? "");
  const [address, setAddress] = useState(mp?.address ?? "");
  const [zip, setZip] = useState(mp?.zip ?? "");
  const [addressSearch, setAddressSearch] = useState(mp?.formatted_address ?? [mp?.address, mp?.city, mp?.state, mp?.zip].filter(Boolean).join(", "));
  const [travelRadius, setTravelRadius] = useState(mp?.travel_radius_miles ?? 25);
  const [denominationTags, setDenominationTags] = useState<string[]>(
    mp?.denomination_tags?.length ? mp.denomination_tags : [OPEN_ANY_DENOMINATION]
  );
  const [musicFormatTags, setMusicFormatTags] = useState<string[]>(mp?.music_format_tags ?? []);
  const [yearsInMinistry, setYearsInMinistry] = useState<number | "">(mp?.years_in_ministry ?? "");
  const [churchSizeTags, setChurchSizeTags] = useState<string[]>(mp?.church_size_tags ?? []);
  const [paidPreviously, setPaidPreviously] = useState<boolean | null>(mp?.paid_previously ?? null);
  const [practiceTimeNeeded, setPracticeTimeNeeded] = useState(mp?.practice_time_needed ?? "");
  const [leadTimePreference, setLeadTimePreference] = useState(mp?.lead_time_preference ?? "");
  const [videos, setVideos] = useState<VideoEntry[]>(() => videoEntriesFromProfile(mp));
  const [verifiedAddress, setVerifiedAddress] = useState<VerifiedAddressValue | null>(() => {
    if (!mp?.address_verified_at || mp.lat == null || mp.lng == null) return null;
    return {
      formattedAddress: mp.formatted_address ?? [mp.address, mp.city, mp.state, mp.zip].filter(Boolean).join(", "),
      streetAddress: mp.address ?? "",
      lat: mp.lat,
      lng: mp.lng,
      city: mp.city,
      state: mp.state,
      zip: mp.zip ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addInstrument() {
    setInstruments(prev => [...prev, { instrument: "", skill: "Intermediate", isVolunteer: true, feeMin: 0 }]);
  }
  function updateInstrument(i: number, field: keyof InstrumentEntry, val: string | boolean | number) {
    setInstruments(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }
  function removeInstrument(i: number) {
    setInstruments(prev => prev.filter((_, idx) => idx !== i));
  }
  function toggleDenomination(tag: string) {
    setDenominationTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (tag === OPEN_ANY_DENOMINATION) return [tag];
      return [...prev.filter(t => t !== OPEN_ANY_DENOMINATION), tag];
    });
  }
  function toggleMusicFormat(tag: string) {
    setMusicFormatTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }
  function toggleChurchSize(size: string) {
    setChurchSizeTags(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
  }
  function addVideo() {
    setVideos(prev => [...prev, { url: "", title: "", description: "" }]);
  }
  function updateVideo(i: number, field: keyof VideoEntry, val: string) {
    setVideos(prev => prev.map((video, idx) => idx === i ? { ...video, [field]: val } : video));
  }
  function removeVideo(i: number) {
    setVideos(prev => prev.filter((_, idx) => idx !== i));
  }
  function clearAddressVerification() {
    setVerifiedAddress(null);
  }
  function applyVerifiedAddress(next: VerifiedAddressValue) {
    setVerifiedAddress(next);
    setAddress(next.streetAddress);
    setCity(next.city);
    setStateVal(next.state);
    setZip(next.zip);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const instrumentsArr = uniqueInstruments(instruments.map(e => e.instrument));
    const paidInstruments = instruments.filter(e => e.instrument && !(e.isVolunteer ?? true));
    const globalIsVolunteer = paidInstruments.length === 0;
    const globalFeeMin = paidInstruments.length > 0 ? Math.min(...paidInstruments.map(e => e.feeMin ?? 0)) : 0;
    const globalFeeMax = paidInstruments.length > 0 ? Math.max(...paidInstruments.map(e => e.feeMin ?? 0)) : 0;
    const profileVideos = videos
      .map(video => ({
        url: video.url.trim(),
        title: video.title.trim(),
        description: video.description.trim(),
      }))
      .filter(video => video.url);
    const [{ error: profErr }, { error: mpErr }] = await Promise.all([
      supabase.from("profiles").update({ display_name: displayName }).eq("id", profile.id),
      supabase.from("musician_profiles").update({
        bio,
        available,
        instruments_detail: instruments.filter(e => e.instrument),
        instruments: instrumentsArr,
        primary_instrument: instrumentsArr[0] ?? "",
        experience_notes: experienceNotes,
        gear_notes: gearNotes,
        is_volunteer: globalIsVolunteer,
        fee_min: globalFeeMin,
        fee_max: globalFeeMax,
        city,
        state: stateVal,
        address: address || null,
        zip: zip || null,
        lat: verifiedAddress?.lat ?? null,
        lng: verifiedAddress?.lng ?? null,
        formatted_address: verifiedAddress?.formattedAddress ?? null,
        address_verified_at: verifiedAddress ? new Date().toISOString() : null,
        travel_radius_miles: travelRadius,
        denomination_tags: denominationTags,
        music_format_tags: musicFormatTags,
        years_in_ministry: yearsInMinistry === "" ? null : yearsInMinistry,
        church_size_tags: churchSizeTags,
        paid_previously: paidPreviously,
        practice_time_needed: practiceTimeNeeded || null,
        lead_time_preference: leadTimePreference || null,
        profile_videos: profileVideos,
        youtube_links: profileVideos.map(video => video.url),
      }).eq("profile_id", profile.id),
    ]);
    if (profErr || mpErr) setError((profErr ?? mpErr)!.message);
    else setSaved(true);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="page page--narrow">

      <Section title="About you">
        <div className="field">
          <label className="label">Profile photo</label>
          <AvatarUploader
            profileId={profile.id}
            currentUrl={profile.avatar_url}
            currentPath={profile.avatar_path}
            displayName={profile.display_name}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="displayName">Display name</label>
          <input id="displayName" className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="bio" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Bio
            <span title="Introduce yourself in 2–3 sentences. Highlight your most significant accomplishments — bands you've toured with, albums you've recorded, or notable churches you've served. Keep it concise; churches read many profiles." style={{ cursor: "help", fontSize: 13, color: "var(--sm-fg-4)", lineHeight: 1 }}>ⓘ</span>
          </label>
          <textarea id="bio" className="textarea" rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell churches about yourself and your heart for worship…" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />
          <span style={{ fontSize: 14.5 }}>I&apos;m currently available for bookings</span>
        </label>
      </Section>

      <Section title="Instruments">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {instruments.map((entry, i) => (
            <div key={i} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "12px 14px", background: "var(--sm-bg-1)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="select" value={entry.instrument} onChange={e => updateInstrument(i, "instrument", e.target.value)} style={{ flex: 1 }}>
                  <option value="">Select instrument…</option>
                  {INSTRUMENT_OPTIONS.map(inst => <option key={inst}>{inst}</option>)}
                </select>
                <select className="select" value={entry.skill} onChange={e => updateInstrument(i, "skill", e.target.value)} style={{ width: 150 }}>
                  {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => removeInstrument(i)} aria-label="Remove"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sm-fg-4)", fontSize: 22, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--sm-border-subtle)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13.5 }}>
                  <input type="checkbox" checked={entry.isVolunteer ?? true} onChange={e => updateInstrument(i, "isVolunteer", e.target.checked)} />
                  Open to volunteering (no pay required)
                </label>
                {!(entry.isVolunteer ?? true) && (
                  <div style={{ marginTop: 10, maxWidth: 200 }}>
                    <label className="label" style={{ fontSize: 12 }}>Fee ($ / service)</label>
                    <input type="number" className="input" min={0} value={entry.feeMin ?? 0}
                      onChange={e => updateInstrument(i, "feeMin", Number(e.target.value))} placeholder="0" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={addInstrument} className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>
            + Add instrument
          </button>
        </div>
        {instruments.length > 0 && (
          <p className="help" style={{ marginTop: 8 }}>The first instrument listed is shown as your primary instrument.</p>
        )}
      </Section>

      <Section title="Comfortable serving">
        <div className="field">
          <label className="label">Denomination / tradition</label>
          <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Select denominations / traditions you&apos;re comfortable leading worship in.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DENOMINATION_OPTIONS.map(tag => {
              const active = denominationTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleDenomination(tag)} style={{
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
        </div>
        <div className="field" style={{ marginTop: 20 }}>
          <label className="label">Musical formats</label>
          <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Select the worship service formats you&apos;re comfortable playing in.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MUSICAL_FORMAT_OPTIONS.map(tag => {
              const active = musicFormatTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleMusicFormat(tag)} style={{
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
        </div>
      </Section>

      <Section title="Experience">
        <div className="sm-row-2">
          <div className="field">
            <label className="label" htmlFor="yearsInMinistry">Years in worship ministry</label>
            <input
              id="yearsInMinistry"
              type="number"
              className="input"
              min={0}
              max={60}
              value={yearsInMinistry}
              onChange={e => setYearsInMinistry(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label className="label">Paid to play in church before?</label>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              {[{ val: true, label: "Yes" }, { val: false, label: "No" }].map(opt => (
                <button key={String(opt.val)} type="button" onClick={() => setPaidPreviously(opt.val)} style={{
                  border: `1.5px solid ${paidPreviously === opt.val ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)", padding: "7px 18px",
                  background: paidPreviously === opt.val ? "rgba(228,123,2,0.07)" : "var(--sm-bg-1)",
                  cursor: "pointer", fontSize: 13.5,
                  color: paidPreviously === opt.val ? "var(--sm-accent)" : "var(--sm-fg-2)",
                  fontWeight: paidPreviously === opt.val ? 600 : 400,
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Church sizes served</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {CHURCH_SIZE_OPTIONS.map(size => {
              const active = churchSizeTags.includes(size);
              return (
                <button key={size} type="button" onClick={() => toggleChurchSize(size)} style={{
                  border: `1.5px solid ${active ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)", padding: "5px 14px",
                  background: active ? "rgba(228,123,2,0.07)" : "var(--sm-bg-1)",
                  cursor: "pointer", fontSize: 13.5,
                  color: active ? "var(--sm-accent)" : "var(--sm-fg-2)",
                  fontWeight: active ? 600 : 400,
                }}>{size}</button>
              );
            })}
          </div>
          <p className="help" style={{ marginTop: 6 }}>Average weekly attendance</p>
        </div>
        <div className="sm-row-2" style={{ marginTop: 16 }}>
          <div className="field">
            <label className="label" htmlFor="practiceTime">Practice time needed</label>
            <select id="practiceTime" className="select" value={practiceTimeNeeded} onChange={e => setPracticeTimeNeeded(e.target.value)}>
              <option value="">Select…</option>
              {PRACTICE_TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="leadTime">Lead time preference</label>
            <select id="leadTime" className="select" value={leadTimePreference} onChange={e => setLeadTimePreference(e.target.value)}>
              <option value="">Select…</option>
              {LEAD_TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="gearNotes">Gear / setup</label>
          <textarea
            id="gearNotes"
            className="textarea"
            rows={4}
            value={gearNotes}
            onChange={e => setGearNotes(e.target.value)}
            placeholder="Describe your guitar rig, pedalboard, amp/modeler, keyboard, drum setup, or anything the church should provide."
          />
        </div>
      </Section>

      <Section title="Location & travel">
        <div className="sm-row-2">
          <div style={{ gridColumn: "1 / -1" }}>
            <VerifiedAddressInput
              id="musicianAddress"
              label="Home base address"
              value={addressSearch}
              verifiedAddress={verifiedAddress}
              placeholder="123 Main St, Austin, TX 78701"
              help="Verification enables churches to match within your travel radius."
              onValueChange={setAddressSearch}
              onVerified={applyVerifiedAddress}
              onClear={clearAddressVerification}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="travel">Willing to travel</label>
            <select id="travel" className="select" value={travelRadius} onChange={e => setTravelRadius(Number(e.target.value))}>
              {TRAVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Media links">
        <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Add YouTube videos so churches can hear you play. Titles and descriptions are optional.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {videos.map((video, i) => (
            <div key={i} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 14, background: "var(--sm-bg-1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sm-fg-2)" }}>Video {i + 1}</div>
                {videos.length > 1 && (
                  <button type="button" onClick={() => removeVideo(i)} className="btn btn--ghost btn--sm">
                    Remove
                  </button>
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor={`videoUrl-${i}`}>YouTube URL</label>
                <input
                  id={`videoUrl-${i}`}
                  type="url"
                  className="input"
                  value={video.url}
                  onChange={e => updateVideo(i, "url", e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label className="label" htmlFor={`videoTitle-${i}`}>Title</label>
                <input
                  id={`videoTitle-${i}`}
                  type="text"
                  className="input"
                  value={video.title}
                  onChange={e => updateVideo(i, "title", e.target.value)}
                  placeholder="Live worship set, acoustic demo, keys sample…"
                />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label className="label" htmlFor={`videoDescription-${i}`}>Description</label>
                <textarea
                  id={`videoDescription-${i}`}
                  className="textarea"
                  rows={3}
                  value={video.description}
                  onChange={e => updateVideo(i, "description", e.target.value)}
                  placeholder="Add context: your role, song style, venue, band setup, or anything helpful for a church."
                />
              </div>
            </div>
          ))}
          <button type="button" onClick={addVideo} className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>
            + Add video
          </button>
        </div>
      </Section>

      <StatusBar error={error} saved={saved} saving={saving} />
    </form>
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
