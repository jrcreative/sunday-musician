import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { HomeClient } from "./HomeClient";

export default async function HomePage() {
  const supabase = await createClient();

  const [
    { count: churchCount },
    { count: musicianCount },
    { count: fulfilledCount },
    { data: musicians },
  ] = await Promise.all([
    supabase.from("church_profiles").select("*", { count: "exact", head: true }),
    supabase.from("musician_profiles").select("*", { count: "exact", head: true }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }).eq("status", "filled"),
    supabase
      .from("musician_profiles")
      .select("id, city, state, instruments, primary_instrument, years_experience, is_volunteer, fee_min, fee_max, travel_radius_miles, bio, rating, review_count, available, profiles(display_name)")
      .order("rating", { ascending: false })
      .limit(100),
  ]);

  const stats = [
    { label: "Churches", value: churchCount ?? 0 },
    { label: "Musicians", value: musicianCount ?? 0 },
    { label: "Services filled", value: fulfilledCount ?? 0 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--sm-bg-2)", fontFamily: "var(--sm-font-sans)" }}>

      {/* Nav */}
      <header style={{ background: "var(--sm-bg-1)", borderBottom: "1px solid var(--sm-border-subtle)", padding: "0 40px", height: 60, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/assets/sm-logo-icon.svg" alt="" width={28} height={28} />
            <span style={{ fontFamily: "var(--sm-font-logo)", fontWeight: 500, letterSpacing: "0.16em", fontSize: 13, textTransform: "uppercase" }}>
              Sunday Musician
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/auth/login" style={{ fontSize: 14, fontWeight: 500, color: "var(--sm-fg-2)", textDecoration: "none", padding: "7px 14px" }}>
              Sign in
            </a>
            <a href="/auth/signup" className="btn btn--primary btn--sm">
              Create account
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "var(--sm-bg-1)", borderBottom: "1px solid var(--sm-border-subtle)", padding: "52px 40px 44px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--sm-accent)", marginBottom: 14 }}>
            The worship musician marketplace
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 14px", lineHeight: 1.15, color: "var(--sm-fg-1)" }}>
            Find the right musician<br />for Sunday morning.
          </h1>
          <p style={{ fontSize: 17, color: "var(--sm-fg-3)", margin: "0 0 28px", lineHeight: 1.6, maxWidth: 520 }}>
            Sunday Musician connects churches with experienced worship musicians — guitarists, pianists, vocalists, and more. Browse profiles, post a request, and book in minutes.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="/auth/signup?role=church" className="btn btn--primary">
              Post a request
            </a>
            <a href="/auth/signup?role=musician" className="btn btn--secondary">
              Join as a musician
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: "var(--sm-bg-2)", borderBottom: "1px solid var(--sm-border-subtle)", padding: "28px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {stats.map(s => (
            <div key={s.label} style={{ padding: "20px 22px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)", marginBottom: 8 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "var(--sm-fg-1)", lineHeight: 1 }}>
                {s.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Browse */}
      <div style={{ padding: "32px 40px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "var(--sm-fg-1)" }}>Browse musicians</h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--sm-fg-3)" }}>
              Create a free account to view full profiles and connect directly.
            </p>
          </div>
          <HomeClient musicians={(musicians ?? []) as Parameters<typeof HomeClient>[0]["musicians"]} />
        </div>
      </div>
    </div>
  );
}
