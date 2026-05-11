import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  issueType?: string;
  targetId?: string;
  targetLabel?: string;
  action?: "resolve" | "contact" | "escalate";
  disputeId?: string;
};

const LEVEL = {
  resolve: "success",
  contact: "info",
  escalate: "warn",
} as const;

export const POST = withAdminJson(async ({ actor, admin }, req: Request) => {
  const body = await req.json().catch(() => null) as Payload | null;
  const issueType = typeof body?.issueType === "string" ? body.issueType.slice(0, 80) : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const targetLabel = typeof body?.targetLabel === "string" ? body.targetLabel.slice(0, 240) : null;
  const action = body?.action;
  if (!issueType || !targetId || !action || !["resolve", "contact", "escalate"].includes(action)) {
    return NextResponse.json({ error: "Issue type, target, and action are required" }, { status: 400 });
  }

  if (issueType === "dispute" && body.disputeId && action === "resolve") {
    const { error } = await admin
      .from("booking_disputes")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution: "Resolved from trust and safety queue",
        admin_notes: `Resolved by ${actor.email}`,
      })
      .eq("id", body.disputeId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: `trust_safety_${action}`,
    targetType: issueType.includes("payment") ? "payment" : issueType.includes("request") || issueType === "dispute" || issueType === "cancellation" ? "request" : "user",
    targetId,
    targetLabel,
    level: LEVEL[action],
    metadata: {
      issue_type: issueType,
      dispute_id: body.disputeId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
});
