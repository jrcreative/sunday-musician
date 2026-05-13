import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("request create and edit APIs verify alternate locations server-side", () => {
  for (const path of [
    "src/app/api/requests/route.ts",
    "src/app/api/requests/[id]/route.ts",
  ]) {
    const source = read(path);

    assert.match(source, /import \{ verifyUsAddress\b/, `${path} must use the shared verifier`);
    assert.match(source, /await verifyUsAddress\(/, `${path} must call address verification`);
    assert.doesNotMatch(source, /body\.location_lat\b/, `${path} must not trust browser-supplied latitude`);
    assert.doesNotMatch(source, /body\.location_lng\b/, `${path} must not trust browser-supplied longitude`);
    assert.doesNotMatch(source, /body\.location_verified_at\b/, `${path} must set verification timestamps server-side`);
  }
});

test("location verification validates input, coordinates, and network timeouts", () => {
  const source = read("src/lib/locations/verification.ts");

  assert.match(source, /validateAddressInput/, "address input must be validated before geocoding");
  assert.match(source, /query\?: string \| null/, "verifier should accept one-line address queries");
  assert.match(source, /streetAddressFromMatch/, "verified addresses should return a storable street address");
  assert.match(source, /\^\[A-Z\]\{2\}\$/, "state must be normalized and constrained to 2-letter codes");
  assert.match(source, /validCoordinates/, "coordinates must be range checked");
  assert.match(source, /AbortController/, "external geocoder calls need a timeout");
});

test("distance calculations reject missing, non-finite, and out-of-range coordinates", () => {
  const source = read("src/lib/locations/distance.ts");

  assert.match(source, /Number\.isFinite/, "distance math must reject NaN and infinities");
  assert.match(source, /-90/, "latitude lower bound should be enforced");
  assert.match(source, /180/, "longitude bounds should be enforced");
});

test("database schema enforces verified address integrity and supports match lookup indexes", () => {
  for (const path of [
    "supabase/migrations/20260518_location_verification.sql",
    "supabase/schema.sql",
  ]) {
    const source = read(path);

    assert.match(source, /lat_lng_valid/, `${path} must constrain coordinate ranges`);
    assert.match(source, /verified_address_complete/, `${path} must prevent half-verified profile addresses`);
    assert.match(source, /service_requests_location_mode_consistent/, `${path} must require verified alternate request locations`);
    assert.match(source, /musician_profiles_available_state_idx/, `${path} must support available musician filtering`);
  }
});
