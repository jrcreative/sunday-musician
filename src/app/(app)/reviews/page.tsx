import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { redirect } from "next/navigation";
import Link from "next/link";

type ProfileRole = "musician" | "church";

type PeriodSummary = {
  period_id: string;
  service_date: string;
  reveal_at: string;
  released_at: string | null;
  myReviewSubmitted: boolean;
  otherReviewSubmitted: boolean;
  counterpartyName: string;
  counterpartyHref: string;
  myRole: "musician" | "church";
};

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");
  const role = profile.role as ProfileRole;

  // Find this user's profile id (church_profile or musician_profile)
  const profileTable = role === "church" ? "church_profiles" : "musician_profiles";
  const { data: myProfile } = await supabase
    .from(profileTable).select("id").eq("profile_id", user.id).maybeSingle();
  if (!myProfile) redirect("/profile");
  const myProfileId = (myProfile as { id: string }).id;

  // Fetch all periods this user is part of, with the booking + counterparty info.
  const { data: periodsRaw } = await supabase
    .from("review_periods")
    .select(`
      id, reveal_at, released_at,
      bookings!inner (
        id, service_date, musician_profile_id, church_profile_id,
        musician_profiles ( id, profiles ( display_name ) ),
        church_profiles ( id, church_name )
      ),
      reviews ( reviewer_role )
    `)
    .order("reveal_at", { ascending: false }) as unknown as { data: Array<{
      id: string;
      reveal_at: string;
      released_at: string | null;
      bookings: {
        id: string;
        service_date: string;
        musician_profile_id: string;
        church_profile_id: string;
        musician_profiles: { id: string; profiles: { display_name: string } | null } | null;
        church_profiles: { id: string; church_name: string } | null;
      } | null;
      reviews: { reviewer_role: "musician" | "church" }[];
    }> | null };

  const periods: PeriodSummary[] = (periodsRaw ?? [])
    .filter(p => p.bookings && (
      role === "church"
        ? p.bookings.church_profile_id === myProfileId
        : p.bookings.musician_profile_id === myProfileId
    ))
    .map(p => {
      const b = p.bookings!;
      const myReviewerRole = role;
      const myReviewSubmitted = p.reviews.some(r => r.reviewer_role === myReviewerRole);
      const otherReviewSubmitted = p.reviews.some(r => r.reviewer_role !== myReviewerRole);
      const counterpartyName = role === "church"
        ? (b.musician_profiles?.profiles?.display_name ?? "Musician")
        : (b.church_profiles?.church_name ?? "Church");
      const counterpartyHref = role === "church"
        ? `/musicians/${b.musician_profile_id}`
        : `/musicians/${b.musician_profile_id}`; // churches don't have public profile pages yet
      return {
        period_id: p.id,
        service_date: b.service_date,
        reveal_at: p.reveal_at,
        released_at: p.released_at,
        myReviewSubmitted,
        otherReviewSubmitted,
        counterpartyName,
        counterpartyHref,
        myRole: myReviewerRole,
      };
    });

  const today = new Date().toISOString().slice(0, 10);
  const pending = periods.filter(p => !p.myReviewSubmitted && p.service_date <= today);
  const waitingOnOther = periods.filter(p => p.myReviewSubmitted && !p.released_at);
  const released = periods.filter(p => !!p.released_at);
  const upcoming = periods.filter(p => p.service_date > today && !p.myReviewSubmitted);

  return (
    <>
      <Topbar title="Reviews" crumbs={[{ label: "Reviews" }]} />
      <div className="page">

        {pending.length === 0 && waitingOnOther.length === 0 && released.length === 0 && upcoming.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
            <p style={{ margin: 0, fontSize: 15 }}>No bookings yet — once a service is complete, you can review each other.</p>
          </div>
        ) : null}

        <Section title="Waiting for your review" empty={pending.length === 0}>
          {pending.map(p => (
            <PeriodCard key={p.period_id} period={p} cta={{ href: `/reviews/${p.period_id}`, label: "Leave a review" }} />
          ))}
        </Section>

        <Section title="Waiting on the other side" empty={waitingOnOther.length === 0} hint="Reviews release once both sides submit, or after the 7-day window closes.">
          {waitingOnOther.map(p => (
            <PeriodCard key={p.period_id} period={p} status="waiting" />
          ))}
        </Section>

        <Section title="Released" empty={released.length === 0}>
          {released.map(p => (
            <PeriodCard key={p.period_id} period={p} cta={{ href: `/reviews/${p.period_id}`, label: "View" }} />
          ))}
        </Section>

        <Section title="Upcoming services" empty={upcoming.length === 0} hint="You'll be able to leave a review once the service date passes.">
          {upcoming.map(p => (
            <PeriodCard key={p.period_id} period={p} status="upcoming" />
          ))}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children, empty, hint }: { title: string; children: React.ReactNode; empty: boolean; hint?: string }) {
  if (empty) return null;
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 4px" }}>{title}</h2>
      {hint && <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--sm-fg-4)" }}>{hint}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>{children}</div>
    </section>
  );
}

function PeriodCard({
  period,
  cta,
  status,
}: {
  period: PeriodSummary;
  cta?: { href: string; label: string };
  status?: "waiting" | "upcoming";
}) {
  const date = new Date(period.service_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>
          <Link href={period.counterpartyHref} style={{ color: "inherit", textDecoration: "none" }}>{period.counterpartyName}</Link>
        </div>
        <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 2 }}>
          {date}
          {status === "waiting" && " · waiting on the other side"}
          {status === "upcoming" && " · upcoming service"}
          {period.released_at && " · released"}
        </div>
      </div>
      {cta && (
        <Link href={cta.href} className="btn btn--secondary btn--sm">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
