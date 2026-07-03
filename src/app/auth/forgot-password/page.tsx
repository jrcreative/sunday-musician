"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sm-bg-2)", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--sm-bg-1)", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/assets/sm-logo-icon.svg" alt="Sunday Musician" width={48} height={48} style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Reset your password</h1>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 14, margin: 0 }}>
            Enter the email connected to your Sunday Musician profile.
          </p>
        </div>

        {submitted ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "12px 14px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-success)", fontSize: 13.5, lineHeight: 1.5 }}>
              If that email exists in Sunday Musician, you will receive a password reset link shortly.
            </div>
            <Link href="/auth/login" className="btn btn--primary btn--lg" style={{ textAlign: "center", textDecoration: "none" }}>
              Back to sign in
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
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? "Sending reset link…" : "Send reset link"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--sm-fg-3)", marginTop: 24 }}>
          Remember your password?{" "}
          <Link href="/auth/login" style={{ color: "var(--sm-accent)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
