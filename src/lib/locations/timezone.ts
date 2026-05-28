type LocationInput = {
  state?: string | null;
  lng?: number | null;
};

const STATE_TIME_ZONES: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AR: "America/Chicago",
  AZ: "America/Phoenix",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DC: "America/New_York",
  DE: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  IA: "America/Chicago",
  IL: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/New_York",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  MT: "America/Denver",
  NC: "America/New_York",
  ND: "America/Chicago",
  NE: "America/Chicago",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NV: "America/Los_Angeles",
  NY: "America/New_York",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VA: "America/New_York",
  VT: "America/New_York",
  WA: "America/Los_Angeles",
  WI: "America/Chicago",
  WV: "America/New_York",
  WY: "America/Denver",
};

export function inferTimeZoneForUsLocation(input: LocationInput) {
  const state = input.state?.trim().toUpperCase();
  const lng = input.lng;

  if (state === "ID") return typeof lng === "number" && lng < -114 ? "America/Los_Angeles" : "America/Denver";
  if (state === "FL") return typeof lng === "number" && lng < -85 ? "America/Chicago" : "America/New_York";
  if (state === "IN") return typeof lng === "number" && lng < -86 ? "America/Chicago" : "America/New_York";

  if (state && STATE_TIME_ZONES[state]) return STATE_TIME_ZONES[state];

  if (typeof lng === "number" && Number.isFinite(lng)) {
    if (lng <= -114) return "America/Los_Angeles";
    if (lng <= -102) return "America/Denver";
    if (lng <= -85) return "America/Chicago";
    return "America/New_York";
  }

  return null;
}
