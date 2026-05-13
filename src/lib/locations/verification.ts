export type AddressInput = {
  query?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type VerifiedAddress = {
  formattedAddress: string;
  streetAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
};

type CensusMatch = {
  matchedAddress?: string;
  coordinates?: {
    x?: number;
    y?: number;
  };
  addressComponents?: {
    fromAddress?: string;
    preDirection?: string;
    preType?: string;
    streetName?: string;
    suffixType?: string;
    suffixDirection?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

export function normalizeState(value?: string | null) {
  return clean(value).toUpperCase();
}

export function validCoordinates(lat: number | null | undefined, lng: number | null | undefined) {
  return typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
}

export function buildAddress(input: AddressInput) {
  const query = clean(input.query);
  if (query) return query;

  return [
    clean(input.address),
    clean(input.city),
    normalizeState(input.state),
    clean(input.zip),
  ].filter(Boolean).join(", ");
}

export function validateAddressInput(input: AddressInput) {
  const query = clean(input.query);
  if (query) {
    if (query.length < 8) {
      return { ok: false as const, error: "Enter a full street address" };
    }
    return {
      ok: true as const,
      value: { query, address: "", city: "", state: "", zip: "" },
    };
  }

  const address = clean(input.address);
  const city = clean(input.city);
  const state = normalizeState(input.state);
  const zip = clean(input.zip);

  if (!address || !city || !state) {
    return { ok: false as const, error: "Street address, city, and state are required" };
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    return { ok: false as const, error: "State must be a 2-letter abbreviation" };
  }
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    return { ok: false as const, error: "ZIP code must be 5 digits or ZIP+4" };
  }

  return {
    ok: true as const,
    value: { address, city, state, zip },
  };
}

function streetAddressFromMatch(match: CensusMatch) {
  const components = match.addressComponents;
  const componentStreet = [
    components?.fromAddress,
    components?.preDirection,
    components?.preType,
    components?.streetName,
    components?.suffixType,
    components?.suffixDirection,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  if (componentStreet) return componentStreet;
  return match.matchedAddress?.split(",")[0]?.trim() ?? "";
}

export async function verifyUsAddress(input: AddressInput): Promise<
  | { ok: true; address: VerifiedAddress }
  | { ok: false; error: string; status: number }
> {
  const validation = validateAddressInput(input);
  if (!validation.ok) return { ok: false, error: validation.error, status: 400 };

  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", buildAddress(validation.value));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: "Address verification service is unavailable", status: 502 };
    }

    const payload = await res.json() as {
      result?: { addressMatches?: CensusMatch[] };
    };
    const match = payload.result?.addressMatches?.[0];
    const lat = match?.coordinates?.y;
    const lng = match?.coordinates?.x;
    if (!match?.matchedAddress || !validCoordinates(lat, lng)) {
      return { ok: false, error: "No verified address found", status: 404 };
    }

    return {
      ok: true,
      address: {
        formattedAddress: match.matchedAddress,
        streetAddress: streetAddressFromMatch(match),
        lat: lat!,
        lng: lng!,
        city: match.addressComponents?.city ?? validation.value.city,
        state: match.addressComponents?.state ?? validation.value.state,
        zip: match.addressComponents?.zip ?? validation.value.zip,
      },
    };
  } catch {
    return { ok: false, error: "Could not verify address", status: 502 };
  } finally {
    clearTimeout(timeout);
  }
}
