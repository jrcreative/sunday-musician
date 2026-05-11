"use client";

import { useState } from "react";

type Props = {
  requestId: string;
  musicianProfileId: string;
  defaultMessage: string;
};

export function MatchAssistButton({ requestId, musicianProfileId, defaultMessage }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (pending) return;
    setPending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/match/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, musicianProfileId, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not contact musician");
        return;
      }
      setResult(json.alreadyInvited ? "Thread already existed" : "Musician contacted");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 240 }}>
      <textarea
        className="input"
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        style={{ minHeight: 78, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
      />
      <button className="btn btn--primary btn--sm" type="button" onClick={invite} disabled={pending || !message.trim()}>
        {pending ? "Sending..." : "Contact musician"}
      </button>
      {result && <div style={{ color: "var(--sm-status-success)", fontSize: 12.5, fontWeight: 600 }}>{result}</div>}
      {error && <div style={{ color: "var(--sm-status-error)", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}
