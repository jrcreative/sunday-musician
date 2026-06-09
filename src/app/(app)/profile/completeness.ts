export type MusicianCompletenessProfile = {
  bio: string;
  city: string;
  state: string;
  primary_instrument: string;
  instruments: string[];
  fee_min: number;
  fee_max: number;
  is_volunteer: boolean;
  travel_radius_miles: number;
  denomination_tags: string[];
  experience_notes: string;
  gear_notes: string;
  years_in_ministry: number | null;
  church_size_tags: string[];
  music_format_tags: string[];
} | null;

export type ChurchCompletenessProfile = {
  church_name: string;
  city: string;
  state: string;
  capacity: number | null;
  service_count: number | null;
  musical_style: string | null;
  denomination: string | null;
  worship_theology: string | null;
  music_value: string | null;
  contact_name: string | null;
} | null;

export function musicianCompleteness(mp: MusicianCompletenessProfile) {
  if (!mp) return { percent: 0, missing: ["complete profile"] };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "city / state", ok: !!mp.city && !!mp.state },
    { label: "primary instrument", ok: !!mp.primary_instrument },
    { label: "instruments list", ok: mp.instruments.length > 0 },
    { label: "bio (40+ chars)", ok: mp.bio.trim().length >= 40 },
    { label: "experience", ok: (mp.years_in_ministry != null && mp.years_in_ministry >= 0) || mp.experience_notes.trim().length >= 40 },
    { label: "music formats", ok: mp.music_format_tags.length > 0 },
    { label: "gear / setup", ok: mp.gear_notes.trim().length >= 20 },
    { label: "fee range", ok: mp.is_volunteer || (mp.fee_min > 0 && mp.fee_max > 0) },
    { label: "travel radius", ok: mp.travel_radius_miles > 0 },
    { label: "denomination / tradition", ok: mp.denomination_tags.length > 0 },
  ];
  const ok = checks.filter(c => c.ok).length;
  return {
    percent: Math.round((ok / checks.length) * 100),
    missing: checks.filter(c => !c.ok).map(c => c.label),
  };
}

export function churchCompleteness(cp: ChurchCompletenessProfile) {
  if (!cp) return { percent: 0, missing: ["complete profile"] };
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "church name", ok: !!cp.church_name },
    { label: "city / state", ok: !!cp.city && !!cp.state },
    { label: "contact person", ok: !!cp.contact_name },
    { label: "denomination", ok: !!cp.denomination },
    { label: "capacity", ok: !!cp.capacity },
    { label: "service count", ok: !!cp.service_count },
    { label: "musical style", ok: !!cp.musical_style },
    { label: "worship theology", ok: !!cp.worship_theology },
  ];
  const ok = checks.filter(c => c.ok).length;
  return {
    percent: Math.round((ok / checks.length) * 100),
    missing: checks.filter(c => !c.ok).map(c => c.label),
  };
}
