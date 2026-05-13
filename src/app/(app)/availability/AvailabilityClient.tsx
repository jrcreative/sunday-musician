"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { connectIcalCalendar, syncCalendarNow, disconnectCalendar } from "./actions";

type Block = {
  id: string;
  start_date: string;
  end_date: string;
  source: "manual" | "ical" | "google" | "pco";
  note: string | null;
};

type Connection = {
  id: string;
  kind: "ical" | "google" | "pco";
  label: string;
  ical_url: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start === end) return s.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  if (sameMonth) return `${s.toLocaleDateString(undefined, opts)} – ${e.getDate()}, ${e.getFullYear()}`;
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

function parseBlockNote(note: string | null): { timeRange: string | null; displayNote: string } {
  if (!note) return { timeRange: null, displayNote: "" };
  const m = note.match(/^\[(\d{2}:\d{2}-\d{2}:\d{2})\]\s*/);
  if (!m) return { timeRange: null, displayNote: note };
  return { timeRange: m[1], displayNote: note.slice(m[0].length) };
}

function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatTimeRange(range: string): string {
  const [s, e] = range.split("-");
  return `${fmtTime12(s)} – ${fmtTime12(e)}`;
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AvailabilityClient({
  musicianId,
  masterAvailable,
  initialBlocks,
  initialConnections,
}: {
  musicianId: string;
  masterAvailable: boolean;
  initialBlocks: Block[];
  initialConnections: Connection[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [available, setAvailable] = useState(masterAvailable);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [note, setNote] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("13:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showConnect, setShowConnect] = useState(false);
  const [calLabel, setCalLabel] = useState("");
  const [calUrl, setCalUrl] = useState("");
  const [calBusy, setCalBusy] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [busyConn, setBusyConn] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Calendar nav state
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const { fullDayBlockedDates, partialDayBlockedDates } = useMemo(() => {
    // Track for each date: whether any block is full-day (no time prefix)
    const fullDay = new Set<string>();
    const partialOnly = new Set<string>();
    // Map date -> has full-day block
    const dateHasFullDay = new Map<string, boolean>();

    for (const b of blocks) {
      const { timeRange } = parseBlockNote(b.note);
      const s = new Date(b.start_date + "T00:00:00");
      const e = new Date(b.end_date + "T00:00:00");
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const iso = dateISO(d);
        if (!timeRange) {
          // full-day block
          dateHasFullDay.set(iso, true);
        } else {
          // partial block — only mark partial if not already marked as having a full-day block
          if (!dateHasFullDay.has(iso)) {
            dateHasFullDay.set(iso, false);
          }
        }
      }
    }

    for (const [iso, hasFull] of dateHasFullDay) {
      if (hasFull) {
        fullDay.add(iso);
      } else {
        partialOnly.add(iso);
      }
    }

    return { fullDayBlockedDates: fullDay, partialDayBlockedDates: partialOnly };
  }, [blocks]);

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayStr = dateISO(new Date());

  function navMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m += 12; y -= 1; }
    if (m > 11) { m -= 12; y += 1; }
    setViewMonth(m); setViewYear(y);
  }

  async function toggleMaster(next: boolean) {
    setAvailable(next);
    const { error } = await supabase
      .from("musician_profiles")
      .update({ available: next })
      .eq("id", musicianId);
    if (error) {
      setAvailable(!next);
      setError(error.message);
    }
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (end < start) { setError("End date must be after start date."); return; }
    const noteToSave = hasTime
      ? `[${blockStartTime}-${blockEndTime}]${note.trim() ? " " + note.trim() : ""}`
      : note;
    const { data, error } = await supabase
      .from("unavailability_blocks")
      .insert({
        musician_profile_id: musicianId,
        start_date: start,
        end_date: end,
        source: "manual",
        note: noteToSave.trim() || null,
      })
      .select("id, start_date, end_date, source, note")
      .single();
    if (error) { setError(error.message); return; }
    if (data) {
      const next = [...blocks, data as Block].sort((a, b) => a.start_date.localeCompare(b.start_date));
      setBlocks(next);
    }
    setAdding(false);
    setNote("");
    setHasTime(false);
  }

  function deleteBlock(id: string) {
    startTransition(async () => {
      const prev = blocks;
      setBlocks(blocks.filter(b => b.id !== id));
      const { error } = await supabase.from("unavailability_blocks").delete().eq("id", id);
      if (error) { setBlocks(prev); setError(error.message); }
    });
  }

  async function refreshFromServer() {
    const today = todayISO();
    const [{ data: nextBlocks }, { data: nextConns }] = await Promise.all([
      supabase
        .from("unavailability_blocks")
        .select("id, start_date, end_date, source, note")
        .eq("musician_profile_id", musicianId)
        .gte("end_date", today)
        .order("start_date", { ascending: true }),
      supabase
        .from("calendar_connections")
        .select("id, kind, label, ical_url, last_synced_at, last_error")
        .eq("musician_profile_id", musicianId)
        .order("created_at", { ascending: true }),
    ]);
    if (nextBlocks) setBlocks(nextBlocks as Block[]);
    if (nextConns) setConnections(nextConns as Connection[]);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setCalError(null);
    setCalBusy(true);
    const result = await connectIcalCalendar({ url: calUrl, label: calLabel });
    setCalBusy(false);
    if (!result.ok) {
      setCalError(result.error);
      // If connection was created but sync failed, still refresh so it shows.
      if ("connectionId" in result) await refreshFromServer();
      return;
    }
    setShowConnect(false);
    setCalUrl("");
    setCalLabel("");
    await refreshFromServer();
  }

  async function handleSyncNow(connectionId: string) {
    setBusyConn(connectionId);
    const result = await syncCalendarNow(connectionId);
    setBusyConn(null);
    if (!result.ok) setError(result.error);
    await refreshFromServer();
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm("Disconnect this calendar? Synced dates from this calendar will be removed.")) return;
    setBusyConn(connectionId);
    const result = await disconnectCalendar(connectionId);
    setBusyConn(null);
    if (!result.ok) setError(result.error);
    await refreshFromServer();
  }

  return (
    <div className="page">
      <p style={{ fontSize: 14, color: "var(--sm-fg-3)", margin: "0 0 22px", maxWidth: 640, lineHeight: 1.55 }}>
        Block dates you can&apos;t take bookings. Churches searching for a specific date will skip you on those days. You can also pause all bookings with the toggle below.
      </p>

      {/* Master toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>
            {available ? "Accepting bookings" : "Paused — not accepting bookings"}
          </div>
          <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 2 }}>
            {available ? "Churches can find you and send requests." : "You won't appear in search results."}
          </div>
        </div>
        <button
          role="switch"
          aria-checked={available}
          onClick={() => toggleMaster(!available)}
          aria-label={available ? "Pause bookings" : "Enable bookings"}
          style={{
            position: "relative", display: "inline-flex", alignItems: "center",
            width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
            background: available ? "var(--sm-accent)" : "var(--sm-border-subtle)",
            transition: "background 0.2s", padding: 0, flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", left: available ? 24 : 2, width: 22, height: 22,
            borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: "var(--sm-radius-sm)", background: "rgba(184,33,5,0.08)", color: "var(--sm-status-danger, #b82105)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Subscribe to calendar */}
      {(() => {
        const icsUrl = `https://app.sundaymusician.com/api/calendar/${musicianId}`;
        return (
          <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)", marginBottom: 4 }}>Share your bookings with other calendars</div>
            <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginBottom: 12 }}>
              Paste this link into Google Calendar, Apple Calendar, or Outlook to automatically sync your Sunday Musician bookings.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={icsUrl}
                style={{ flex: 1, fontSize: 13, padding: "8px 10px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-2)", color: "var(--sm-fg-2)", minWidth: 0 }}
                onFocus={e => e.target.select()}
              />
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  navigator.clipboard.writeText(icsUrl).then(() => setCopied(true));
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Connected calendars */}
      <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", padding: 18, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>Connected calendars</div>
            <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 2 }}>
              Subscribe to a Google, Apple, or Outlook calendar feed. We sync hourly and never read event titles.
            </div>
          </div>
          {!showConnect && (
            <button className="btn btn--secondary btn--sm" onClick={() => { setShowConnect(true); setCalError(null); }}>
              Connect calendar
            </button>
          )}
        </div>

        {showConnect && (
          <form onSubmit={handleConnect} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 14, background: "var(--sm-bg-2)", marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Name</label>
            <input className="input" value={calLabel} onChange={e => setCalLabel(e.target.value)} placeholder="e.g. Personal Google" style={{ width: "100%", marginBottom: 10 }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>iCal feed URL</label>
            <input className="input" value={calUrl} onChange={e => setCalUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" style={{ width: "100%", marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: "var(--sm-fg-4)", marginBottom: 12, lineHeight: 1.55 }}>
              Find the secret iCal URL in your calendar&apos;s settings — Google: Calendar settings → Integrate calendar → Secret address. Apple: iCloud → share calendar → Public. Outlook: Settings → Calendar → Shared calendars → Publish a calendar.
            </div>
            {calError && (
              <div style={{ padding: 10, borderRadius: "var(--sm-radius-sm)", background: "rgba(184,33,5,0.08)", color: "var(--sm-status-danger, #b82105)", fontSize: 13, marginBottom: 10 }}>
                {calError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn--primary btn--sm" disabled={calBusy}>{calBusy ? "Connecting…" : "Connect"}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowConnect(false); setCalError(null); setCalUrl(""); setCalLabel(""); }}>Cancel</button>
            </div>
          </form>
        )}

        {connections.length === 0 && !showConnect ? (
          <div style={{ padding: 14, textAlign: "center", border: "1px dashed var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-4)", fontSize: 13.5 }}>
            No calendars connected yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {connections.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: c.last_error ? "var(--sm-status-danger, #b82105)" : "var(--sm-fg-4)", marginTop: 2 }}>
                    {c.last_error
                      ? `Sync failed: ${c.last_error}`
                      : `Synced ${timeAgo(c.last_synced_at)}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleSyncNow(c.id)}
                    disabled={busyConn === c.id}
                    className="btn btn--ghost btn--sm"
                  >
                    {busyConn === c.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    onClick={() => handleDisconnect(c.id)}
                    disabled={busyConn === c.id}
                    className="btn btn--ghost btn--sm"
                    style={{ color: "var(--sm-status-danger, #b82105)" }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sm-split sm-split--with-aside" style={{ gap: 24 }}>

        {/* Calendar */}
        <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => navMonth(-1)} className="btn btn--ghost btn--sm" aria-label="Previous month">‹</button>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--sm-fg-1)" }}>{monthLabel}</div>
            <button onClick={() => navMonth(1)} className="btn btn--ghost btn--sm" aria-label="Next month">›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "var(--sm-fg-4)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 6 }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={{ textAlign: "center", padding: "4px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = dateISO(d);
              const isFullBlocked = fullDayBlockedDates.has(iso);
              const isPartialBlocked = partialDayBlockedDates.has(iso);
              const blocked = isFullBlocked || isPartialBlocked;
              const isToday = iso === todayStr;
              const past = iso < todayStr;

              let cellBackground = "var(--sm-bg-1)";
              let cellBorder = isToday ? "1.5px solid var(--sm-accent)" : "1px solid var(--sm-border-subtle)";
              if (isFullBlocked) {
                cellBackground = "rgba(228,123,2,0.1)";
              } else if (isPartialBlocked) {
                cellBackground = "rgba(228,123,2,0.04)";
                cellBorder = "1px dashed var(--sm-accent)";
              }

              return (
                <button
                  key={i}
                  onClick={() => { if (!past) { setStart(iso); setEnd(iso); setAdding(true); } }}
                  disabled={past}
                  style={{
                    aspectRatio: "1 / 1",
                    border: cellBorder,
                    borderRadius: "var(--sm-radius-sm)",
                    background: cellBackground,
                    color: past ? "var(--sm-fg-4)" : blocked ? "var(--sm-accent)" : "var(--sm-fg-1)",
                    fontWeight: blocked ? 600 : 400,
                    fontSize: 13.5,
                    cursor: past ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: past ? 0.5 : 1,
                  }}
                  title={isFullBlocked ? "Blocked — click for details" : isPartialBlocked ? "Partially blocked — click for details" : past ? "Past" : "Click to block this day"}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "var(--sm-fg-3)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(228,123,2,0.1)", border: "1px solid var(--sm-accent)" }} /> Blocked
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(228,123,2,0.04)", border: "1px dashed var(--sm-accent)" }} /> Partial
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid var(--sm-accent)" }} /> Today
            </span>
          </div>
        </div>

        {/* Sidebar: add + list */}
        <div>
          {!adding ? (
            <button className="btn btn--primary" style={{ width: "100%", marginBottom: 16 }} onClick={() => setAdding(true)}>
              Block dates
            </button>
          ) : (
            <form onSubmit={addBlock} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 16, background: "var(--sm-bg-1)", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--sm-fg-1)" }}>Block dates</div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>From</label>
              <input type="date" className="input" value={start} min={todayISO()} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} style={{ width: "100%", marginBottom: 10 }} />
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>To</label>
              <input type="date" className="input" value={end} min={start} onChange={e => setEnd(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--sm-fg-2)", marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} />
                Block a specific time of day
              </label>
              {hasTime && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>From</label>
                    <input type="time" className="input" value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>To</label>
                    <input type="time" className="input" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
              )}
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Note (optional)</label>
              <input type="text" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. vacation" style={{ width: "100%", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn--primary btn--sm" style={{ flex: 1 }}>Save</button>
                <button type="button" className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => { setAdding(false); setNote(""); setHasTime(false); setError(null); }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
            Manual blocks
          </div>
          {(() => {
            const manualBlocks = blocks.filter(b => b.source === "manual");
            if (manualBlocks.length === 0) {
              return (
                <div style={{ padding: 18, textAlign: "center", border: "1px dashed var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-4)", fontSize: 13.5 }}>
                  No manually blocked dates.
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {manualBlocks.map(b => {
                  const parsed = parseBlockNote(b.note);
                  return (
                    <div key={b.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>
                          {fmtRange(b.start_date, b.end_date)}
                          {parsed.timeRange && (
                            <span style={{ fontWeight: 400, color: "var(--sm-accent)", marginLeft: 6 }}>
                              · {formatTimeRange(parsed.timeRange)}
                            </span>
                          )}
                        </div>
                        {parsed.displayNote && (
                          <div style={{ fontSize: 12, color: "var(--sm-fg-4)", marginTop: 2 }}>{parsed.displayNote}</div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteBlock(b.id)}
                        disabled={pending}
                        aria-label="Remove block"
                        style={{ background: "none", border: "none", color: "var(--sm-fg-4)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2 }}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
