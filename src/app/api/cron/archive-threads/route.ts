import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Daily sweep that archives stale threads. Two cases:
//   1. Past-service: the service date on the request has passed. The work is
//      done (or the date came and went) — no point in keeping the thread open.
//   2. Stale: no message in 21 days and no accepted proposal. Cuts down inbox
//      noise from conversations that fizzled.
//
// Threads where the request was filled/cancelled are already archived by a
// trigger, so this only catches the time-based cases.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const summary = { past_service: 0, stale: 0 };

  // ── Past-service: thread's request has service_date < today.
  // We pull thread.id by joining service_requests via the request_id FK.
  const { data: pastRows } = await supabase
    .from("threads")
    .select("id, service_requests!inner(service_date)")
    .is("archived_at", null)
    .lt("service_requests.service_date", today) as unknown as { data: { id: string }[] | null };

  if (pastRows && pastRows.length > 0) {
    const ids = pastRows.map(r => r.id);
    const { error } = await supabase
      .from("threads")
      .update({ archived_at: new Date().toISOString(), archive_reason: "past_service" })
      .in("id", ids);
    if (!error) summary.past_service = ids.length;
  }

  // ── Stale: updated_at older than cutoff and no accepted proposal.
  // Two-pass: fetch candidates, then filter by accepted-proposal absence.
  const { data: candidates } = await supabase
    .from("threads")
    .select("id")
    .is("archived_at", null)
    .lt("updated_at", staleCutoff);

  if (candidates && candidates.length > 0) {
    const ids = candidates.map(r => r.id);
    const { data: withAccepted } = await supabase
      .from("messages")
      .select("thread_id")
      .in("thread_id", ids)
      .eq("kind", "proposal")
      .eq("proposal_status", "accepted");
    const acceptedSet = new Set((withAccepted ?? []).map(m => m.thread_id));
    const toArchive = ids.filter(id => !acceptedSet.has(id));
    if (toArchive.length > 0) {
      const { error } = await supabase
        .from("threads")
        .update({ archived_at: new Date().toISOString(), archive_reason: "stale" })
        .in("id", toArchive);
      if (!error) summary.stale = toArchive.length;
    }
  }

  return NextResponse.json(summary);
}
