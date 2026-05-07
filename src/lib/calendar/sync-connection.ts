import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchAndParseIcal, IcalError } from "./parse-ical";

type DB = SupabaseClient<Database>;

export type SyncResult = {
  added: number;
  removed: number;
  total: number;
};

/** Pull the latest blocks for a single iCal connection and reconcile against
 *  what's already stored. Idempotent: safe to call repeatedly. */
export async function syncIcalConnection(
  supabase: DB,
  connection: { id: string; musician_profile_id: string; ical_url: string }
): Promise<SyncResult> {
  let parsed;
  try {
    parsed = await fetchAndParseIcal(connection.ical_url);
  } catch (e) {
    const msg = e instanceof IcalError ? e.message : (e as Error).message;
    await supabase
      .from("calendar_connections")
      .update({ last_error: msg, last_synced_at: new Date().toISOString() })
      .eq("id", connection.id);
    throw e;
  }

  const { data: existing } = await supabase
    .from("unavailability_blocks")
    .select("id, external_id, start_date, end_date")
    .eq("connection_id", connection.id);

  const existingByExt = new Map<string, { id: string; start_date: string; end_date: string }>();
  for (const row of existing ?? []) {
    if (row.external_id) existingByExt.set(row.external_id, row);
  }

  const desiredByExt = new Map<string, typeof parsed[number]>();
  for (const b of parsed) desiredByExt.set(b.external_id, b);

  const toInsert: {
    musician_profile_id: string;
    connection_id: string;
    source: "ical";
    external_id: string;
    start_date: string;
    end_date: string;
  }[] = [];
  const toUpdate: { id: string; start_date: string; end_date: string }[] = [];

  for (const [ext, b] of desiredByExt) {
    const existing = existingByExt.get(ext);
    if (!existing) {
      toInsert.push({
        musician_profile_id: connection.musician_profile_id,
        connection_id: connection.id,
        source: "ical",
        external_id: ext,
        start_date: b.start_date,
        end_date: b.end_date,
      });
    } else if (existing.start_date !== b.start_date || existing.end_date !== b.end_date) {
      toUpdate.push({ id: existing.id, start_date: b.start_date, end_date: b.end_date });
    }
  }

  const toDeleteIds: string[] = [];
  for (const [ext, row] of existingByExt) {
    if (!desiredByExt.has(ext)) toDeleteIds.push(row.id);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("unavailability_blocks").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("unavailability_blocks")
      .update({ start_date: u.start_date, end_date: u.end_date })
      .eq("id", u.id);
    if (error) throw new Error(error.message);
  }
  if (toDeleteIds.length > 0) {
    const { error } = await supabase
      .from("unavailability_blocks")
      .delete()
      .in("id", toDeleteIds);
    if (error) throw new Error(error.message);
  }

  await supabase
    .from("calendar_connections")
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq("id", connection.id);

  return {
    added: toInsert.length,
    removed: toDeleteIds.length,
    total: parsed.length,
  };
}
