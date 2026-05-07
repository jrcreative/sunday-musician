"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

type Role = "church" | "musician";

export default function SignupPage() {
  const [role, setRole] = useState<Role>("church");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, display_name: displayName } },
    });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.href = "/dashboard";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sm-bg-2)", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "var(--sm-bg-1)", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: "40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/assets/sm-logo-icon.svg" alt="Sunday Musician" width={48} height={48} style={{ margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Create your profile</h1>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 14, margin: 0 }}>Join Sunday Musician — free to sign up</p>
        </div>

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div className="field">
            <label className="label">I am a…</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["church", "musician"] as Role[]).map((r) => (
                <button key={r} type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  style={{
                    border: `1.5px solid ${role === r ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                    borderRadius: "var(--sm-radius-sm)",
                    padding: "14px",
                    background: role === r ? "rgba(228,123,2,0.05)" : "var(--sm-bg-1)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)", marginBottom: 2 }}>
                    {r === "church" ? "Church" : "Musician"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                    {r === "church" ? "Post requests, find musicians" : "Find gigs, get booked"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="displayName">
              {role === "church" ? "Church name" : "Your name"}
            </label>
            <input id="displayName" type="text" className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="help">At least 8 characters</div>
          </div>

          <button type="submit" className="btn btn--primary btn--lg" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--sm-fg-3)", marginTop: 24 }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "var(--sm-accent)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
