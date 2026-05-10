import { musicianCompleteness } from "@/app/(app)/profile/completeness";
import { matchingInstruments } from "@/lib/instruments";
import { distanceMiles, type Coordinates } from "@/lib/locations/distance";
import { scoreRequestQuality, type RequestQualityInput } from "@/lib/requests/quality";

export type ServiceReadinessMusician = {
  displayName: string;
  available?: boolean | null;
  instruments: string[];
  primaryInstrument: string;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  travelRadiusMiles?: number | null;
  bio?: string | null;
  denominationTags?: string[] | null;
  experienceNotes?: string | null;
  gearNotes?: string | null;
  isVolunteer?: boolean | null;
  feeMin?: number | null;
  feeMax?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  profilePercent?: number | null;
  paymentReady?: boolean | null;
  blockedOnServiceDate?: boolean | null;
};

export type ServiceReadinessRequest = RequestQualityInput & {
  serviceType?: string | null;
  serviceStyle?: string | null;
  serviceCoords?: Coordinates | null;
  serviceState?: string | null;
};

export type ServiceReadinessScore = {
  percent: number;
  musicianPercent: number;
  requestPercent: number;
  label: "Strong fit" | "Good fit" | "Possible fit" | "Low fit";
  explanation: string;
  strengths: string[];
  concerns: string[];
  matchedInstruments: string[];
  distance: number | null;
};

const STYLE_WORDS = [
  "contemporary",
  "traditional",
  "gospel",
  "liturgical",
  "hymn",
  "choir",
  "charismatic",
  "modern",
  "organ",
  "acoustic",
];

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function grade(percent: number): ServiceReadinessScore["label"] {
  if (percent >= 82) return "Strong fit";
  if (percent >= 68) return "Good fit";
  if (percent >= 50) return "Possible fit";
  return "Low fit";
}

function listSentence(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function normalizeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function styleScore(request: ServiceReadinessRequest, musician: ServiceReadinessMusician) {
  const target = `${request.serviceStyle ?? ""} ${request.serviceType ?? ""}`.toLowerCase();
  const targetWords = STYLE_WORDS.filter(word => target.includes(word));
  if (targetWords.length === 0) {
    return {
      points: 7,
      strength: clean(request.serviceType) ? `is open to ${request.serviceType} services` : undefined,
      concern: undefined,
    };
  }

  const musicianText = [
    musician.denominationTags?.join(" "),
    musician.bio,
    musician.experienceNotes,
    musician.gearNotes,
    musician.primaryInstrument,
    musician.instruments.join(" "),
  ].join(" ").toLowerCase();
  const matched = targetWords.find(word => musicianText.includes(word));
  return matched
    ? { points: 10, strength: `accepts ${matched} services`, concern: undefined }
    : { points: 4, strength: undefined, concern: `No clear ${targetWords[0]} service fit listed.` };
}

function profilePercentFor(musician: ServiceReadinessMusician) {
  if (typeof musician.profilePercent === "number") return musician.profilePercent;

  return musicianCompleteness({
    bio: musician.bio ?? "",
    city: musician.city ?? "",
    state: musician.state ?? "",
    primary_instrument: musician.primaryInstrument,
    instruments: musician.instruments,
    fee_min: musician.feeMin ?? 0,
    fee_max: musician.feeMax ?? 0,
    is_volunteer: !!musician.isVolunteer,
    travel_radius_miles: musician.travelRadiusMiles ?? 0,
    denomination_tags: musician.denominationTags ?? [],
    experience_notes: musician.experienceNotes ?? "",
    gear_notes: musician.gearNotes ?? "",
  }).percent;
}

export function scoreServiceReadiness(
  request: ServiceReadinessRequest,
  musician: ServiceReadinessMusician,
): ServiceReadinessScore {
  const requestQuality = scoreRequestQuality(request);
  const matchedInstruments = matchingInstruments(
    request.instrumentsNeeded ?? [],
    musician.instruments,
    musician.primaryInstrument,
  );
  const distance = request.serviceCoords
    ? distanceMiles(request.serviceCoords, { lat: musician.lat ?? null, lng: musician.lng ?? null })
    : null;
  const withinTravelRadius = distance == null
    ? !!request.serviceState && !!musician.state && request.serviceState.toLowerCase() === musician.state.toLowerCase()
    : distance <= normalizeNumber(musician.travelRadiusMiles);
  const profilePercent = profilePercentFor(musician);
  const paymentReady = musician.paymentReady ?? (!!musician.isVolunteer || normalizeNumber(musician.feeMin) > 0);
  const reviews = normalizeNumber(musician.reviewCount);
  const rating = normalizeNumber(musician.rating);
  const style = styleScore(request, musician);

  const availabilityPoints = musician.blockedOnServiceDate
    ? 0
    : musician.available === false
      ? 4
      : 25;
  const instrumentPoints = (request.instrumentsNeeded ?? []).length === 0
    ? 16
    : matchedInstruments.length > 0
      ? 20
      : 0;
  const distancePoints = withinTravelRadius ? 15 : distance == null ? 8 : 2;
  const reliabilityPoints = reviews >= 8
    ? 15
    : reviews >= 3
      ? 12
      : rating >= 4.5
        ? 10
        : reviews > 0
          ? 8
          : 4;
  const profilePaymentPoints = Math.round((Math.min(profilePercent, 100) / 100) * 10) + (paymentReady ? 5 : 0);

  const musicianPercent = availabilityPoints + instrumentPoints + distancePoints + style.points + reliabilityPoints + profilePaymentPoints;
  const percent = Math.round((musicianPercent * 0.82) + (requestQuality.percent * 0.18));
  const strengths = unique([
    availabilityPoints >= 20 ? "is available for this service date" : "",
    matchedInstruments.length > 0 ? `plays ${matchedInstruments.join(", ")}` : "",
    distance != null && withinTravelRadius ? `is ${Math.round(distance)} miles away` : "",
    distance == null && withinTravelRadius ? `is in ${request.serviceState}` : "",
    style.strength ?? "",
    reviews >= 8 ? `has completed ${reviews} reviewed services` : reviews > 0 ? `has ${reviews} reviewed services` : "",
    profilePercent >= 80 ? "has a complete profile" : "",
    paymentReady ? "is payment ready" : "",
  ]);
  const concerns = unique([
    musician.blockedOnServiceDate ? "Calendar is blocked for the service date." : "",
    musician.available === false ? "Musician is not currently accepting bookings." : "",
    (request.instrumentsNeeded ?? []).length > 0 && matchedInstruments.length === 0 ? "No listed instrument match." : "",
    !withinTravelRadius ? "Service may be outside the travel radius." : "",
    style.concern ?? "",
    profilePercent < 60 ? "Profile details are still thin." : "",
    !paymentReady ? "Payment or fee readiness is not clear." : "",
  ]);
  const explanationBits = strengths.slice(0, 4);
  const label = grade(percent);

  return {
    percent,
    musicianPercent,
    requestPercent: requestQuality.percent,
    label,
    explanation: explanationBits.length > 0
      ? `${label} because ${musician.displayName} ${listSentence(explanationBits)}.`
      : `${label} based on the available request and musician details.`,
    strengths,
    concerns,
    matchedInstruments,
    distance,
  };
}
