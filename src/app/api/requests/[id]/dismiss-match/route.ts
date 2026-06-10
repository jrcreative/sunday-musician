import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DismissPayload = {
  musicianProfileId?: string;
};

// Decline a potential match for this specific request. The musician is hidden
// from the request's match list but unaffected everywhere else.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: requestId } = await params;
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "church") {
    return NextResponse.json({ error: "Only churches can decline matches" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as DismissPayload | null;
  if (!body?.musicianProfileId) {
    return NextResponse.json({ error: "Musician profile is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: churchProfile } = await admin
    .from("church_profiles")
    .select("id")
    .eq("profile_id", active.user.id)
    .maybeSingle();
  if (!churchProfile) {
    return NextResponse.json({ error: "Church profile not found" }, { status: 404 });
  }

  const { data: requestRow } = await admin
    .from("service_requests")
    .select("id")
    .eq("id", requestId)
    .eq("church_profile_id", churchProfile.id)
    .maybeSingle();
  if (!requestRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("request_match_dismissals")
    .upsert(
      { request_id: requestId, musician_profile_id: body.musicianProfileId },
      { onConflict: "request_id,musician_profile_id", ignoreDuplicates: true },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
