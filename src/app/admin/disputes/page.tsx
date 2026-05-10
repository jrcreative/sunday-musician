import Link from "next/link";
import type { ComponentProps } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { DateCell, KpiCard, StatusPill } from "../_components/AdminPrimitives";

type DisputeStatus = "open" | "under_review" | "resolved" | "closed";

type DisputeRow = {
  id: string;
  booking_id: string;
  opened_by_role: "church" | "musician";
  category: string;
  reason: string | null;
  status: DisputeStatus;
  created_at: string;
  bookings: {
    thread_id: string;
    service_date: string;
    cancellation_policy_label: string | null;
    cancel_category: string | null;
    dispute_review_required: boolean;
    church_profiles: { church_name: string } | null;
    musician_profiles: { profiles: { display_name: string } | null } | null;
  } | null;
};

const STATUS_BADGE: Record<DisputeStatus, { label: string; tone: ComponentProps<typeof StatusPill>["tone"] }> = {
  open: { label: "Open", tone: "warn" },
  under_review: { label: "Under review", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = (
    ["open", "under_review", "resolved", "closed"].includes(statusParam ?? "")
      ? statusParam
      : "all"
  ) as DisputeStatus | "all";

  const admin = createAdminClient();
  let q = admin
    .from("booking_disputes")
    .select(`
      id, booking_id, opened_by_role, category, reason, status, created_at,
      bookings (
        thread_id, service_date, cancellation_policy_label, cancel_category, dispute_review_required,
        church_profiles ( church_name ),
        musician_profiles ( profiles ( display_name ) )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);

  const { data } = await q as unknown as { data: DisputeRow[] | null };
  const disputes = data ?? [];
  const openCount = disputes.filter(d => d.status === "open").length;
  const reviewCount = disputes.filter(d => d.status === "under_review").length;
  const lateCount = disputes.filter(d => d.bookings?.cancellation_policy_label === "Late cancellation").length;

  return (
    <>
      <AdminTopbar title="Disputes" sub={`${disputes.length} cancellation review rows`} />
      <div className="a-page">
        <div className="kpi-grid">
          <KpiCard label="Open" value={openCount} context="awaiting admin review" />
          <KpiCard label="Under review" value={reviewCount} context="actively being handled" />
          <KpiCard label="Late cancellations" value={lateCount} context="within 7 days in this view" />
        </div>

        <div className="a-table-wrap">
          <div className="a-table-toolbar">
            <span className="count" style={{ marginRight: 8 }}>Status:</span>
            {(["all", "open", "under_review", "resolved", "closed"] as const).map(s => (
              <Link
                key={s}
                href={s === "all" ? "/admin/disputes" : `/admin/disputes?status=${s}`}
                className={`a-pill ${status === s ? "a-pill--accent" : ""}`}
                style={{ textDecoration: "none", textTransform: "capitalize" }}
              >
                {s.replace("_", " ")}
              </Link>
            ))}
            <div className="right">
              <span className="count"><strong>{disputes.length}</strong> rows</span>
            </div>
          </div>

          <table className="a-table">
            <thead>
              <tr>
                <th>Opened</th>
                <th>Service</th>
                <th>Church</th>
                <th>Musician</th>
                <th>Policy</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Thread</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => {
                const badge = STATUS_BADGE[d.status] ?? { label: d.status, tone: "neutral" as const };
                return (
                  <tr key={d.id}>
                    <td><DateCell value={d.created_at} /></td>
                    <td><DateCell value={d.bookings?.service_date} /></td>
                    <td>{d.bookings?.church_profiles?.church_name ?? "-"}</td>
                    <td>{d.bookings?.musician_profiles?.profiles?.display_name ?? "-"}</td>
                    <td>{d.bookings?.cancellation_policy_label ?? "-"}</td>
                    <td><StatusPill tone={badge.tone}>{badge.label}</StatusPill></td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ fontWeight: 600, color: "var(--sm-fg-2)" }}>{d.category.replaceAll("_", " ")}</div>
                      {d.reason && <div style={{ color: "var(--sm-fg-3)", fontSize: 12.5, marginTop: 3 }}>{d.reason}</div>}
                    </td>
                    <td>
                      {d.bookings?.thread_id ? (
                        <Link href={`/messages/${d.bookings.thread_id}`} style={{ color: "var(--sm-fg-2)", textDecoration: "underline" }}>
                          Open
                        </Link>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                    No disputes match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
