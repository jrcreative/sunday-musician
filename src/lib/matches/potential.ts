import { musicianCompleteness } from "@/app/(app)/profile/completeness";
import { matchingInstruments } from "@/lib/instruments";
import { distanceMiles, type Coordinates } from "@/lib/locations/distance";
import { validCoordinates } from "@/lib/locations/verification";
import { scoreServiceReadiness, type ServiceReadinessScore } from "./readiness";

export type PotentialMatchInput = {
  id: string;
  profile_id: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  address_verified_at: string | null;
  instruments: string[];
  primary_instrument: string;
  experience_notes: string;
  gear_notes: string;
  years_in_ministry: number | null;
  church_size_tags: string[];
  music_format_tags: string[];
  is_volunteer: boolean;
  fee_min: number;
  fee_max: number;
  bio: string;
  denomination_tags: string[];
  rating: number;
  review_count: number;
  available?: boolean;
  travel_radius_miles: number;
  paymentReady?: boolean | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    verified: boolean;
  } | null;
};

export type PotentialMatch = Omit<PotentialMatchInput, "profiles" | "address_verified_at"> & {
  verified: boolean;
  display_name: string;
  avatar_url: string | null;
  completeness: number;
  matchedInstruments: string[];
  distance: number | null;
  areaLabel: string;
  readiness: ServiceReadinessScore;
};

type BuildPotentialMatchesArgs = {
  musicians: PotentialMatchInput[];
  instrumentsNeeded: string[];
  serviceCoords: Coordinates;
  serviceCoordsVerified: boolean;
  serviceState: string | null | undefined;
  serviceType: string;
  serviceStyle?: string | null;
  serviceDate: string;
  serviceTime: string | null;
  useChurchLocation: boolean;
  churchLocationVerified: boolean;
  locationVerified: boolean;
  rehearsals: string;
  techSetup: string[];
  offeredFee: number | null;
  feeType: string;
  setlistUrl: string | null;
  notes: string | null;
  contactedMusicianIds: Set<string>;
  unavailableMusicianIds: Set<string>;
  limit?: number;
};

export function buildPotentialMatches({
  musicians,
  instrumentsNeeded,
  serviceCoords,
  serviceCoordsVerified,
  serviceState,
  serviceType,
  serviceStyle,
  serviceDate,
  serviceTime,
  useChurchLocation,
  churchLocationVerified,
  locationVerified,
  rehearsals,
  techSetup,
  offeredFee,
  feeType,
  setlistUrl,
  notes,
  contactedMusicianIds,
  unavailableMusicianIds,
  limit = 8,
}: BuildPotentialMatchesArgs) {
  const canUseServiceCoords =
    serviceCoordsVerified && validCoordinates(serviceCoords.lat, serviceCoords.lng);

  return musicians
    .map(m => {
      const matched = matchingInstruments(
        instrumentsNeeded,
        m.instruments ?? [],
        m.primary_instrument,
      );
      const canUseMusicianCoords =
        !!m.address_verified_at && validCoordinates(m.lat, m.lng);
      const distance = canUseServiceCoords && canUseMusicianCoords
        ? distanceMiles(serviceCoords, { lat: m.lat, lng: m.lng })
        : null;
      const withinTravelRadius = distance == null
        ? !!serviceState && m.state === serviceState
        : distance <= (m.travel_radius_miles || 0);
      const completeness = musicianCompleteness({
        bio: m.bio,
        city: m.city,
        state: m.state,
        primary_instrument: m.primary_instrument,
        instruments: m.instruments ?? [],
        fee_min: m.fee_min,
        fee_max: m.fee_max,
        is_volunteer: m.is_volunteer,
        travel_radius_miles: m.travel_radius_miles,
        denomination_tags: m.denomination_tags ?? [],
        experience_notes: m.experience_notes,
        gear_notes: m.gear_notes,
        years_in_ministry: m.years_in_ministry,
        church_size_tags: m.church_size_tags ?? [],
        music_format_tags: m.music_format_tags ?? [],
      }, !!m.paymentReady, false).percent;
      const readiness = scoreServiceReadiness({
        serviceType,
        serviceStyle,
        serviceDate,
        serviceTime,
        useChurchLocation,
        churchLocationVerified,
        locationVerified,
        instrumentsNeeded,
        rehearsals,
        techSetup,
        offeredFee,
        feeType,
        setlistUrl,
        notes,
        serviceCoords: canUseServiceCoords ? serviceCoords : null,
        serviceState,
      }, {
        displayName: m.profiles?.display_name ?? "Musician",
        available: m.available ?? true,
        instruments: m.instruments ?? [],
        primaryInstrument: m.primary_instrument,
        city: m.city,
        state: m.state,
        lat: m.lat,
        lng: m.lng,
        travelRadiusMiles: m.travel_radius_miles,
        bio: m.bio,
        denominationTags: m.denomination_tags ?? [],
        experienceNotes: m.experience_notes,
        gearNotes: m.gear_notes,
        yearsInMinistry: m.years_in_ministry,
        churchSizeTags: m.church_size_tags ?? [],
        musicFormatTags: m.music_format_tags ?? [],
        isVolunteer: m.is_volunteer,
        feeMin: m.fee_min,
        feeMax: m.fee_max,
        rating: m.rating,
        reviewCount: m.review_count,
        profilePercent: completeness,
        paymentReady: m.paymentReady,
        blockedOnServiceDate: unavailableMusicianIds.has(m.id),
      });

      return {
        ...m,
        verified: !!m.profiles?.verified,
        display_name: m.profiles?.display_name ?? "Musician",
        avatar_url: m.profiles?.avatar_url ?? null,
        completeness,
        matchedInstruments: matched,
        distance,
        areaLabel: distance == null
          ? `${m.city}, ${m.state}`
          : `${Math.round(distance)} mi away`,
        readiness,
        isPotentialMatch: !contactedMusicianIds.has(m.id) &&
          !unavailableMusicianIds.has(m.id) &&
          matched.length > 0 &&
          withinTravelRadius,
      };
    })
    .filter(m => m.isPotentialMatch)
    .map(m => ({
      id: m.id,
      profile_id: m.profile_id,
      city: m.city,
      state: m.state,
      lat: m.lat,
      lng: m.lng,
      instruments: m.instruments,
      primary_instrument: m.primary_instrument,
      experience_notes: m.experience_notes,
      gear_notes: m.gear_notes,
      years_in_ministry: m.years_in_ministry,
      church_size_tags: m.church_size_tags,
      music_format_tags: m.music_format_tags,
      is_volunteer: m.is_volunteer,
      fee_min: m.fee_min,
      fee_max: m.fee_max,
      bio: m.bio,
      denomination_tags: m.denomination_tags,
      rating: m.rating,
      review_count: m.review_count,
      available: m.available,
      travel_radius_miles: m.travel_radius_miles,
      verified: m.verified,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      completeness: m.completeness,
      matchedInstruments: m.matchedInstruments,
      distance: m.distance,
      areaLabel: m.areaLabel,
      readiness: m.readiness,
    }))
    .sort((a, b) =>
      b.readiness.percent - a.readiness.percent ||
      Number(b.verified) - Number(a.verified) ||
      Number(b.rating) - Number(a.rating) ||
      b.completeness - a.completeness ||
      b.review_count - a.review_count ||
      a.display_name.localeCompare(b.display_name)
    )
    .slice(0, limit);
}
