"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MfaFactor = { id: string; status: "verified" | "unverified"; friendly_name: string | null };

export function AccountClient({
  initialEmail,
  initialFactors,
}: {
  initialEmail: string;
  initialFactors: MfaFactor[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EmailChange initialEmail={initialEmail} />
      <PasswordChange />
      <TwoFactor initialFactors={initialFactors} />
      <DataExport />
      <DeleteAccount />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      padding: 20,
      border: "1px solid var(--sm-border-subtle)",
      borderRadius: "var(--sm-radius-sm)",
      background: "var(--sm-bg-1)",
    }}>{children}</section>
  );
}

function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: 0, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────── Email change

function EmailChange({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const dirty = email.trim() !== initialEmail && email.trim().includes("@");

  async function save() {
    if (!dirty || pending) return;
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    if (error) {
      setStatus({ kind: "err", msg: error.message });
    } else {
      setStatus({
        kind: "ok",
        msg: `We sent a confirmation link to ${email.trim()}. Click it from that inbox to finish the change. Your existing email keeps working until you confirm.`,
      });
    }
    setPending(false);
  }

  return (
    <Card>
      <CardTitle
        title="Email"
        subtitle="Used for sign-in and notifications. Changing it sends a confirmation link to the new address."
      />
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input
          type="email"
          className="input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn btn--primary" disabled={!dirty || pending} onClick={save}>
          {pending ? "Sending…" : "Change email"}
        </button>
      </div>
      {status && (
        <div style={{
          marginTop: 12, fontSize: 13, lineHeight: 1.5,
          color: status.kind === "ok" ? "var(--sm-status-success)" : "var(--sm-status-error, #c53030)",
        }}>
          {status.msg}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────── Password change

function PasswordChange() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = pw.length >= 8 && pw === confirm;

  async function save() {
    if (!valid || pending) return;
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setStatus({ kind: "err", msg: error.message });
    } else {
      setStatus({ kind: "ok", msg: "Password updated." });
      setPw(""); setConfirm("");
    }
    setPending(false);
  }

  return (
    <Card>
      <CardTitle title="Password" subtitle="Use at least 8 characters." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="sm-row-2">
        <input
          type="password"
          className="input"
          placeholder="New password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          autoComplete="new-password"
        />
        <input
          type="password"
          className="input"
          placeholder="Confirm new password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {(tooShort || mismatch) && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--sm-fg-3)" }}>
          {tooShort && "Password must be at least 8 characters. "}
          {mismatch && "Passwords don't match."}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="btn btn--primary" disabled={!valid || pending} onClick={save}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
      {status && (
        <div style={{
          marginTop: 12, fontSize: 13,
          color: status.kind === "ok" ? "var(--sm-status-success)" : "var(--sm-status-error, #c53030)",
        }}>{status.msg}</div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────── 2FA

function TwoFactor({ initialFactors }: { initialFactors: MfaFactor[] }) {
  const [factors, setFactors] = useState<MfaFactor[]>(initialFactors);
  const verified = factors.find(f => f.status === "verified") ?? null;
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrSvg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEnroll() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
    });
    if (error || !data) {
      setError(error?.message ?? "Could not start enrollment");
    } else {
      setEnrolling({ factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret });
    }
    setPending(false);
  }

  async function verifyEnroll() {
    if (!enrolling || code.length !== 6 || pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challenge.error || !challenge.data) {
      setError(challenge.error?.message ?? "Could not start challenge");
      setPending(false);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verify.error) {
      setError(verify.error.message);
    } else {
      setFactors(prev => [...prev.filter(f => f.id !== enrolling.factorId), { id: enrolling.factorId, status: "verified", friendly_name: null }]);
      setEnrolling(null);
      setCode("");
    }
    setPending(false);
  }

  async function disable(factorId: string) {
    if (!confirm("Disable two-factor authentication on this account?")) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(error.message);
    } else {
      setFactors(prev => prev.filter(f => f.id !== factorId));
    }
    setPending(false);
  }

  return (
    <Card>
      <CardTitle
        title="Two-factor authentication"
        subtitle="Adds a second step at sign-in using an authenticator app like 1Password, Authy, or Google Authenticator."
      />
      {verified && !enrolling && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--sm-status-success)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Enabled</span>
          </div>
          <button className="btn btn--sm" onClick={() => disable(verified.id)} disabled={pending}>
            Disable 2FA
          </button>
        </div>
      )}
      {!verified && !enrolling && (
        <button className="btn btn--primary" onClick={startEnroll} disabled={pending}>
          {pending ? "Loading…" : "Enable 2FA"}
        </button>
      )}
      {enrolling && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--sm-fg-3)", lineHeight: 1.5, margin: 0 }}>
            Scan this code in your authenticator app, or enter the secret manually.
            Then type the 6-digit code your app shows to confirm.
          </p>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              dangerouslySetInnerHTML={{ __html: enrolling.qrSvg }}
              style={{ width: 140, height: 140, background: "white", padding: 6, borderRadius: 6, border: "1px solid var(--sm-border-subtle)" }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: "var(--sm-fg-3)", marginBottom: 4 }}>Or enter this secret:</div>
              <code style={{ fontSize: 13, padding: "6px 8px", background: "var(--sm-bg-3)", borderRadius: 4, wordBreak: "break-all", display: "inline-block" }}>
                {enrolling.secret}
              </code>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              inputMode="numeric"
              className="input"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123 456"
              style={{ width: 140, fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}
            />
            <button className="btn btn--primary" onClick={verifyEnroll} disabled={code.length !== 6 || pending}>
              {pending ? "Verifying…" : "Confirm"}
            </button>
            <button className="btn" onClick={() => { setEnrolling(null); setCode(""); setError(null); }} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{error}</div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────── Data export

function DataExport() {
  return (
    <Card>
      <CardTitle
        title="Export your data"
        subtitle="Download a JSON file with everything we hold about your account — profile, bookings, messages, reviews, payments."
      />
      <a className="btn" href="/api/account/export" download>
        Download my data
      </a>
    </Card>
  );
}

// ─────────────────────────────────────────── Delete account

function DeleteAccount() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = phrase === "DELETE";

  async function go() {
    if (!armed || pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not delete account");
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardTitle
        title="Delete account"
        subtitle="Permanently removes your profile, listings, messages, reviews, and saved payment methods. Connect (musician) accounts stay at Stripe for tax-reporting on past payouts. This can&apos;t be undone."
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          className="input"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
          placeholder="Type DELETE to confirm"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          className="btn"
          onClick={go}
          disabled={!armed || pending}
          style={{
            background: armed ? "var(--sm-status-error, #b82105)" : undefined,
            color: armed ? "white" : undefined,
            borderColor: armed ? "var(--sm-status-error, #b82105)" : undefined,
          }}
        >
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{error}</div>
      )}
    </Card>
  );
}
