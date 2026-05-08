import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/require-admin";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDateShift(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const POST = withJsonErrors(async (
  req: Request,
  ctx: { params: Promise<{ periodId: string }> },
) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { periodId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : null;
  const admin = createAdminClient();

  const { data: period } = await admin
    .from("review_periods")
    .select("id, booking_id, bookings!inner(id, service_date)")
    .eq("id", periodId)
    .maybeSingle() as unknown as { data: { id: string; booking_id: string; bookings: { id: string; service_date: string } } | null };
  if (!period) return NextResponse.json({ error: "Review period not found" }, { status: 404 });

  if (action === "complete-service") {
    const serviceDate = isoDateShift(-1);
    const revealAt = new Date(`${isoDateShift(6)}T00:00:00.000Z`).toISOString();
    const { error: bookingErr } = await admin.from("bookings").update({ service_date: serviceDate }).eq("id", period.booking_id);
    if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });
    const { error } = await admin.from("review_periods").update({ reveal_at: revealAt }).eq("id", periodId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "reveal-due") {
    const revealAt = new Date(Date.now() - 60_000).toISOString();
    const { error } = await admin.from("review_periods").update({ reveal_at: revealAt }).eq("id", periodId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "release-now") {
    const { error } = await admin.from("review_periods").update({ released_at: new Date().toISOString() }).eq("id", periodId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "reset-period") {
    const { error: deleteErr } = await admin.from("reviews").delete().eq("period_id", periodId);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    const { error } = await admin.from("review_periods").update({
      released_at: null,
      prompt_musician_at: null,
      prompt_church_at: null,
      reminder_musician_at: null,
      reminder_church_at: null,
      released_email_musician_at: null,
      released_email_church_at: null,
    }).eq("id", periodId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "clear-email-flags") {
    const { error } = await admin.from("review_periods").update({
      prompt_musician_at: null,
      prompt_church_at: null,
      reminder_musician_at: null,
      reminder_church_at: null,
      released_email_musician_at: null,
      released_email_church_at: null,
    }).eq("id", periodId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await logAdminAction({
    actorId: gate.actor.id,
    actorEmail: gate.actor.email,
    action: `review_lab_${action}`,
    targetType: "platform",
    targetId: periodId,
    targetLabel: "Review period",
  });

  return NextResponse.json({ ok: true });
});
