"use server";

import { createClient } from "@/lib/supabase/server";
import { syncIcalConnection } from "@/lib/calendar/sync-connection";
import { IcalError } from "@/lib/calendar/parse-ical";
import { revalidatePath } from "next/cache";

async function getMusicianId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!mp) throw new Error("No musician profile.");
  return { supabase, musicianId: mp.id };
}

export async function connectIcalCalendar(input: { url: string; label: string }) {
  const url = input.url.trim();
  const label = input.label.trim() || "Calendar";
  if (!url) return { ok: false as const, error: "Calendar URL is required." };

  const { supabase, musicianId } = await getMusicianId();

  const { data: connection, error: insertErr } = await supabase
    .from("calendar_connections")
    .insert({
      musician_profile_id: musicianId,
      kind: "ical",
      label,
      ical_url: url,
    })
    .select("id, musician_profile_id, ical_url")
    .single();

  if (insertErr || !connection) {
    return { ok: false as const, error: insertErr?.message ?? "Could not save calendar." };
  }

  try {
    const result = await syncIcalConnection(supabase, {
      id: connection.id,
      musician_profile_id: connection.musician_profile_id,
      ical_url: connection.ical_url!,
    });
    revalidatePath("/availability");
    return { ok: true as const, ...result };
  } catch (e) {
    // Sync failed — keep the connection so the user can fix the URL, but
    // surface the error.
    const msg = e instanceof IcalError ? e.message : (e as Error).message;
    return { ok: false as const, error: msg, connectionId: connection.id };
  }
}

export async function syncCalendarNow(connectionId: string) {
  const { supabase, musicianId } = await getMusicianId();

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("id, musician_profile_id, ical_url, kind")
    .eq("id", connectionId)
    .single();

  if (!connection || connection.musician_profile_id !== musicianId) {
    return { ok: false as const, error: "Calendar not found." };
  }
  if (connection.kind !== "ical" || !connection.ical_url) {
    return { ok: false as const, error: "This calendar can't be synced this way." };
  }

  try {
    const result = await syncIcalConnection(supabase, {
      id: connection.id,
      musician_profile_id: connection.musician_profile_id,
      ical_url: connection.ical_url,
    });
    revalidatePath("/availability");
    return { ok: true as const, ...result };
  } catch (e) {
    const msg = e instanceof IcalError ? e.message : (e as Error).message;
    return { ok: false as const, error: msg };
  }
}

export async function disconnectCalendar(connectionId: string) {
  const { supabase, musicianId } = await getMusicianId();

  // RLS already enforces ownership, but verify so we can return a clean error.
  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("id, musician_profile_id")
    .eq("id", connectionId)
    .single();

  if (!connection || connection.musician_profile_id !== musicianId) {
    return { ok: false as const, error: "Calendar not found." };
  }

  // Cascade delete on connection_id wipes the synced blocks atomically.
  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("id", connectionId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/availability");
  return { ok: true as const };
}
