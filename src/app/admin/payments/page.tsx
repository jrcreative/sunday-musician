import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";

// Transactions table. Stripe is the source of truth for the actual
// money — refunds, disputes, and chargebacks happen in the Stripe
// Dashboard. We just deep-link to the relevant Stripe object so the
// admin can take action there. Recreating that surface in-app would
// duplicate functionality without adding value.

type Status = "all" | "scheduled" | "capturing" | "captured" | "failed" | "cancelled";

const STATUS_BADGE: Record<Exclude<Status, "all">, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "a-pill" },
  capturing: { label: "Capturing", cls: "a-pill a-pill--info" },
  captured:  { label: "Captured",  cls: "a-pill a-pill--success" },
  failed:    { label: "Failed",    cls: "a-pill a-pill--error" },
  cancelled: { label: "Cancelled", cls: "a-pill" },
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = (
    ["scheduled", "capturing", "captured", "failed", "cancelled"].includes(statusParam ?? "")
      ? statusParam : "all"
  ) as Status;

  const admin = createAdminClient();

  let q = admin
    .from("payments")
    .select("id, status, charge_total, musician_amount, platform_fee, application_fee_amount, scheduled_for, captured_at, failed_at, failure_message, stripe_payment_intent_id, stripe_charge_id, stripe_destination_id, church_profile_id, musician_profile_id, booking_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status !== "all") q = q.eq("status", status);
  const { data: payments } = await q;

  // Resolve names — small N for now.
  const churchIds = Array.from(new Set((payments ?? []).map(p => p.church_profile_id)));
  const musicianIds = Array.from(new Set((payments ?? []).map(p => p.musician_profile_id)));
  const [{ data: churches }, { data: musicians }] = await Promise.all([
    churchIds.length > 0
      ? admin.from("church_profiles").select("id, church_name").in("id", churchIds)
      : { data: [] as Array<{ id: string; church_name: string }> },
    musicianIds.length > 0
      ? admin.from("musician_profiles").select("id, profiles(display_name)").in("id", musicianIds)
      : { data: [] as Array<{ id: string; profiles: { display_name: string } | null }> },
  ]);
  const churchById = new Map((churches ?? []).map(c => [c.id, c.church_name]));
  const musicianById = new Map(
    (musicians ?? []).map(m => [m.id, (m as { profiles: { display_name: string } | null }).profiles?.display_name ?? "—"])
  );

  // Aggregate stats over the visible rows.
  const totalGross = (payments ?? []).filter(p => p.status === "captured").reduce((s, p) => s + p.charge_total, 0);
  const totalPlatform = (payments ?? []).filter(p => p.status === "captured").reduce((s, p) => s + p.platform_fee, 0);
  const totalScheduled = (payments ?? []).filter(p => p.status === "scheduled").length;
  const totalFailed = (payments ?? []).filter(p => p.status === "failed").length;

  const stripeRoot = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";

  return (
    <>
      <AdminTopbar title="Payments" sub={`${(payments ?? []).length} transactions`} />
      <div className="a-page">
        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Captured (visible)</div>
            <div className="val">${(totalGross / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="ctx">Gross of charges in this view</div>
          </div>
          <div className="kpi">
            <div className="label">Platform revenue (visible)</div>
            <div className="val">${(totalPlatform / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="ctx">$5 fee × captured</div>
          </div>
          <div className="kpi">
            <div className="label">Scheduled</div>
            <div className="val">{totalScheduled}</div>
            <div className="ctx">awaiting event-day capture</div>
          </div>
          <div className="kpi">
            <div className="label">Failed</div>
            <div className="val">{totalFailed}</div>
            <div className="ctx">need review</div>
          </div>
        </div>

        <div className="a-table-wrap">
          <div className="a-table-toolbar">
            <span className="count" style={{ marginRight: 8 }}>Status:</span>
            {(["all", "scheduled", "captured", "failed", "cancelled"] as const).map(s => (
              <Link
                key={s}
                href={s === "all" ? "/admin/payments" : `/admin/payments?status=${s}`}
                className={`a-pill ${status === s ? "a-pill--accent" : ""}`}
                style={{ textDecoration: "none", textTransform: "capitalize" }}
              >
                {s}
              </Link>
            ))}
            <div className="right">
              <span className="count"><strong>{(payments ?? []).length}</strong> rows</span>
            </div>
          </div>

          <table className="a-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Church</th>
                <th>Musician</th>
                <th>Status</th>
                <th className="num">Charged</th>
                <th className="num">Musician</th>
                <th className="num">Platform</th>
                <th>Stripe</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map(p => {
                const badge = p.status in STATUS_BADGE
                  ? STATUS_BADGE[p.status as Exclude<Status, "all">]
                  : { label: p.status, cls: "a-pill" };
                const date = p.captured_at ?? p.failed_at ?? p.scheduled_for ?? "";
                const dateLabel = date
                  ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                return (
                  <tr key={p.id}>
                    <td>{dateLabel}</td>
                    <td>{churchById.get(p.church_profile_id) ?? "—"}</td>
                    <td>{musicianById.get(p.musician_profile_id) ?? "—"}</td>
                    <td>
                      <span className={badge.cls}>{badge.label}</span>
                    </td>
                    <td className="num">${(p.charge_total / 100).toFixed(2)}</td>
                    <td className="num">${(p.musician_amount / 100).toFixed(2)}</td>
                    <td className="num">${(p.platform_fee / 100).toFixed(2)}</td>
                    <td>
                      {p.stripe_payment_intent_id ? (
                        <a
                          href={`${stripeRoot}/payments/${p.stripe_payment_intent_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12.5, color: "var(--sm-fg-2)", textDecoration: "underline" }}
                        >
                          View ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                    No transactions match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: "var(--sm-fg-4)", marginTop: 12 }}>
          Refunds, disputes, and chargebacks are handled in the <a href={stripeRoot} target="_blank" rel="noreferrer" style={{ color: "var(--sm-fg-2)" }}>Stripe Dashboard</a>. Status here will reflect the result via webhook.
        </p>
      </div>
    </>
  );
}
