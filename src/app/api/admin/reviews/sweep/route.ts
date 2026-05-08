import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/require-admin";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withJsonErrors } from "@/lib/api/handler";
import { sweepReviews } from "@/lib/reviews/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withJsonErrors(async (req: Request) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const dryRun = body.mode === "dry-run";
  const sendEmails = body.sendEmails === true;
  const periodId = typeof body.periodId === "string" ? body.periodId : undefined;
  const admin = createAdminClient();
  const siteUrl = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";

  const summary = await sweepReviews({
    supabase: admin,
    siteUrl,
    write: !dryRun,
    sendEmails,
    periodId,
  });

  await logAdminAction({
    actorId: gate.actor.id,
    actorEmail: gate.actor.email,
    action: dryRun ? "dry_run_review_sweep" : "run_review_sweep",
    targetType: periodId ? "platform" : "platform",
    targetId: periodId ?? null,
    targetLabel: periodId ? "Single review period" : "All review periods",
    metadata: { dryRun, sendEmails, summary },
  });

  return NextResponse.json({ ok: true, dryRun, sendEmails, summary });
});
