import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a password-reset email to the target user's address. We use
// Supabase's admin generateLink to keep the call entirely server-side
// and avoid any rate limit on the public auth endpoint.
export const POST = withAdminJson(async (
  { actor, admin },
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;

  const { data: target } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", id)
    .single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${process.env.SITE_URL ?? process.env.URL ?? ""}/auth/reset-password`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "send_password_reset",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.display_name,
    level: "info",
  });

  return NextResponse.json({ ok: true });
});
