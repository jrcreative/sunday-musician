"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.href = "/dashboard";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sm-bg-2)", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--sm-bg-1)", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/assets/sm-logo-icon.svg" alt="Sunday Musician" width={48} height={48} style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Welcome back</h1>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 14, margin: 0 }}>Sign in to your Sunday Musician account</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
              {error}
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label className="label" htmlFor="password">Password</label>
              <Link href="/auth/forgot-password" style={{ color: "var(--sm-accent)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Forgot password?
              </Link>
            </div>
            <input id="password" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--sm-fg-3)", marginTop: 24 }}>
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" style={{ color: "var(--sm-accent)", fontWeight: 600, textDecoration: "none" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
