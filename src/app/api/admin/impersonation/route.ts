import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";
import {
  ADMIN_IMPERSONATION_COOKIE,
  ADMIN_IMPERSONATION_TTL_SECONDS,
  createAdminImpersonationToken,
} from "@/lib/admin/impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdminJson(async ({ actor, admin }, req: Request) => {
  const body = await req.json().catch(() => ({}));
  const targetId = typeof body.targetProfileId === "string" ? body.targetProfileId : "";
  if (!targetId) {
    return NextResponse.json({ error: "targetProfileId is required" }, { status: 400 });
  }
  if (targetId === actor.id) {
    return NextResponse.json({ error: "You are already viewing as yourself" }, { status: 400 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, display_name, email, role, deleted_at")
    .eq("id", targetId)
    .maybeSingle();

  if (!target || target.deleted_at) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "start_impersonation",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.display_name,
    level: "warn",
    metadata: { target_email: target.email, target_role: target.role },
  });

  const res = NextResponse.json({
    ok: true,
    redirectTo: "/dashboard",
    target: {
      id: target.id,
      name: target.display_name,
      email: target.email,
      role: target.role,
    },
  });
  res.cookies.set({
    name: ADMIN_IMPERSONATION_COOKIE,
    value: createAdminImpersonationToken({ adminId: actor.id, targetId: target.id }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_IMPERSONATION_TTL_SECONDS,
  });
  return res;
});
