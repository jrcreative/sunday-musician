"use client";

import { useState } from "react";

export type PayoutAccount = {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
} | null;

export function PayoutSettings({ initial }: { initial: PayoutAccount }) {
  const [acct] = useState<PayoutAccount>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = acct
    ? acct.charges_enabled && acct.payouts_enabled && acct.details_submitted
      ? "ready"
      : "pending"
    : "none";

  async function callApi(path: string): Promise<{ url: string }> {
    const res = await fetch(path, { method: "POST" });
    const text = await res.text();
    let json: { url?: string; error?: string } = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }
    return { url: json.url };
  }

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await callApi("/api/stripe/connect/onboard");
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function openDashboard() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await callApi("/api/stripe/connect/dashboard");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sm-card" style={{ padding: 24, marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Payouts</h2>
      <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", marginBottom: 16 }}>
        Connect your bank account through Stripe to receive payment for bookings.
        Payouts arrive after each service date.
      </p>

      {status === "ready" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--sm-status-success)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Connected — ready to accept bookings</span>
          </div>
          <button className="btn btn--sm" onClick={openDashboard} disabled={busy}>
            {busy ? "Opening…" : "Open Stripe dashboard"}
          </button>
        </div>
      )}

      {status === "pending" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--sm-accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Onboarding incomplete</span>
          </div>
          <button className="btn btn--primary btn--sm" onClick={startOnboarding} disabled={busy}>
            {busy ? "Loading…" : "Continue onboarding"}
          </button>
        </div>
      )}

      {status === "none" && (
        <button className="btn btn--primary" onClick={startOnboarding} disabled={busy}>
          {busy ? "Loading…" : "Connect with Stripe"}
        </button>
      )}

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{error}</div>
      )}
    </section>
  );
}
