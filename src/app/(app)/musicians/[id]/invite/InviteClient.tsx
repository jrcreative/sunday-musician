"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Request = { id: string; title: string; service_date: string; service_type: string };

export function InviteClient({
  musicianProfileId,
  churchProfileId,
  currentUserId,
  musicianName,
  requests,
}: {
  musicianProfileId: string;
  churchProfileId: string;
  currentUserId: string;
  musicianName: string;
  requests: Request[];
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(req: Request) {
    setInviting(req.id);
    setError(null);
    const supabase = createClient();

    // Find or create thread
    const { data: existing } = await supabase
      .from("threads").select("id")
      .eq("church_profile_id", churchProfileId)
      .eq("musician_profile_id", musicianProfileId)
      .maybeSingle();

    let threadId: string;
    if (existing) {
      threadId = existing.id;
      await supabase.from("threads").update({ request_id: req.id }).eq("id", threadId);
    } else {
      const { data: created, error: tErr } = await supabase
        .from("threads")
        .insert({ church_profile_id: churchProfileId, musician_profile_id: musicianProfileId, request_id: req.id })
        .select("id").single();
      if (tErr || !created) { setError(tErr?.message ?? "Could not create thread"); setInviting(null); return; }
      threadId = created.id;
    }

    const d = new Date(req.service_date + "T12:00:00");
    const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    await supabase.from("messages").insert({
      thread_id: threadId,
      sender_profile_id: currentUserId,
      kind: "text",
      body: `Hi! We'd love to have you play for our "${req.title}" service on ${dateStr}. Would you be interested?`,
    });

    router.push(`/messages/${threadId}`);
  }

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 640 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Invite {musicianName} to a request
      </h2>
      <p style={{ color: "var(--sm-fg-3)", fontSize: 14.5, margin: "0 0 28px", lineHeight: 1.5 }}>
        Select one of your open requests. An invitation message will be sent automatically.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(184,33,5,0.06)", border: "1px solid rgba(184,33,5,0.2)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
          <p style={{ margin: "0 0 6px", color: "var(--sm-fg-1)", fontWeight: 600 }}>No open requests</p>
          <p style={{ margin: "0 0 20px", fontSize: 14 }}>Create a request first, then come back to invite {musicianName}.</p>
          <Link href="/requests/new" className="btn btn--primary">Create a request</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map(req => {
            const d = new Date(req.service_date + "T12:00:00");
            const isInviting = inviting === req.id;
            return (
              <div key={req.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)",
                padding: "16px 20px", background: "var(--sm-bg-1)",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 3 }}>{req.title}</div>
                  <div style={{ fontSize: 13, color: "var(--sm-fg-3)" }}>
                    {req.service_type} · {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={inviting !== null}
                  onClick={() => handleInvite(req)}
                  style={{ flexShrink: 0 }}
                >
                  {isInviting ? "Sending…" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
