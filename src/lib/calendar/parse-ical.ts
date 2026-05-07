import { sync as icalSync } from "node-ical";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXPAND_MONTHS_AHEAD = 12;

export class IcalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcalError";
  }
}

/** Reject obviously-internal targets. Defense in depth — Postgres-fronted Supabase
 *  shouldn't be exposed to user-controlled URL fetches without this check. */
function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    // Apple/iCloud commonly hands out webcal:// — the same content over https.
    const normalized = raw.trim().replace(/^webcal:\/\//i, "https://");
    u = new URL(normalized);
  } catch {
    throw new IcalError("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new IcalError("Only http(s) calendar URLs are supported.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new IcalError("That host isn't reachable from our servers.");
  }
  // IPv4 literal check
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      throw new IcalError("That host isn't reachable from our servers.");
    }
  }
  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    throw new IcalError("That host isn't reachable from our servers.");
  }
  return u;
}

async function fetchIcal(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
      redirect: "follow",
    });
    if (!res.ok) throw new IcalError(`Calendar feed returned HTTP ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new IcalError("Calendar feed is too large.");
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new IcalError("Calendar feed is too large.");
    if (!/^BEGIN:VCALENDAR/m.test(body)) throw new IcalError("That URL doesn't look like a calendar feed.");
    return body;
  } catch (e) {
    if (e instanceof IcalError) throw e;
    if ((e as Error).name === "AbortError") throw new IcalError("Calendar feed timed out.");
    throw new IcalError(`Couldn't reach that calendar feed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export type ParsedBlock = {
  /** Stable per-occurrence id: `${UID}#${occurrenceISO}`. Used for upsert + diff. */
  external_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD inclusive
};

function dateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function durationMs(start: Date, end: Date | undefined): number {
  if (!end) return 0;
  return Math.max(0, end.getTime() - start.getTime());
}

/** Convert ICS text to a list of date-range blocks for the next 12 months.
 *  Handles single events, recurring events (RRULE), exceptions (EXDATE), and
 *  per-occurrence overrides (RECURRENCE-ID). Intentionally ignores SUMMARY /
 *  DESCRIPTION / LOCATION — we never read titles. */
export function expandIcalToBlocks(icsText: string): ParsedBlock[] {
  const parsed = icalSync.parseICS(icsText);
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + EXPAND_MONTHS_AHEAD);
  const now = new Date();
  // Look back a little so events in progress today aren't dropped.
  const floor = new Date(now);
  floor.setDate(floor.getDate() - 1);

  const blocks: ParsedBlock[] = [];

  for (const key of Object.keys(parsed)) {
    const c = parsed[key];
    if (!c || c.type !== "VEVENT") continue;
    const ev = c;
    if (ev.status === "CANCELLED") continue;
    // Only "OPAQUE" events block time; "TRANSPARENT" means free-busy = free.
    if (ev.transparency === "TRANSPARENT") continue;

    if (!ev.rrule) {
      const start = ev.start as Date | undefined;
      if (!start) continue;
      if (start > horizon) continue;
      if ((ev.end as Date | undefined) && (ev.end as Date) < floor) continue;
      blocks.push({
        external_id: `${ev.uid}#${start.toISOString()}`,
        start_date: dateOnly(start),
        end_date: dateOnly((ev.end as Date | undefined) ?? start),
      });
      continue;
    }

    // Recurring — expand within window
    const dur = durationMs(ev.start as Date, ev.end as Date | undefined);
    const occurrences = ev.rrule.between(floor, horizon, true);
    const exdates = ev.exdate ?? {};
    const recurrences = ev.recurrences ?? {};

    for (const occ of occurrences) {
      const occKey = occ.toISOString().slice(0, 10);
      // Cancelled / removed occurrence
      if (exdates[occKey]) continue;

      // Overridden occurrence (different time/duration) — use override values
      const override = recurrences[occKey] ?? recurrences[occ.toISOString()];
      if (override) {
        if (override.status === "CANCELLED") continue;
        const oStart = override.start as Date;
        const oEnd = (override.end as Date | undefined) ?? oStart;
        blocks.push({
          external_id: `${ev.uid}#${oStart.toISOString()}`,
          start_date: dateOnly(oStart),
          end_date: dateOnly(oEnd),
        });
        continue;
      }

      const end = new Date(occ.getTime() + dur);
      blocks.push({
        external_id: `${ev.uid}#${occ.toISOString()}`,
        start_date: dateOnly(occ),
        end_date: dateOnly(end),
      });
    }
  }

  return blocks;
}

/** End-to-end: validate URL, fetch, parse, return blocks. Throws IcalError. */
export async function fetchAndParseIcal(url: string): Promise<ParsedBlock[]> {
  const safe = assertSafeUrl(url);
  const text = await fetchIcal(safe);
  return expandIcalToBlocks(text);
}
