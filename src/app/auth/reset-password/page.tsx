"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sm-bg-2)", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--sm-bg-1)", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/assets/sm-logo-icon.svg" alt="Sunday Musician" width={48} height={48} style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Choose a new password</h1>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 14, margin: 0 }}>
            Set the password you will use to sign in.
          </p>
        </div>

        {submitted ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "12px 14px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-success)", fontSize: 13.5, lineHeight: 1.5 }}>
              Your password has been updated. Sign in with your email and new password.
            </div>
            <Link href="/auth/login" className="btn btn--primary btn--lg" style={{ textAlign: "center", textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
                {error}
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="password">New password</label>
              <input id="password" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <div className="help">At least 8 characters</div>
            </div>
            <div className="field">
              <label className="label" htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? "Saving password…" : "Save password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
