export const INSTRUMENT_OPTIONS = [
  "Worship Leader",
  "Acoustic Guitar",
  "Electric Guitar",
  "Bass Guitar",
  "Piano / Keys",
  "Organ",
  "B3 Organ",
  "Drums",
  "Cajon / Hand Percussion",
  "Violin",
  "Viola",
  "Cello",
  "Mandolin",
  "Banjo",
  "Pedal Steel",
  "Lap Steel",
  "Trumpet",
  "Trombone",
  "French Horn",
  "Saxophone",
  "Flute",
  "Clarinet",
  "Lead Vocals",
  "Background Vocals",
  "Sound Tech",
  "Lighting Tech",
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

export function instrumentsIncludeAll(required: string[], available: string[]) {
  const availableSet = new Set(available);
  return required.every(instrument => availableSet.has(instrument));
}

export function matchingInstruments(needed: string[], musicianInstruments: string[], primaryInstrument = "") {
  const musicianSet = new Set([...musicianInstruments, primaryInstrument].filter(Boolean));
  return needed.filter(instrument => musicianSet.has(instrument));
}
