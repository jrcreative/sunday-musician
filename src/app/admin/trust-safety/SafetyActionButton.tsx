"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  issueType: string;
  targetId: string;
  targetLabel: string;
  action: "resolve" | "contact" | "escalate";
  disputeId?: string;
};

const LABEL = {
  resolve: "Resolve",
  contact: "Contact",
  escalate: "Escalate",
} as const;

export function SafetyActionButton({ issueType, targetId, targetLabel, action, disputeId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/safety/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueType, targetId, targetLabel, action, disputeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className={action === "escalate" ? "btn btn--danger btn--sm" : "btn btn--ghost btn--sm"}
        onClick={run}
        disabled={pending}
      >
        {pending ? "Working..." : LABEL[action]}
      </button>
      {error && <span style={{ color: "var(--sm-status-error)", fontSize: 11.5 }}>{error}</span>}
    </span>
  );
}
