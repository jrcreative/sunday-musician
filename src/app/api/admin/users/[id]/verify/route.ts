import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/require-admin";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle the verified badge. POST body: { verified: boolean }.
export const POST = withJsonErrors(async (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const verified = !!body.verified;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles").select("id, display_name").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await admin.from("profiles").update({ verified }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    actorId: gate.actor.id,
    actorEmail: gate.actor.email,
    action: verified ? "verify_user" : "unverify_user",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.display_name,
    level: verified ? "success" : "info",
  });

  return NextResponse.json({ ok: true, verified });
});
