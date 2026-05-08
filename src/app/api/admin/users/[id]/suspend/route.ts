import { NextResponse } from "next/server";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle suspension. POST body: { suspended: boolean, reason?: string }.
// Suspended users can still sign in (so they can read the reason) but
// the RLS policies in the migration prevent them from posting requests
// or messages.
export const POST = withAdminJson(async (
  { actor, admin },
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const suspended = !!body.suspended;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  const { data: target } = await admin
    .from("profiles").select("id, display_name, is_admin").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.is_admin && suspended) {
    return NextResponse.json({ error: "Admin accounts cannot be suspended" }, { status: 400 });
  }

  const { error } = await admin.rpc("admin_set_user_suspension", {
    p_actor_id: actor.id,
    p_actor_email: actor.email,
    p_target_id: id,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, suspended });
});
