import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";
import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/admin/impersonation";
import { getActiveImpersonation } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdminJson(async ({ actor }) => {
  const active = await getActiveImpersonation();

  if (active) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "stop_impersonation",
      targetType: "user",
      targetId: active.target.id,
      targetLabel: active.target.display_name,
      level: "info",
      metadata: { target_email: active.target.email, target_role: active.target.role },
    });
  }

  const res = NextResponse.json({ ok: true, redirectTo: "/admin/users" });
  res.cookies.delete(ADMIN_IMPERSONATION_COOKIE);
  return res;
});
