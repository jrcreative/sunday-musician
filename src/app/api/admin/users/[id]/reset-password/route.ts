import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/require-admin";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a password-reset email to the target user's address. We use
// Supabase's admin generateLink to keep the call entirely server-side
// and avoid any rate limit on the public auth endpoint.
export const POST = withJsonErrors(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const admin = createAdminClient();

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
    actorId: gate.actor.id,
    actorEmail: gate.actor.email,
    action: "send_password_reset",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.display_name,
    level: "info",
  });

  return NextResponse.json({ ok: true });
});
