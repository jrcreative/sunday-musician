"use client";

import Link from "next/link";
import {
  BOOKING_STATUS_CHIP,
  BOOKING_STATUS_LABEL,
  bookingDisplayStatus,
} from "@/lib/requests/status";

export type Booking = {
  bookingId: string;
  threadId: string;
  churchName: string;
  churchCity: string;
  churchState: string;
  title: string;
  serviceDate: string | null;
  serviceType: string;
  fee: number | null;
  feeType: string;
  acceptedAt: string;
  cancelledAt: string | null;
  cancellationPolicyLabel: string | null;
  disputeReviewRequired: boolean;
};

export function BookingsClient({ bookings }: { bookings: Booking[] }) {
  // Stats only count bookings that actually held — cancelled rows
  // shouldn't pad "Total earned" or the unique-church count.
  const live = bookings.filter(b => !b.cancelledAt);
  const totalEarned = live.reduce((sum, b) => sum + (b.fee ?? 0), 0);
  const uniqueChurches = new Set(live.map(b => b.churchName)).size;

  const stats = [
    { label: "Confirmed bookings", value: live.length.toString(), sub: "all time" },
    {
      label: "Total earned",
      value: totalEarned > 0 ? `$${totalEarned.toLocaleString()}` : "—",
      sub: "from accepted proposals",
    },
    {
      label: "Churches served",
      value: uniqueChurches.toString(),
      sub: uniqueChurches === 1 ? "unique church" : "unique churches",
    },
  ];

  return (
    <div className="page page--narrow">

      {/* Stats row */}
      <div className="sm-row-3" style={{ gap: 16, marginBottom: 36 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding: "20px 24px",
            border: "1px solid var(--sm-border-subtle)",
            borderRadius: "var(--sm-radius-sm)",
            background: "var(--sm-bg-1)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)", marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--sm-fg-1)", lineHeight: 1, marginBottom: 4 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Bookings list */}
      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>No confirmed bookings yet</h3>
          <p style={{ margin: "0 0 20px", fontSize: 14 }}>
            When a church accepts your terms or you accept theirs, the booking will appear here.
          </p>
          <Link href="/open-requests" className="btn btn--primary">Browse open requests</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)", marginBottom: 10 }}>
            Bookings
          </div>
          {bookings.map(b => {
            const d = b.serviceDate ? new Date(b.serviceDate + "T12:00:00") : null;
            const location = [b.churchCity, b.churchState].filter(Boolean).join(", ");
            const status = bookingDisplayStatus(b.serviceDate, b.cancelledAt);
            const dim = status !== "upcoming";

            return (
              <Link
                key={b.bookingId}
                href={`/messages/${b.threadId}`}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 20, alignItems: "center",
                  padding: "18px 22px",
                  border: "1px solid var(--sm-border-subtle)",
                  borderRadius: "var(--sm-radius-sm)",
                  background: "var(--sm-bg-1)",
                  marginBottom: 10,
                  opacity: dim ? 0.7 : 1,
                }}>
                  {/* Date block */}
                  <div style={{ textAlign: "center", paddingRight: 20, borderRight: "1px solid var(--sm-border-subtle)" }}>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: dim ? "var(--sm-fg-4)" : "var(--sm-accent)", fontWeight: 700 }}>
                          {d.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 2 }}>
                          {d.getDate()}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--sm-fg-3)", marginTop: 2 }}>
                          {d.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>TBD</div>
                    )}
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 3, textDecoration: status === "cancelled" ? "line-through" : "none" }}>
                      {b.title}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--sm-fg-3)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, color: "var(--sm-fg-2)" }}>{b.churchName}</span>
                      {location && <span>· {location}</span>}
                      {b.serviceType && <span>· {b.serviceType}</span>}
                      {b.cancelledAt && b.cancellationPolicyLabel && <span>· {b.cancellationPolicyLabel}</span>}
                      {b.disputeReviewRequired && <span>· Admin review</span>}
                    </div>
                  </div>

                  {/* Fee + status */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {b.fee != null ? (
                      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--sm-fg-1)" }}>
                        ${b.fee}
                        <span style={{ fontWeight: 400, fontSize: 12, color: "var(--sm-fg-3)", marginLeft: 3 }}>
                          / {b.feeType.toLowerCase()}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--sm-fg-4)" }}>Volunteer</div>
                    )}
                    <div style={{ marginTop: 5 }}>
                      <span className={BOOKING_STATUS_CHIP[status]}>
                        {BOOKING_STATUS_LABEL[status]}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
