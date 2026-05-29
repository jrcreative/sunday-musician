"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelBookingButton({
  bookingId,
  requestTitle,
}: {
  bookingId: string;
  requestTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          category: "church_cancelled",
          reason: "Cancelled by church from request details.",
          requestAdminReview: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not cancel the booking");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen(true)}
        style={{ color: "var(--sm-status-error, #b82105)" }}
      >
        Cancel booking
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--sm-bg-1)",
              border: "1px solid var(--sm-border-subtle)",
              borderRadius: "var(--sm-radius-sm)",
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            <h3 id="cancel-booking-title" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
              Cancel this booking?
            </h3>
            <p style={{ fontSize: 14, color: "var(--sm-fg-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
              You&rsquo;re cancelling <strong>{requestTitle}</strong>. The musician will be notified and the scheduled payment will not be captured.
            </p>
            <p style={{ fontSize: 13, color: "var(--sm-fg-3)", margin: "0 0 20px", lineHeight: 1.5 }}>
              This keeps the conversation available for reference, but marks the booking as cancelled.
            </p>
            {error && (
              <div style={{ marginBottom: 16, fontSize: 13, color: "var(--sm-status-error, #c53030)", padding: "8px 12px", border: "1px solid rgba(197,48,48,0.25)", borderRadius: "var(--sm-radius-sm)", background: "rgba(197,48,48,0.06)" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={confirm}
                disabled={submitting}
                style={{ background: "var(--sm-status-error, #b82105)", color: "white", borderColor: "transparent" }}
              >
                {submitting ? "Cancelling..." : "Yes, cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
