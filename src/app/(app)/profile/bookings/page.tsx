import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Bookings + payments history table. Role-aware: musicians see "earned" and
// payout direction; churches see "paid" and charge direction. Year filter
// makes tax-time sums easy to read.
//
// Status badges map onto payments.status, with a derived "Cancelled" state
// when the booking was cancelled before any charge.

type Row = {
  bookingId: string;
  threadId: string;
  serviceDate: string;
  counterpartyName: string;
  status:
    | "scheduled"
    | "captured"
    | "failed"
    | "cancelled"
    | "no_payment"; // accepted booking with no payments row (legacy)
  amount: number | null;       // dollars: musician_amount on payouts side, charge_total on billing side
  capturedAt: string | null;
};

function statusBadge(s: Row["status"]): { label: string; className: string } {
  switch (s) {
    case "scheduled": return { label: "Scheduled", className: "chip" };
    case "captured":  return { label: "Paid",      className: "chip chip--success" };
    case "failed":    return { label: "Failed",    className: "chip chip--danger" };
    case "cancelled": return { label: "Cancelled", className: "chip" };
    case "no_payment": return { label: "—",        className: "chip" };
  }
}

export default async function BookingsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");
  const isMusician = profile.role === "musician";

  // Resolve "my side" id once.
  const sideId = isMusician
    ? (await supabase.from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle()).data?.id
    : (await supabase.from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle()).data?.id;
  if (!sideId) {
    return <p style={{ fontSize: 14, color: "var(--sm-fg-3)" }}>Complete your profile first.</p>;
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, thread_id, service_date, church_profile_id, musician_profile_id, cancelled_at")
    .eq(isMusician ? "musician_profile_id" : "church_profile_id", sideId)
    .order("service_date", { ascending: false });

  const bookingIds = (bookings ?? []).map(b => b.id);
  const { data: payments } = bookingIds.length > 0
    ? await supabase
        .from("payments")
        .select("booking_id, status, musician_amount, charge_total, captured_at")
        .in("booking_id", bookingIds)
    : { data: [] as Array<{ booking_id: string; status: "scheduled" | "capturing" | "captured" | "failed" | "cancelled"; musician_amount: number; charge_total: number; captured_at: string | null }> };
  const paymentByBooking = new Map(
    (payments ?? []).map(p => [p.booking_id, p])
  );

  // Counterparty names — query both sides at once and look up by id.
  const otherIds = (bookings ?? []).map(b => isMusician ? b.church_profile_id : b.musician_profile_id);
  const { data: otherChurches } = isMusician && otherIds.length > 0
    ? await supabase.from("church_profiles").select("id, church_name").in("id", otherIds)
    : { data: [] as Array<{ id: string; church_name: string }> };
  const { data: otherMusicians } = !isMusician && otherIds.length > 0
    ? await supabase
        .from("musician_profiles")
        .select("id, profiles(display_name)")
        .in("id", otherIds)
    : { data: [] as Array<{ id: string; profiles: { display_name: string } | null }> };
  const otherNameById = new Map<string, string>();
  for (const c of otherChurches ?? []) otherNameById.set(c.id, c.church_name);
  for (const m of otherMusicians ?? []) {
    const dn = (m as { profiles: { display_name: string } | null }).profiles?.display_name;
    if (dn) otherNameById.set(m.id, dn);
  }

  const rows: Row[] = (bookings ?? []).map(b => {
    const p = paymentByBooking.get(b.id);
    const status: Row["status"] = b.cancelled_at
      ? "cancelled"
      : p
        ? (p.status === "capturing" ? "scheduled" : p.status as Row["status"])
        : "no_payment";
    return {
      bookingId: b.id,
      threadId: b.thread_id,
      serviceDate: b.service_date,
      counterpartyName: otherNameById.get(isMusician ? b.church_profile_id : b.musician_profile_id) ?? "—",
      status,
      amount: p ? Math.round((isMusician ? p.musician_amount : p.charge_total) / 100) : null,
      capturedAt: p?.captured_at ?? null,
    };
  });

  // Year filter — surface the latest 4 years actually used.
  const { year: yearParam } = await searchParams;
  const yearsAvailable = Array.from(new Set(rows.map(r => r.serviceDate.slice(0, 4)))).sort().reverse();
  const activeYear = yearParam && yearsAvailable.includes(yearParam) ? yearParam : null;
  const visibleRows = activeYear ? rows.filter(r => r.serviceDate.startsWith(activeYear)) : rows;

  // Year-of totals (only "captured" amounts count toward earned/paid).
  const yearTotal = visibleRows
    .filter(r => r.status === "captured" && r.amount != null)
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
          {isMusician ? "Earnings & bookings" : "Bookings & charges"}
        </h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/profile/bookings"
            className={!activeYear ? "chip chip--success" : "chip"}
            style={{ textDecoration: "none" }}
          >
            All time
          </Link>
          {yearsAvailable.map(y => (
            <Link
              key={y}
              href={`/profile/bookings?year=${y}`}
              className={activeYear === y ? "chip chip--success" : "chip"}
              style={{ textDecoration: "none" }}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          border: "1px solid var(--sm-border-subtle)",
          borderRadius: "var(--sm-radius-sm)",
          color: "var(--sm-fg-3)", fontSize: 14,
        }}>
          {activeYear ? `No bookings in ${activeYear}.` : "No bookings yet."}
        </div>
      ) : (
        <>
          <div style={{
            border: "1px solid var(--sm-border-subtle)",
            borderRadius: "var(--sm-radius-sm)",
            overflow: "hidden",
            background: "var(--sm-bg-1)",
          }}>
            {visibleRows.map((r, i) => {
              const badge = statusBadge(r.status);
              const d = new Date(r.serviceDate + "T12:00:00");
              return (
                <Link
                  key={r.bookingId}
                  href={`/messages/${r.threadId}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) auto auto",
                    gap: 16, alignItems: "center",
                    padding: "14px 18px",
                    borderTop: i === 0 ? "none" : "1px solid var(--sm-border-subtle)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.counterpartyName}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                      {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--sm-fg-1)", fontWeight: 600 }}>
                    {r.amount != null ? `$${r.amount.toLocaleString()}` : "—"}
                  </div>
                  <span className={badge.className}>{badge.label}</span>
                  <span style={{ color: "var(--sm-fg-4)", fontSize: 13 }}>›</span>
                </Link>
              );
            })}
          </div>

          {yearTotal > 0 && (
            <div style={{ marginTop: 14, padding: "12px 18px", fontSize: 13, color: "var(--sm-fg-2)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>{isMusician ? "Total paid out" : "Total charged"}{activeYear ? ` in ${activeYear}` : " all-time"}</span>
              <span style={{ fontWeight: 600, color: "var(--sm-fg-1)" }}>${yearTotal.toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </>
  );
}
