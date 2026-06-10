"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DismissPotentialMatchButton({
  requestId,
  musicianProfileId,
}: {
  requestId: string;
  musicianProfileId: string;
}) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    setDismissing(true);
    setError(null);

    const res = await fetch(`/api/requests/${requestId}/dismiss-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ musicianProfileId }),
    });
    const payload = await res.json().catch(() => ({})) as { error?: string };

    if (!res.ok) {
      setError(payload.error ?? "Could not decline match");
      setDismissing(false);
      return;
    }

    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={dismiss}
        disabled={dismissing}
        title="Hide this musician from matches for this request"
      >
        {dismissing ? "Declining..." : "Decline"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--sm-status-error)", textAlign: "right", maxWidth: 160 }}>
          {error}
        </span>
      )}
    </div>
  );
}
