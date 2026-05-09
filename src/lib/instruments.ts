export const INSTRUMENT_OPTIONS = [
  "Worship Leader",
  "Acoustic Guitar",
  "Electric Guitar",
  "Bass Guitar",
  "Piano / Keys",
  "Organ",
  "Drums",
  "Cajon / Hand Percussion",
  "Violin",
  "Viola",
  "Cello",
  "Trumpet",
  "Trombone",
  "French Horn",
  "Saxophone",
  "Flute",
  "Clarinet",
  "Lead Vocals",
  "Background Vocals",
  "Other",
] as const;

export type InstrumentOption = typeof INSTRUMENT_OPTIONS[number];

export function uniqueInstruments(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function instrumentsOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.some(instrument => rightSet.has(instrument));
}

export function matchingInstruments(needed: string[], musicianInstruments: string[], primaryInstrument = "") {
  const musicianSet = new Set([...musicianInstruments, primaryInstrument].filter(Boolean));
  return needed.filter(instrument => musicianSet.has(instrument));
}
