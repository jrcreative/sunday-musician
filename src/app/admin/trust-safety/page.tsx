import Link from "next/link";
import type { ComponentProps } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { DateCell, KpiCard, Money, StatusPill } from "../_components/AdminPrimitives";
import { SafetyActionButton } from "./SafetyActionButton";

export const dynamic = "force-dynamic";

type SearchParams = {
  category?: string;
};

type CancellationRow = {
  id: string;
  request_id: string;
  thread_id: string;
  service_date: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_category: string | null;
  cancel_reason: string | null;
  cancellation_policy_label: string | null;
  church_profiles: { church_name: string; profile_id: string } | null;
  musician_profiles: { profile_id: string; profiles: { display_name: string } | null } | null;
  service_requests: { title: string } | null;
};

type DisputeRow = {
  id: string;
  booking_id: string;
  opened_by_role: "church" | "musician";
  category: string;
  reason: string | null;
  status: "open" | "under_review" | "resolved" | "closed";
  created_at: string;
  bookings: {
    thread_id: string;
    service_date: string;
    church_profiles: { church_name: string } | null;
    musician_profiles: { profiles: { display_name: string } | null } | null;
    service_requests: { title: string } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  booking_id: string;
  musician_profile_id: string;
  church_profile_id: string;
  charge_total: number;
  failure_message: string | null;
  failed_at: string | null;
  scheduled_for: string;
  bookings: {
    thread_id: string;
    service_date: string;
    service_requests: { title: string } | null;
    church_profiles: { church_name: string } | null;
    musician_profiles: { profiles: { display_name: string } | null } | null;
  } | null;
};

type LowRatingMusician = {
  id: string;
  rating: number;
  review_count: number;
  city: string;
  state: string;
  profiles: { display_name: string; email: string } | null;
};

type SuspiciousProfile = {
  id: string;
  display_name: string;
  email: string;
  role: "church" | "musician";
  suspended_at: string | null;
  created_at: string;
};

type SuspiciousRequest = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  service_date: string;
  offered_fee: number | null;
  church_profiles: { church_name: string } | null;
};

const DISPUTE_TONE: Record<DisputeRow["status"], ComponentProps<typeof StatusPill>["tone"]> = {
  open: "warn",
  under_review: "info",
  resolved: "success",
  closed: "neutral",
};

function categoryHref(category: string) {
  return category === "all" ? "/admin/trust-safety" : `/admin/trust-safety?category=${category}`;
}

function ActionSet(props: { issueType: string; targetId: string; targetLabel: string; disputeId?: string }) {
  return (
    <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
      <SafetyActionButton {...props} action="resolve" />
      <SafetyActionButton {...props} action="contact" />
      <SafetyActionButton {...props} action="escalate" />
    </div>
  );
}

export default async function AdminTrustSafetyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const category = params.category ?? "all";
  const admin = createAdminClient();

  const [
    cancellationsRes,
    disputesRes,
    failedPaymentsRes,
    lowRatingsRes,
    suspiciousProfilesRes,
    suspiciousRequestsRes,
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(`
        id, request_id, thread_id, service_date, cancelled_at, cancelled_by,
        cancel_category, cancel_reason, cancellation_policy_label,
        church_profiles ( church_name, profile_id ),
        musician_profiles ( profile_id, profiles ( display_name ) ),
        service_requests ( title )
      `)
      .not("cancelled_at", "is", null)
      .order("cancelled_at", { ascending: false })
      .limit(100),
    admin
      .from("booking_disputes")
      .select(`
        id, booking_id, opened_by_role, category, reason, status, created_at,
        bookings (
          thread_id, service_date,
          church_profiles ( church_name ),
          musician_profiles ( profiles ( display_name ) ),
          service_requests ( title )
        )
      `)
      .in("status", ["open", "under_review"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("payments")
      .select(`
        id, booking_id, musician_profile_id, church_profile_id, charge_total,
        failure_message, failed_at, scheduled_for,
        bookings (
          thread_id, service_date,
          service_requests ( title ),
          church_profiles ( church_name ),
          musician_profiles ( profiles ( display_name ) )
        )
      `)
      .eq("status", "failed")
      .order("failed_at", { ascending: false, nullsFirst: false })
      .limit(100),
    admin
      .from("musician_profiles")
      .select("id, rating, review_count, city, state, profiles ( display_name, email )")
      .gte("review_count", 2)
      .lte("rating", 3)
      .order("rating", { ascending: true })
      .limit(100),
    admin
      .from("profiles")
      .select("id, display_name, email, role, suspended_at, created_at")
      .or("suspended_at.not.is.null,verified.eq.false")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("service_requests")
      .select("id, title, status, created_at, service_date, offered_fee, church_profiles ( church_name )")
      .or("offered_fee.gte.1000,status.eq.cancelled")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const cancellations = (cancellationsRes.data ?? []) as unknown as CancellationRow[];
  const disputes = (disputesRes.data ?? []) as unknown as DisputeRow[];
  const failedPayments = (failedPaymentsRes.data ?? []) as unknown as PaymentRow[];
  const lowRatings = (lowRatingsRes.data ?? []) as unknown as LowRatingMusician[];
  const suspiciousProfiles = (suspiciousProfilesRes.data ?? []) as SuspiciousProfile[];
  const suspiciousRequests = (suspiciousRequestsRes.data ?? []) as unknown as SuspiciousRequest[];
  const suspiciousTotal = suspiciousProfiles.length + suspiciousRequests.length;
  const visibleAll = category === "all";

  return (
    <>
      <AdminTopbar title="Trust & safety queue" sub="Cancellations, disputes, payment risk, and account flags" />
      <div className="a-page">
        <div className="kpi-grid">
          <KpiCard label="Cancellations" value={cancellations.length} context="latest 100" />
          <KpiCard label="Open disputes" value={disputes.length} context="open or under review" />
          <KpiCard label="Failed payments" value={failedPayments.length} context="capture errors" />
          <KpiCard label="Suspicious flags" value={suspiciousTotal} context="rule-based account/request checks" />
        </div>

        <div className="a-table-toolbar" style={{ marginBottom: 18 }}>
          <span className="count" style={{ marginRight: 8 }}>Category:</span>
          {(["all", "cancellations", "disputes", "payments", "ratings", "suspicious"] as const).map(c => (
            <Link key={c} href={categoryHref(c)} className={`a-pill ${category === c ? "a-pill--accent" : ""}`} style={{ textDecoration: "none" }}>
              {c}
            </Link>
          ))}
        </div>

        {(visibleAll || category === "cancellations") && (
          <section className="a-table-wrap" style={{ marginBottom: 18 }}>
            <div className="a-table-toolbar"><span className="count"><strong>{cancellations.length}</strong> cancellations</span></div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Cancelled</th>
                  <th>Request</th>
                  <th>Parties</th>
                  <th>Reason</th>
                  <th>Policy</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.map(c => {
                  const label = c.service_requests?.title ?? c.id;
                  return (
                    <tr key={c.id}>
                      <td><DateCell value={c.cancelled_at} /></td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        <div className="secondary"><DateCell value={c.service_date} /> · cancelled by {c.cancelled_by ?? "unknown"}</div>
                      </td>
                      <td>{c.church_profiles?.church_name ?? "Church"}<div className="secondary">{c.musician_profiles?.profiles?.display_name ?? "Musician"}</div></td>
                      <td>{c.cancel_category?.replaceAll("_", " ") ?? "Unspecified"}{c.cancel_reason && <div className="secondary">{c.cancel_reason}</div>}</td>
                      <td>{c.cancellation_policy_label ?? "Standard"}</td>
                      <td className="actions"><ActionSet issueType="cancellation" targetId={c.id} targetLabel={label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {(visibleAll || category === "disputes") && (
          <section className="a-table-wrap" style={{ marginBottom: 18 }}>
            <div className="a-table-toolbar">
              <span className="count"><strong>{disputes.length}</strong> disputes</span>
              <div className="right"><Link href="/admin/disputes" className="btn btn--ghost btn--sm" style={{ textDecoration: "none" }}>Full disputes view</Link></div>
            </div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Opened</th>
                  <th>Request</th>
                  <th>Parties</th>
                  <th>Status</th>
                  <th>Issue</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => {
                  const label = d.bookings?.service_requests?.title ?? d.id;
                  return (
                    <tr key={d.id}>
                      <td><DateCell value={d.created_at} /></td>
                      <td>{label}<div className="secondary"><DateCell value={d.bookings?.service_date} /></div></td>
                      <td>{d.bookings?.church_profiles?.church_name ?? "Church"}<div className="secondary">{d.bookings?.musician_profiles?.profiles?.display_name ?? "Musician"}</div></td>
                      <td><StatusPill tone={DISPUTE_TONE[d.status]}>{d.status.replace("_", " ")}</StatusPill></td>
                      <td>{d.category.replaceAll("_", " ")}{d.reason && <div className="secondary">{d.reason}</div>}</td>
                      <td className="actions"><ActionSet issueType="dispute" targetId={d.booking_id} disputeId={d.id} targetLabel={label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {(visibleAll || category === "payments") && (
          <section className="a-table-wrap" style={{ marginBottom: 18 }}>
            <div className="a-table-toolbar"><span className="count"><strong>{failedPayments.length}</strong> failed payments</span></div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Failed</th>
                  <th>Request</th>
                  <th>Parties</th>
                  <th className="num">Charge</th>
                  <th>Error</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedPayments.map(p => {
                  const label = p.bookings?.service_requests?.title ?? p.id;
                  return (
                    <tr key={p.id}>
                      <td><DateCell value={p.failed_at ?? p.scheduled_for} /></td>
                      <td>{label}<div className="secondary"><DateCell value={p.bookings?.service_date} /></div></td>
                      <td>{p.bookings?.church_profiles?.church_name ?? "Church"}<div className="secondary">{p.bookings?.musician_profiles?.profiles?.display_name ?? "Musician"}</div></td>
                      <td className="num"><Money cents={p.charge_total} maximumFractionDigits={2} /></td>
                      <td>{p.failure_message ?? "No Stripe error message"}</td>
                      <td className="actions"><ActionSet issueType="payment_failure" targetId={p.id} targetLabel={label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {(visibleAll || category === "ratings") && (
          <section className="a-table-wrap" style={{ marginBottom: 18 }}>
            <div className="a-table-toolbar"><span className="count"><strong>{lowRatings.length}</strong> low-rating flags</span></div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Musician</th>
                  <th>Location</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lowRatings.map(m => (
                  <tr key={m.id}>
                    <td>{m.profiles?.display_name ?? "Musician"}<div className="secondary">{m.profiles?.email ?? ""}</div></td>
                    <td>{m.city}, {m.state}</td>
                    <td><StatusPill tone="warn">{Number(m.rating).toFixed(1)}</StatusPill></td>
                    <td>{m.review_count}</td>
                    <td className="actions"><ActionSet issueType="low_rating" targetId={m.id} targetLabel={m.profiles?.display_name ?? "Musician"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {(visibleAll || category === "suspicious") && (
          <section className="a-table-wrap">
            <div className="a-table-toolbar"><span className="count"><strong>{suspiciousTotal}</strong> suspicious behavior flags</span></div>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Flag</th>
                  <th>Subject</th>
                  <th>Created</th>
                  <th>Rule</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousProfiles.map(p => (
                  <tr key={p.id}>
                    <td><StatusPill tone={p.suspended_at ? "error" : "warn"}>{p.suspended_at ? "Suspended" : "Unverified"}</StatusPill></td>
                    <td>{p.display_name}<div className="secondary">{p.email} · {p.role}</div></td>
                    <td><DateCell value={p.created_at} /></td>
                    <td>{p.suspended_at ? "Account is suspended" : "Account is not verified"}</td>
                    <td className="actions"><ActionSet issueType="suspicious_account" targetId={p.id} targetLabel={p.display_name} /></td>
                  </tr>
                ))}
                {suspiciousRequests.map(r => (
                  <tr key={r.id}>
                    <td><StatusPill tone={r.status === "cancelled" ? "warn" : "info"}>Request</StatusPill></td>
                    <td>{r.title}<div className="secondary">{r.church_profiles?.church_name ?? "Church"}</div></td>
                    <td><DateCell value={r.created_at} /></td>
                    <td>{r.offered_fee && r.offered_fee >= 1000 ? "Unusually high fee" : "Cancelled request pattern"}</td>
                    <td className="actions"><ActionSet issueType="suspicious_request" targetId={r.id} targetLabel={r.title} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
