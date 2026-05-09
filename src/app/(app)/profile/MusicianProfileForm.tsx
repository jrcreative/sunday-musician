"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { INSTRUMENT_OPTIONS, uniqueInstruments } from "@/lib/instruments";
import { AvatarUploader } from "./AvatarUploader";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type MusicianProfile = Database["public"]["Tables"]["musician_profiles"]["Row"];
type InstrumentEntry = { instrument: string; skill: string };
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
  const [isVolunteer, setIsVolunteer] = useState(mp?.is_volunteer ?? false);
  const [feeMin, setFeeMin] = useState(mp?.fee_min ?? 0);
  const [feeMax, setFeeMax] = useState(mp?.fee_max ?? 0);
  const [city, setCity] = useState(mp?.city ?? "");
  const [stateVal, setStateVal] = useState(mp?.state ?? "");
  const [address, setAddress] = useState(mp?.address ?? "");
  const [zip, setZip] = useState(mp?.zip ?? "");
  const [travelRadius, setTravelRadius] = useState(mp?.travel_radius_miles ?? 25);
  const [denominationTags, setDenominationTags] = useState<string[]>(mp?.denomination_tags ?? []);
  const [videos, setVideos] = useState<VideoEntry[]>(() => videoEntriesFromProfile(mp));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addInstrument() {
    setInstruments(prev => [...prev, { instrument: "", skill: "Intermediate" }]);
  }
  function updateInstrument(i: number, field: keyof InstrumentEntry, val: string) {
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
  function addVideo() {
    setVideos(prev => [...prev, { url: "", title: "", description: "" }]);
  }
  function updateVideo(i: number, field: keyof VideoEntry, val: string) {
    setVideos(prev => prev.map((video, idx) => idx === i ? { ...video, [field]: val } : video));
  }
  function removeVideo(i: number) {
    setVideos(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const instrumentsArr = uniqueInstruments(instruments.map(e => e.instrument));
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
        is_volunteer: isVolunteer,
        fee_min: isVolunteer ? 0 : feeMin,
        fee_max: isVolunteer ? 0 : feeMax,
        city,
        state: stateVal,
        address: address || null,
        zip: zip || null,
        travel_radius_miles: travelRadius,
        denomination_tags: denominationTags,
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
          <label className="label" htmlFor="bio">Bio</label>
          <textarea id="bio" className="textarea" rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell churches about yourself and your heart for worship…" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />
          <span style={{ fontSize: 14.5 }}>I&apos;m currently available for bookings</span>
        </label>
      </Section>

      <Section title="Instruments">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {instruments.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
        <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Select denominations / traditions you&apos;re comfortable leading worship in.</p>
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
      </Section>

      <Section title="Experience & pay">
        <div className="field">
          <label className="label" htmlFor="experienceNotes">Experience</label>
          <textarea
            id="experienceNotes"
            className="textarea"
            rows={5}
            value={experienceNotes}
            onChange={e => setExperienceNotes(e.target.value)}
            placeholder="Share your church, worship-leading, Sunday service, touring, studio, chart, click, or in-ear experience."
          />
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
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "16px 0 0" }}>
          <input type="checkbox" checked={isVolunteer} onChange={e => setIsVolunteer(e.target.checked)} />
          <span style={{ fontSize: 14.5 }}>I&apos;m open to volunteering (no pay required)</span>
        </label>
        {!isVolunteer && (
          <div className="sm-row-2" style={{ marginTop: 16 }}>
            <div className="field">
              <label className="label" htmlFor="feeMin">Minimum fee ($ / service)</label>
              <input id="feeMin" type="number" className="input" min={0} value={feeMin}
                onChange={e => setFeeMin(Number(e.target.value))} placeholder="0" />
            </div>
            <div className="field">
              <label className="label" htmlFor="feeMax">Maximum fee ($ / service)</label>
              <input id="feeMax" type="number" className="input" min={0} value={feeMax}
                onChange={e => setFeeMax(Number(e.target.value))} placeholder="500" />
            </div>
          </div>
        )}
      </Section>

      <Section title="Location & travel">
        <div className="sm-row-2">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label" htmlFor="address">Street address (optional)</label>
            <input id="address" type="text" className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
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
