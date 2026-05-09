import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileCompleteness } from "../profile/ProfileCompleteness";
import { musicianCompleteness } from "../profile/completeness";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const isChurch = profile?.role === "church";
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";

  // ── Church dashboard ─────────────────────────────────────────────────────
  if (isChurch) {
    const { data: churchProfile } = await supabase
      .from("church_profiles").select("*").eq("profile_id", user.id).single();

    const { data: requests } = churchProfile
      ? await supabase.from("service_requests").select("*").eq("church_profile_id", churchProfile.id).order("service_date").limit(5)
      : { data: [] };

    const today = new Date().toISOString().slice(0, 10);
    const openCount = requests?.filter(r => r.status === "open" && r.service_date >= today).length ?? 0;
    const filledCount = requests?.filter(r => r.status === "filled").length ?? 0;

    // Card-on-file expiry warning. We surface this on the dashboard (not
    // just /profile/billing) because a missed expiry would silently fail
    // the next event-day capture.
    const { data: stripeCustomer } = churchProfile
      ? await supabase
          .from("stripe_customers")
          .select("card_exp_month, card_exp_year, default_payment_method")
          .eq("church_profile_id", churchProfile.id)
          .maybeSingle()
      : { data: null };
    const cardExpiringSoon = (() => {
      if (!stripeCustomer?.default_payment_method || !stripeCustomer.card_exp_month || !stripeCustomer.card_exp_year) return false;
      const expiry = new Date(stripeCustomer.card_exp_year, stripeCustomer.card_exp_month, 1);
      // eslint-disable-next-line react-hooks/purity -- server component, each request is its own render
      const days = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    })();

    return (
      <>
        <Topbar
          title="Dashboard"
          right={<Link href="/requests/new" className="btn btn--primary btn--sm">+ New request</Link>}
        />
        <div className="page page--wide">
          {cardExpiringSoon && (
            <Link
              href="/profile/billing"
              style={{
                display: "block",
                padding: "12px 16px", marginBottom: 20,
                border: "1px solid rgba(184,33,5,0.3)",
                background: "rgba(184,33,5,0.06)",
                borderRadius: "var(--sm-radius-sm)",
                color: "var(--sm-status-error, #b82105)",
                fontSize: 13.5, lineHeight: 1.5,
                textDecoration: "none",
              }}
            >
              <strong>Your card expires soon.</strong> Update it to keep upcoming bookings from failing →
            </Link>
          )}

          <div style={{ marginBottom: 28 }}>
            <div className="sm-eyebrow" style={{ marginBottom: 8 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
              {greeting()}, {firstName}.
            </h2>
            <p style={{ color: "var(--sm-fg-3)", fontSize: 17, margin: 0 }}>
              {openCount > 0 ? `You have ${openCount} open ${openCount === 1 ? "request" : "requests"}.` : "No open requests right now."}
            </p>
          </div>

          <div className="sm-split sm-split--with-aside" style={{ gap: 28 }}>
            <div>
              <div className="sm-row-3" style={{ marginBottom: 32 }}>
                {[
                  { label: "Open requests", val: openCount, sub: "awaiting reply" },
                  { label: "Filled", val: filledCount, sub: "this month" },
                  { label: "Total requests", val: requests?.length ?? 0, sub: "all time" },
                ].map(s => (
                  <div key={s.label} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22 }}>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginTop: 8 }}>{s.val}</div>
                    <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 6 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>
                Active requests
              </div>

              {requests && requests.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {requests
                    .filter(r => r.status === "open" && r.service_date >= today)
                    .slice(0, 3)
                    .map(r => (
                    <Link key={r.id} href={`/requests/${r.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 22, alignItems: "center", padding: "22px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                        <div style={{ textAlign: "center", paddingRight: 22, borderRight: "1px solid var(--sm-border-subtle)", minWidth: 78 }}>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                            {new Date(r.service_date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                          </div>
                          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 2 }}>
                            {new Date(r.service_date + "T12:00:00").getDate()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "var(--sm-fg-1)" }}>{r.title}</div>
                          <div style={{ fontSize: 13.5, color: "var(--sm-fg-3)" }}>
                            {r.service_type}{r.offered_fee != null ? ` · $${r.offered_fee} offered` : ""}
                          </div>
                        </div>
                        <span className="chip chip--warn">Open</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
                  <p style={{ margin: "0 0 16px" }}>No requests yet. Post your first one to find a musician.</p>
                  <Link href="/requests/new" className="btn btn--primary">Post a request</Link>
                </div>
              )}
            </div>

            <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 16px" }}>Quick links</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { href: "/find", label: "Find musicians" },
                  { href: "/messages", label: "Messages" },
                  { href: "/requests", label: "All requests" },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--sm-border-subtle)", color: "var(--sm-fg-1)", textDecoration: "none", fontSize: 14.5, fontWeight: 500 }}>
                    {label} <span style={{ color: "var(--sm-fg-4)" }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Musician dashboard ────────────────────────────────────────────────────
  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id, instruments, city, state, bio, primary_instrument, fee_min, fee_max, is_volunteer, travel_radius_miles, denomination_tags, experience_notes, gear_notes")
    .eq("profile_id", user.id)
    .maybeSingle() as unknown as {
      data: {
        id: string;
        instruments: string[];
        city: string;
        state: string;
        bio: string;
        primary_instrument: string;
        fee_min: number;
        fee_max: number;
        is_volunteer: boolean;
        travel_radius_miles: number;
        denomination_tags: string[];
        experience_notes: string;
        gear_notes: string;
      } | null;
    };

  // Open requests matching musician's instruments
  const today = new Date().toISOString().split("T")[0];
  const myInstruments: string[] = mp?.instruments ?? [];

  type OpenRequestRow = {
    id: string; title: string; service_type: string; service_date: string;
    offered_fee: number | null; fee_type: string; instruments_needed: string[];
    church_profile_id: string;
    church_profiles: { church_name: string; city: string; state: string } | null;
  };

  const { data: rawRequests } = await supabase
    .from("service_requests")
    .select("id, title, service_type, service_date, offered_fee, fee_type, instruments_needed, church_profile_id, church_profiles(church_name, city, state)")
    .eq("status", "open")
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(50) as unknown as { data: OpenRequestRow[] | null };

  const openRequests = (rawRequests ?? [])
    .filter(r =>
      myInstruments.length === 0 ||
      r.instruments_needed.length === 0 ||
      r.instruments_needed.some(i => myInstruments.includes(i))
    )
    .slice(0, 5);

  // Confirmed bookings
  type ThreadRow = {
    id: string;
    church_profile_id: string;
    church_profiles: { church_name: string; city: string; state: string } | null;
    service_requests: { title: string; service_date: string; service_type: string; fee_type: string } | null;
  };
  type AcceptedMsg = {
    thread_id: string;
    proposal: { fee: number | null; feeType: string } | null;
    created_at: string;
  };

  let bookings: {
    threadId: string; churchName: string; title: string;
    serviceDate: string | null; fee: number | null; feeType: string; acceptedAt: string;
  }[] = [];

  if (mp) {
    const { data: threads } = await supabase
      .from("threads")
      .select("id, church_profile_id, church_profiles(church_name, city, state), service_requests(title, service_date, service_type, fee_type)")
      .eq("musician_profile_id", mp.id) as unknown as { data: ThreadRow[] | null };

    if (threads?.length) {
      const { data: accepted } = await supabase
        .from("messages")
        .select("thread_id, proposal, created_at")
        .in("thread_id", threads.map(t => t.id))
        .eq("proposal_status", "accepted")
        .order("created_at", { ascending: false }) as unknown as { data: AcceptedMsg[] | null };

      const byThread = new Map<string, AcceptedMsg>();
      for (const m of accepted ?? []) {
        if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, m);
      }

      bookings = threads
        .filter(t => byThread.has(t.id))
        .map(t => ({
          threadId: t.id,
          churchName: t.church_profiles?.church_name ?? "Church",
          title: t.service_requests?.title ?? "Service",
          serviceDate: t.service_requests?.service_date ?? null,
          fee: byThread.get(t.id)!.proposal?.fee ?? null,
          feeType: byThread.get(t.id)!.proposal?.feeType ?? t.service_requests?.fee_type ?? "per service",
          acceptedAt: byThread.get(t.id)!.created_at,
        }))
        .sort((a, b) => (b.serviceDate ?? b.acceptedAt).localeCompare(a.serviceDate ?? a.acceptedAt))
        .slice(0, 4);
    }
  }

  const totalEarned = bookings.reduce((s, b) => s + (b.fee ?? 0), 0);
  const upcomingCount = bookings.filter(b => b.serviceDate && new Date(b.serviceDate + "T12:00:00") >= new Date()).length;
  const profileCompleteness = musicianCompleteness(mp);

  const stats = [
    { label: "Confirmed bookings", value: bookings.length.toString(), sub: "all time" },
    { label: "Total earned", value: totalEarned > 0 ? `$${totalEarned.toLocaleString()}` : "—", sub: "from agreements" },
    { label: "Upcoming", value: upcomingCount.toString(), sub: upcomingCount === 1 ? "service booked" : "services booked" },
  ];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="page">

        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-4)", marginBottom: 6 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
            {greeting()}, {firstName}.
          </h2>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 16, margin: 0 }}>
            {openRequests.length > 0
              ? `${openRequests.length} open ${openRequests.length === 1 ? "request matches" : "requests match"} your instruments.`
              : "No new requests matching your instruments right now."}
          </p>
        </div>

        {profileCompleteness.percent < 100 && (
          <ProfileCompleteness
            percent={profileCompleteness.percent}
            missing={profileCompleteness.missing}
            previewHref="/profile"
            previewLabel="Complete your profile"
            openInNewTab={false}
          />
        )}

        {/* Stats */}
        <div className="sm-row-3" style={{ marginBottom: 40 }}>
          {stats.map(s => (
            <div key={s.label} style={{ padding: "20px 22px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "var(--sm-fg-1)", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Open requests */}
        <Section
          label="Open requests for you"
          viewAllHref="/open-requests"
          viewAllLabel="View all open requests"
          empty={openRequests.length === 0}
          emptyMessage={
            myInstruments.length === 0
              ? "Add your instruments to your profile to see matching requests."
              : "No open requests matching your instruments right now."
          }
          emptyAction={myInstruments.length === 0 ? { href: "/profile", label: "Update profile" } : { href: "/open-requests", label: "Browse all requests" }}
        >
          {openRequests.map(r => {
            const d = new Date(r.service_date + "T12:00:00");
            const matchedInstrs = r.instruments_needed.filter(i => myInstruments.includes(i));
            return (
              <Link key={r.id} href={`/requests/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 18, alignItems: "center", padding: "16px 20px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", marginBottom: 8 }}>
                  <div style={{ textAlign: "center", paddingRight: 18, borderRight: "1px solid var(--sm-border-subtle)" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                      {d.toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: 10.5, color: "var(--sm-fg-3)", marginTop: 1 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)", marginBottom: 2 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                      {r.church_profiles?.church_name} · {r.church_profiles?.city}, {r.church_profiles?.state}
                      {r.offered_fee != null && ` · $${r.offered_fee}`}
                    </div>
                    {matchedInstrs.length > 0 && (
                      <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {matchedInstrs.map(i => <span key={i} className="chip chip--accent" style={{ fontSize: 11 }}>{i}</span>)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--sm-fg-4)", whiteSpace: "nowrap" }}>View →</span>
                </div>
              </Link>
            );
          })}
        </Section>

        {/* My bookings */}
        <Section
          label="My bookings"
          viewAllHref="/requests"
          viewAllLabel="View all bookings"
          empty={bookings.length === 0}
          emptyMessage="When a church accepts your terms, your confirmed bookings will appear here."
          emptyAction={{ href: "/open-requests", label: "Browse open requests" }}
        >
          {bookings.map(b => {
            const d = b.serviceDate ? new Date(b.serviceDate + "T12:00:00") : null;
            const isPast = d ? d < new Date() : false;
            return (
              <Link key={b.threadId} href={`/messages/${b.threadId}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 18, alignItems: "center", padding: "16px 20px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", marginBottom: 8, opacity: isPast ? 0.7 : 1 }}>
                  <div style={{ textAlign: "center", paddingRight: 18, borderRight: "1px solid var(--sm-border-subtle)" }}>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: isPast ? "var(--sm-fg-4)" : "var(--sm-accent)", fontWeight: 700 }}>
                          {d.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 10.5, color: "var(--sm-fg-3)", marginTop: 1 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--sm-fg-4)" }}>TBD</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)", marginBottom: 2 }}>{b.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>{b.churchName}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {b.fee != null ? (
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--sm-fg-1)" }}>${b.fee}</div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>Volunteer</div>
                    )}
                    <span className={isPast ? "chip" : "chip chip--success"} style={{ fontSize: 11, marginTop: 4, display: "inline-block" }}>
                      {isPast ? "Done" : "Upcoming"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>
      </div>
    </>
  );
}

function Section({ label, viewAllHref, viewAllLabel, empty, emptyMessage, emptyAction, children }: {
  label: string;
  viewAllHref: string;
  viewAllLabel: string;
  empty: boolean;
  emptyMessage: string;
  emptyAction: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)" }}>{label}</div>
        <Link href={viewAllHref} style={{ fontSize: 12.5, color: "var(--sm-accent)", textDecoration: "none", fontWeight: 500 }}>
          {viewAllLabel} →
        </Link>
      </div>
      {empty ? (
        <div style={{ padding: "28px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", textAlign: "center", background: "var(--sm-bg-1)" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--sm-fg-3)" }}>{emptyMessage}</p>
          <Link href={emptyAction.href} className="btn btn--secondary btn--sm">{emptyAction.label}</Link>
        </div>
      ) : children}
    </div>
  );
}
