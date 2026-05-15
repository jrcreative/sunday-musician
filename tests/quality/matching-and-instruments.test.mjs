import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("instrument options have one source of truth", () => {
  const source = read("src/lib/instruments.ts");
  const exportedLists = source.match(/export const INSTRUMENT_OPTIONS/g) ?? [];

  assert.equal(exportedLists.length, 1, "there should be exactly one exported instrument option list");
  assert.match(source, /as const/, "instrument options should preserve literal option types");

  for (const path of [
    "src/app/(app)/requests/new/NewRequestForm.tsx",
    "src/app/(app)/profile/MusicianProfileForm.tsx",
    "src/app/(app)/find/FindMusiciansClient.tsx",
    "src/app/(app)/open-requests/OpenRequestsClient.tsx",
  ]) {
    assert.match(read(path), /INSTRUMENT_OPTIONS/, `${path} should consume the central instrument list`);
  }
});

test("potential match logic is centralized and keeps ranking priorities explicit", () => {
  const page = read("src/app/(app)/requests/[id]/page.tsx");
  const helper = read("src/lib/matches/potential.ts");
  const readiness = read("src/lib/matches/readiness.ts");
  const instruments = read("src/lib/instruments.ts");
  const findPage = read("src/app/(app)/find/FindMusiciansClient.tsx");

  assert.match(page, /buildPotentialMatches/, "request detail page should use the shared matching helper");
  assert.match(page, /scoreServiceReadiness/, "applicants should show the same readiness score as potential matches");

  const readinessRank = helper.indexOf("b.readiness.percent - a.readiness.percent");
  const verifiedRank = helper.indexOf("Number(b.verified) - Number(a.verified)");
  const ratingRank = helper.indexOf("Number(b.rating) - Number(a.rating)");
  const completenessRank = helper.indexOf("b.completeness - a.completeness");

  assert.ok(readinessRank >= 0, "service readiness must rank first");
  assert.ok(verifiedRank >= 0, "verified musicians must rank first");
  assert.ok(verifiedRank > readinessRank, "verification must rank after service readiness");
  assert.ok(ratingRank > verifiedRank, "rating must rank after verification");
  assert.ok(completenessRank > ratingRank, "profile completeness must rank after rating");
  assert.match(readiness, /availabilityPoints/, "readiness should account for availability");
  assert.match(readiness, /instrumentPoints/, "readiness should account for instrument fit");
  assert.match(readiness, /distancePoints/, "readiness should account for distance");
  assert.match(readiness, /styleScore/, "readiness should account for service style");
  assert.match(readiness, /reliabilityPoints/, "readiness should account for reliability");
  assert.match(readiness, /profilePaymentPoints/, "readiness should account for profile and payment readiness");
  assert.match(instruments, /instrumentsIncludeAll[\s\S]*required\.every/, "multi-select instrument filters need AND semantics");
  assert.match(findPage, /instrumentsIncludeAll\(selectedInstruments, \[m\.primary_instrument, \.\.\.m\.instruments\]/, "find filters should narrow when more instruments are selected");
  assert.doesNotMatch(findPage, /instrumentsOverlap\(selectedInstruments/, "find filters should not use OR semantics for selected instruments");
});

test("potential matching uses verified coordinates before radius checks", () => {
  const helper = read("src/lib/matches/potential.ts");
  const requestPage = read("src/app/(app)/requests/[id]/page.tsx");

  assert.match(helper, /serviceCoordsVerified/, "service coordinates need an explicit verification flag");
  assert.match(helper, /address_verified_at/, "musician coordinates need verified address data");
  assert.match(helper, /validCoordinates/, "matching should reject malformed coordinates");
  assert.match(requestPage, /location_verified_at/, "request page must select request location verification metadata");
  assert.match(requestPage, /church_profiles\(church_name, city, state, lat, lng, address_verified_at, musical_style\)/, "church location verification metadata must be selected");
});
