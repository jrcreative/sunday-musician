"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Prefs = {
  payment_emails: boolean;
  activity_emails: boolean;
  system_emails: boolean;
};

type Group = {
  key: keyof Prefs;
  label: string;
  description: string;
  examples: string[];
};

const GROUPS: Group[] = [
  {
    key: "payment_emails",
    label: "Payments",
    description: "Money-related updates beyond the critical alerts above.",
    examples: ["Reminder: card will be charged tomorrow", "Receipt delivered", "Weekly earnings summary"],
  },
  {
    key: "activity_emails",
    label: "Activity",
    description: "Bookings, proposals, applications, reviews — the day-to-day flow.",
    examples: [
      "New invitation from a church",
      "Proposal accepted / declined / countered",
      "Booking cancelled by the other side",
      "Reviews submitted and released",
      "Service-day reminders",
    ],
  },
  {
    key: "system_emails",
    label: "System messages",
    description: "Product updates, important announcements, weekly digests.",
    examples: ["Feature releases", "Policy or terms updates", "Weekly digest"],
  },
];

const CRITICAL: Array<{ label: string; for: "musician" | "church" | "both" }> = [
  { label: "Payment captured / payout arrived", for: "musician" },
  { label: "Payment failed / card declined", for: "both" },
  { label: "Card expiring within 30 days", for: "church" },
  { label: "Sign-in from a new device", for: "both" },
  { label: "Password or 2FA changed", for: "both" },
  { label: "Account deletion confirmation", for: "both" },
];

export function NotificationsClient({
  initial,
  role,
}: {
  initial: Prefs;
  role: "musician" | "church";
}) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [savingKey, setSavingKey] = useState<keyof Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof Prefs) {
    if (savingKey) return;
    setSavingKey(key);
    setError(null);
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSavingKey(null); return; }
    // Build the upsert payload statically so the typed column key narrows.
    const payload = {
      profile_id: user.id,
      payment_emails: next.payment_emails,
      activity_emails: next.activity_emails,
      system_emails: next.system_emails,
    };
    const { error: e } = await supabase
      .from("notification_preferences")
      .upsert(payload);
    if (e) {
      setPrefs(prefs); // rollback
      setError(e.message);
    }
    setSavingKey(null);
  }

  return (
    <>
      <section style={{
        padding: 20, border: "1px solid var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)",
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Always on</h2>
        <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Critical alerts for money and account security. These can&apos;t be turned off.
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {CRITICAL
            .filter(c => c.for === "both" || c.for === role)
            .map(c => (
              <li key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--sm-fg-2)" }}>
                <span aria-hidden style={{ color: "var(--sm-status-success)", fontWeight: 700 }}>✓</span>
                {c.label}
              </li>
            ))}
        </ul>
      </section>

      <section style={{
        padding: 20, border: "1px solid var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)",
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Email preferences</h2>
        <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
          Three groups for the rest. Toggle anything you don&apos;t want to hear about.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {GROUPS.map(g => {
            const checked = prefs[g.key];
            const disabled = savingKey === g.key;
            return (
              <div key={g.key} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`Toggle ${g.label} emails`}
                  disabled={disabled}
                  onClick={() => toggle(g.key)}
                  style={{
                    flexShrink: 0,
                    width: 40, height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: checked ? "var(--sm-status-success)" : "var(--sm-bg-3)",
                    position: "relative",
                    cursor: disabled ? "wait" : "pointer",
                    transition: "background 150ms ease",
                    padding: 0,
                    marginTop: 2,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 2, left: checked ? 18 : 2,
                      width: 20, height: 20,
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 150ms ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    }}
                  />
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sm-fg-1)" }}>{g.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", lineHeight: 1.5, marginTop: 2 }}>
                    {g.description}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--sm-fg-4)", lineHeight: 1.5, marginTop: 6 }}>
                    {g.examples.join(" · ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{error}</div>
        )}
      </section>
    </>
  );
}
