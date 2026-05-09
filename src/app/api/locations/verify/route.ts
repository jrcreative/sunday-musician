import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { verifyUsAddress, type AddressInput } from "@/lib/locations/verification";

export async function POST(req: Request) {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const body = await req.json().catch(() => null) as AddressInput | null;
  const result = await verifyUsAddress(body ?? {});
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.address);
}
