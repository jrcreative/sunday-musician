"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvitePotentialMatchButton({
  requestId,
  musicianProfileId,
}: {
  requestId: string;
  musicianProfileId: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setInviting(true);
    setError(null);

    const res = await fetch(`/api/requests/${requestId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ musicianProfileId }),
    });
    const payload = await res.json().catch(() => ({})) as {
      threadId?: string;
      error?: string;
    };

    if (!res.ok || !payload.threadId) {
      setError(payload.error ?? "Could not invite musician");
      setInviting(false);
      return;
    }

    router.push(`/messages/${payload.threadId}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={invite}
        disabled={inviting}
      >
        {inviting ? "Inviting..." : "Invite"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--sm-status-error)", textAlign: "right", maxWidth: 160 }}>
          {error}
        </span>
      )}
    </div>
  );
}
