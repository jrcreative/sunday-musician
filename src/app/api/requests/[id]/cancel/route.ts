import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/api/handler";
import { requireActiveUser } from "@/lib/api/active-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Church-side cancel: withdraw a request that the church no longer wants to
// fill. The archive_threads_on_request_close trigger archives every open
// thread on this request with reason='request_cancelled' so the chat banner
// can tell musicians the church withdrew (vs. "filled by another musician").
//
// Only allowed when status='open'. Once a request is 'filled' there's a
// confirmed booking — the church needs to go through /api/bookings/cancel
// instead, which handles the payment side and leaves a paper trail.
export const POST = withJsonErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: requestId } = await params;
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "church") {
    return NextResponse.json({ error: "Only churches can cancel their requests" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: church } = await admin
    .from("church_profiles")
    .select("id")
    .eq("profile_id", active.user.id)
    .maybeSingle();
  if (!church) {
    return NextResponse.json({ error: "Church profile not found" }, { status: 404 });
  }

  const { data: request } = await admin
    .from("service_requests")
    .select("id, church_profile_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.church_profile_id !== church.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (request.status !== "open") {
    return NextResponse.json({
      error: "This request has been filled. Cancel the booking from the conversation instead.",
    }, { status: 400 });
  }

  const { error: updateErr } = await admin
    .from("service_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "open");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
