import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "./AdminTopbar";
import { Sparkline } from "./Sparkline";
import { KpiCard, Money } from "./_components/AdminPrimitives";
import { fetchDailyPaymentRollups } from "./_lib/queries";

// 30-day operations dashboard.
//
// Every KPI is computed off the live database. The "delta" compares the
// current 30-day window against the prior 30-day window. Sparklines are
// daily counts/sums for the most recent 30 days.
//
// We use the service-role client because admins legitimately read across
// every tenant — there's no per-row ownership check that makes sense here.
// The admin gate already happened in layout.tsx.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pctDelta(current: number, prior: number): { value: number; dir: "up" | "down" | "flat" } {
  if (prior === 0 && current === 0) return { value: 0, dir: "flat" };
  if (prior === 0) return { value: 100, dir: "up" };
  const v = ((current - prior) / prior) * 100;
  return {
    value: Math.abs(Math.round(v * 10) / 10),
    dir: v > 0.5 ? "up" : v < -0.5 ? "down" : "flat",
  };
}

function dayBuckets(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    out.push(new Date(t));
  }
  return out;
}

type DailySeries = { day: string; gmv: number; count: number }[];

function bucketByDay<T extends { date: string; amount: number }>(
  items: T[],
  days: Date[],
): DailySeries {
  const map = new Map<string, { gmv: number; count: number }>();
  for (const d of days) map.set(isoDay(d), { gmv: 0, count: 0 });
  for (const it of items) {
    const k = it.date.slice(0, 10);
    const slot = map.get(k);
    if (slot) {
      slot.gmv += it.amount;
      slot.count += 1;
    }
  }
  return [...map.entries()].map(([day, v]) => ({ day, ...v }));
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * MS_PER_DAY);
  const start60 = new Date(now.getTime() - 60 * MS_PER_DAY);

  // Captured payments — both windows, one query each so we can compute
  // both windows' totals + the daily series for the latest 30 days.
  const [
    dailyRecent,
    dailyPrior,
    profilesRes,
    bookingsRecentRes,
    bookingsPriorRes,
    activeParticipantsRes,
    pendingPaymentsRes,
    failedPaymentsRes,
    suspendedRes,
    flaggedRequestsRes,
    unfilledRecentRes,
    unfilledPriorRes,
  ] = await Promise.all([
    fetchDailyPaymentRollups(admin, isoDay(start30)),
    fetchDailyPaymentRollups(admin, isoDay(start60), isoDay(start30)),
    admin.from("profiles")
      .select("role")
      .is("deleted_at", null),
    admin.from("bookings")
      .select("accepted_at, cancelled_at")
      .gte("accepted_at", start30.toISOString())
      .is("cancelled_at", null),
    admin.from("bookings")
      .select("accepted_at")
      .gte("accepted_at", start60.toISOString())
      .lt("accepted_at", start30.toISOString())
      .is("cancelled_at", null),
    admin.from("payments")
      .select("church_profile_id, musician_profile_id")
      .gte("captured_at", start30.toISOString())
      .eq("status", "captured"),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("profiles").select("id", { count: "exact", head: true }).not("suspended_at", "is", null),
    // Placeholder for "needs review" until moderation lands — count
    // failed payments + suspended users as the "ops attention" tally.
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    // Unfilled = requests whose service_date passed in the window but never
    // reached 'filled' (still open, or cancelled by the church). High counts
    // mean the platform isn't matching well — track explicitly so we notice
    // before churn shows up. Distinguish church cancellations so we can
    // spot abuse (a church repeatedly posting then withdrawing).
    admin.from("service_requests")
      .select("service_date, status")
      .gte("service_date", isoDay(start30))
      .lt("service_date", isoDay(now))
      .in("status", ["open", "in_progress", "cancelled"]),
    admin.from("service_requests")
      .select("service_date, status")
      .gte("service_date", isoDay(start60))
      .lt("service_date", isoDay(start30))
      .in("status", ["open", "in_progress", "cancelled"]),
  ]);

  const grossRecent = dailyRecent.reduce((s, p) => s + p.gross_cents, 0);
  const grossPrior = dailyPrior.reduce((s, p) => s + p.gross_cents, 0);
  const platformRecent = dailyRecent.reduce((s, p) => s + p.platform_cents, 0);
  const platformPrior = dailyPrior.reduce((s, p) => s + p.platform_cents, 0);

  const activeParticipants = activeParticipantsRes.data ?? [];
  const churchesActive = new Set(activeParticipants.map(p => p.church_profile_id)).size;
  const musiciansActive = new Set(activeParticipants.map(p => p.musician_profile_id)).size;

  const totalChurches = (profilesRes.data ?? []).filter(p => p.role === "church").length;
  const totalMusicians = (profilesRes.data ?? []).filter(p => p.role === "musician").length;

  const filledRecent = (bookingsRecentRes.data ?? []).length;
  const filledPrior = (bookingsPriorRes.data ?? []).length;

  const unfilledRows = unfilledRecentRes.data ?? [];
  const unfilledRecent = unfilledRows.length;
  const unfilledPrior = (unfilledPriorRes.data ?? []).length;
  const churchCancelledRecent = unfilledRows.filter(r => r.status === "cancelled").length;
  const expiredRecent = unfilledRecent - churchCancelledRecent;

  const days = dayBuckets(start30, now);
  const dailyByDay = new Map(dailyRecent.map(d => [d.day, d]));
  const gmvSeries = days.map(d => {
    const day = isoDay(d);
    const rollup = dailyByDay.get(day);
    return { day, gmv: rollup?.gross_cents ?? 0, count: rollup?.captured_count ?? 0 };
  });
  const filledSeries = bucketByDay(
    (bookingsRecentRes.data ?? []).map(b => ({ date: b.accepted_at, amount: 1 })),
    days,
  );

  const pendingPayments = pendingPaymentsRes.count ?? 0;
  const failedPayments = failedPaymentsRes.count ?? 0;
  const suspendedCount = suspendedRes.count ?? 0;
  const flaggedTotal = flaggedRequestsRes.count ?? 0;

  const kpis = [
    {
      label: "Gross bookings (30d)",
      val: <Money cents={grossRecent} />,
      delta: pctDelta(grossRecent, grossPrior),
      ctx: "vs. previous 30 days",
      spark: gmvSeries.map(d => d.gmv),
    },
    {
      label: "Platform revenue",
      val: <Money cents={platformRecent} />,
      delta: pctDelta(platformRecent, platformPrior),
      ctx: "$5 fee · 30d",
      spark: gmvSeries.map(d => d.gmv),
    },
    {
      label: "Filled requests (30d)",
      val: filledRecent.toString(),
      delta: pctDelta(filledRecent, filledPrior),
      ctx: filledRecent === 0 ? "no bookings yet" : `${filledRecent} accepted proposals`,
      spark: filledSeries.map(d => d.count),
    },
    {
      label: "Unfilled requests (30d)",
      val: unfilledRecent.toString(),
      // Down is good here — the dir is inverted relative to revenue KPIs, so
      // a drop in unfilled is a positive signal.
      delta: pctDelta(unfilledRecent, unfilledPrior),
      ctx: unfilledRecent === 0
        ? "every request matched"
        : `${expiredRecent} expired · ${churchCancelledRecent} cancelled by church`,
      spark: [],
    },
    {
      label: "Active churches (30d)",
      val: churchesActive.toString(),
      delta: { value: 0, dir: "flat" as const },
      ctx: `${totalChurches} total · ${churchesActive} transacting`,
      spark: filledSeries.map(d => d.count),
    },
    {
      label: "Active musicians (30d)",
      val: musiciansActive.toString(),
      delta: { value: 0, dir: "flat" as const },
      ctx: `${totalMusicians} total · ${musiciansActive} transacting`,
      spark: filledSeries.map(d => d.count),
    },
    {
      label: "Scheduled payments",
      val: pendingPayments.toString(),
      delta: { value: 0, dir: "flat" as const },
      ctx: "awaiting event-day capture",
      spark: [],
    },
    {
      label: "Failed payments (all-time)",
      val: failedPayments.toString(),
      delta: { value: 0, dir: "flat" as const },
      ctx: failedPayments === 0 ? "none" : "needs review",
      spark: [],
    },
    {
      label: "Suspended accounts",
      val: suspendedCount.toString(),
      delta: { value: 0, dir: "flat" as const },
      ctx: "soft-suspended",
      spark: [],
    },
  ];

  const peakGmv = Math.max(...gmvSeries.map(d => d.gmv), 1);

  return (
    <>
      <AdminTopbar title="Operations dashboard" sub="Live data" />
      <div className="a-page">
        {flaggedTotal > 0 && failedPayments > 0 && (
          <div style={{
            padding: "10px 14px",
            border: "1px solid rgba(184,33,5,0.3)",
            background: "rgba(184,33,5,0.05)",
            borderRadius: 3,
            color: "var(--sm-status-error, #b82105)",
            fontSize: 13,
            marginBottom: 18,
          }}>
            <strong>{failedPayments}</strong> failed payment{failedPayments === 1 ? "" : "s"} need attention. Open <a href="/admin/payments?status=failed" style={{ color: "inherit", fontWeight: 600 }}>Payments</a>.
          </div>
        )}

        <div className="kpi-grid">
          {kpis.map(k => (
            <KpiCard key={k.label} label={k.label} value={k.val} context={k.ctx} delta={k.delta}>
              {k.spark.length > 0 && <Sparkline data={k.spark} />}
            </KpiCard>
          ))}
        </div>

        <div className="chart-card">
          <h3>Gross bookings · last 30 days</h3>
          <div className="sub">Daily total of captured charges</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, marginTop: 12 }}>
            {gmvSeries.map(d => {
              const h = peakGmv === 0 ? 0 : Math.max((d.gmv / peakGmv) * 130, d.gmv > 0 ? 3 : 0);
              return (
                <div
                  key={d.day}
                  title={`${d.day} — $${(d.gmv / 100).toFixed(0)}`}
                  style={{
                    flex: 1,
                    height: h,
                    background: d.gmv > 0 ? "var(--sm-accent)" : "var(--sm-bg-3)",
                    opacity: d.gmv > 0 ? 0.85 : 1,
                    borderRadius: 2,
                    minHeight: 2,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--sm-fg-4)" }}>
            <span>{gmvSeries[0]?.day ?? ""}</span>
            <span>{gmvSeries.at(-1)?.day ?? ""}</span>
          </div>
        </div>
      </div>
    </>
  );
}
