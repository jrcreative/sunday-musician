import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";

type VerifyPayload = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type CensusMatch = {
  matchedAddress?: string;
  coordinates?: {
    x?: number;
    y?: number;
  };
  addressComponents?: {
    city?: string;
    state?: string;
    zip?: string;
  };
};

function buildAddress(body: VerifyPayload) {
  return [
    body.address,
    body.city,
    body.state,
    body.zip,
  ].map(part => part?.trim()).filter(Boolean).join(", ");
}

export async function POST(req: Request) {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const body = await req.json().catch(() => null) as VerifyPayload | null;
  const address = body ? buildAddress(body) : "";
  if (!address || !body?.city || !body?.state) {
    return NextResponse.json({ error: "Street address, city, and state are required" }, { status: 400 });
  }

  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Address verification service is unavailable" }, { status: 502 });
    }

    const payload = await res.json() as {
      result?: { addressMatches?: CensusMatch[] };
    };
    const match = payload.result?.addressMatches?.[0];
    const lat = match?.coordinates?.y;
    const lng = match?.coordinates?.x;
    if (!match?.matchedAddress || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "No verified address found" }, { status: 404 });
    }

    return NextResponse.json({
      formattedAddress: match.matchedAddress,
      lat,
      lng,
      city: match.addressComponents?.city ?? body.city,
      state: match.addressComponents?.state ?? body.state,
      zip: match.addressComponents?.zip ?? body.zip ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Could not verify address" }, { status: 502 });
  }
}
