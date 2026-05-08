import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sweepReviews } from "@/lib/reviews/sweep";

// Daily sweep for review-related emails. Runs every cron tick (we run hourly
// on Netlify; the queries are idempotent via the *_at tracking columns).
//
// Three jobs, each independent:
//   1. PROMPT — service is in the past, no prompt email sent yet, side hasn't submitted
//   2. REMINDER — within 2 days of reveal, no reminder sent, side hasn't submitted
//   3. RELEASE — reveal_at has passed and period not released → release it (single-side
//      reveal); also email both sides for any newly-released period that hasn't been
//      emailed about yet.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.SITE_URL ?? process.env.URL ?? "";
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }
  if (!siteUrl) {
    return NextResponse.json({ error: "SITE_URL/URL not configured" }, { status: 500 });
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = await sweepReviews({ supabase, siteUrl });

  return NextResponse.json(summary);
}
