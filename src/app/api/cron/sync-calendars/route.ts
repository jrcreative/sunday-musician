import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { syncIcalConnection } from "@/lib/calendar/sync-connection";

// Hourly sweep: pulls every iCal connection whose last sync is older than the
// stale threshold. Auth via bearer token to prevent abuse — set CRON_SECRET in
// the deployment environment and have your scheduler send `Authorization: Bearer <secret>`.

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // node-ical needs Node, not Edge

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

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
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: due, error } = await supabase
    .from("calendar_connections")
    .select("id, musician_profile_id, ical_url, last_synced_at")
    .eq("kind", "ical")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (due ?? []).filter(c => c.ical_url).map(c =>
      syncIcalConnection(supabase, {
        id: c.id,
        musician_profile_id: c.musician_profile_id,
        ical_url: c.ical_url!,
      })
    )
  );

  const summary = {
    attempted: results.length,
    succeeded: results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length,
  };
  return NextResponse.json(summary);
}
