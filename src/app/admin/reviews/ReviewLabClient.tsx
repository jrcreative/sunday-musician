"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ReviewLabPeriod = {
  id: string;
  serviceDate: string;
  revealAt: string;
  releasedAt: string | null;
  churchName: string;
  musicianName: string;
  musicianSubmitted: boolean;
  churchSubmitted: boolean;
  promptMusicianAt: string | null;
  promptChurchAt: string | null;
  reminderMusicianAt: string | null;
  reminderChurchAt: string | null;
  releasedEmailMusicianAt: string | null;
  releasedEmailChurchAt: string | null;
};

export type ReviewLabOption = {
  id: string;
  label: string;
};

type SweepResult = {
  summary: Record<string, number>;
  dryRun: boolean;
  sendEmails: boolean;
};

export function ReviewLabClient({
  periods,
  churches,
  musicians,
}: {
  periods: ReviewLabPeriod[];
  churches: ReviewLabOption[];
  musicians: ReviewLabOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [churchProfileId, setChurchProfileId] = useState(churches[0]?.id ?? "");
  const [musicianProfileId, setMusicianProfileId] = useState(musicians[0]?.id ?? "");
  const [serviceDate, setServiceDate] = useState(yesterday);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastSweep, setLastSweep] = useState<SweepResult | null>(null);

  function done(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
    startTransition(() => router.refresh());
  }

  async function post(path: string, body: object, label: string) {
    setBusy(label);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.error ?? `${label} failed`);
        return null;
      }
      return json;
    } finally {
      setBusy(null);
    }
  }

  async function createScenario() {
    const json = await post("/api/admin/reviews/scenario", {
      churchProfileId,
      musicianProfileId,
      serviceDate,
    }, "create");
    if (json) done(`Review Lab scenario created: ${json.periodId}`);
  }

  async function runSweep(mode: "dry-run" | "no-email-write") {
    const json = await post("/api/admin/reviews/sweep", {
      mode: mode === "dry-run" ? "dry-run" : "write",
      sendEmails: false,
    }, mode);
    if (json) {
      setLastSweep(json as SweepResult);
      done(mode === "dry-run" ? "Dry run complete" : "No-email sweep complete");
    }
  }

  async function periodAction(periodId: string, action: string) {
    if (action === "reset-period" && !confirm("Delete reviews and reset release/email flags for this period?")) return;
    const json = await post(`/api/admin/reviews/${periodId}/action`, { action }, action);
    if (json) done("Period updated");
  }

  return (
    <>
      <div className="a-page">
        <div className="sm-row-2" style={{ gap: 18, alignItems: "start", marginBottom: 24 }}>
          <section className="sm-card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Create review scenario</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--sm-fg-3)" }}>
              Creates a real completed booking and review period between existing profiles.
            </p>
            <div className="field">
              <label className="label">Church</label>
              <select className="select" value={churchProfileId} onChange={e => setChurchProfileId(e.target.value)}>
                {churches.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Musician</label>
              <select className="select" value={musicianProfileId} onChange={e => setMusicianProfileId(e.target.value)}>
                {musicians.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Service date</label>
              <input className="input" type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
            <button className="btn btn--primary" disabled={!!busy || !churchProfileId || !musicianProfileId} onClick={createScenario}>
              {busy === "create" ? "Creating..." : "Create scenario"}
            </button>
          </section>

          <section className="sm-card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Run review sweep</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--sm-fg-3)" }}>
              Uses the same shared sweep logic as the scheduled review cron.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--secondary" disabled={!!busy} onClick={() => runSweep("dry-run")}>Dry run</button>
              <button className="btn btn--primary" disabled={!!busy} onClick={() => runSweep("no-email-write")}>Run without emails</button>
            </div>
            {lastSweep && (
              <pre style={{ marginTop: 14, padding: 12, background: "var(--sm-bg-2)", border: "1px solid var(--sm-border-subtle)", borderRadius: 3, fontSize: 12, overflowX: "auto" }}>
                {JSON.stringify(lastSweep.summary, null, 2)}
              </pre>
            )}
          </section>
        </div>

        <div className="a-table-wrap">
          <div className="a-table-toolbar">
            <span className="count"><strong>{periods.length}</strong> review periods</span>
          </div>
          <table className="a-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Pair</th>
                <th>Reviews</th>
                <th>Release</th>
                <th>Email flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id}>
                  <td>
                    <div>{fmtDate(p.serviceDate)}</div>
                    <div className="secondary">Reveal {fmtDateTime(p.revealAt)}</div>
                  </td>
                  <td>
                    <div>{p.churchName}</div>
                    <div className="secondary">{p.musicianName}</div>
                  </td>
                  <td>
                    <span className={p.churchSubmitted ? "a-pill a-pill--success" : "a-pill"}>Church</span>{" "}
                    <span className={p.musicianSubmitted ? "a-pill a-pill--success" : "a-pill"}>Musician</span>
                  </td>
                  <td>
                    {p.releasedAt
                      ? <span className="a-pill a-pill--success">Released</span>
                      : <span className="a-pill">Held</span>}
                  </td>
                  <td className="secondary">
                    prompts {count([p.promptChurchAt, p.promptMusicianAt])}/2 · reminders {count([p.reminderChurchAt, p.reminderMusicianAt])}/2 · released {count([p.releasedEmailChurchAt, p.releasedEmailMusicianAt])}/2
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn--sm" disabled={!!busy} onClick={() => periodAction(p.id, "complete-service")}>Past service</button>{" "}
                    <button className="btn btn--sm" disabled={!!busy} onClick={() => periodAction(p.id, "reveal-due")}>Reveal due</button>{" "}
                    <button className="btn btn--sm" disabled={!!busy} onClick={() => periodAction(p.id, "release-now")}>Release</button>{" "}
                    <button className="btn btn--sm" disabled={!!busy} onClick={() => periodAction(p.id, "reset-period")}>Reset</button>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                    No review periods yet. Create a scenario to start testing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="a-toast">{toast}</div>}
    </>
  );
}

function count(values: Array<string | null>) {
  return values.filter(Boolean).length;
}

function fmtDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
