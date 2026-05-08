import { NextResponse } from "next/server";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle the verified badge. POST body: { verified: boolean }.
export const POST = withAdminJson(async (
  { actor, admin },
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const verified = !!body.verified;

  const { data: target } = await admin
    .from("profiles").select("id, display_name").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await admin.rpc("admin_set_user_verified", {
    p_actor_id: actor.id,
    p_actor_email: actor.email,
    p_target_id: id,
    p_verified: verified,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, verified });
});
