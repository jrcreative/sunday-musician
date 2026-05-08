import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/require-admin";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle suspension. POST body: { suspended: boolean, reason?: string }.
// Suspended users can still sign in (so they can read the reason) but
// the RLS policies in the migration prevent them from posting requests
// or messages.
export const POST = withJsonErrors(async (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const suspended = !!body.suspended;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles").select("id, display_name").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const update = suspended
    ? { suspended_at: new Date().toISOString(), suspend_reason: reason }
    : { suspended_at: null, suspend_reason: null };
  const { error } = await admin.from("profiles").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId: gate.actor.id,
    actorEmail: gate.actor.email,
    action: suspended ? "suspend_user" : "unsuspend_user",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.display_name,
    level: suspended ? "danger" : "success",
    metadata: reason ? { reason } : {},
  });

  return NextResponse.json({ ok: true, suspended });
});
