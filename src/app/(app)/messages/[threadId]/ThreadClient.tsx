"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RequestInfo } from "./page";

type ProposalData = {
  fee: number | null;
  feeType: string;
  date: string | null;
  notes: string;
};

type Message = {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  kind: "text" | "proposal";
  body: string | null;
  proposal: ProposalData | null;
  proposal_status: "pending" | "accepted" | null;
  created_at: string;
};

export function ThreadClient({
  threadId,
  currentUserId,
  isChurchSide,
  otherName,
  requestInfo,
  archivedAt,
  archiveReason,
  bookingId,
  bookingCancelledAt,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  isChurchSide: boolean;
  otherName: string;
  requestInfo: RequestInfo | null;
  archivedAt: string | null;
  archiveReason: string | null;
  bookingId: string | null;
  bookingCancelledAt: string | null;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages as Message[]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [cancelledAt, setCancelledAt] = useState<string | null>(bookingCancelledAt);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function cancelBooking() {
    if (!bookingId || cancelling) return;
    if (!confirm("Cancel this booking? The card on file will not be charged.")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCancelError(json.error ?? "Could not cancel booking");
        return;
      }
      setCancelledAt(new Date().toISOString());
    } finally {
      setCancelling(false);
    }
  }

  // Proposal form state (church side)
  const [proposalFee, setProposalFee] = useState<number | "">(requestInfo?.offered_fee ?? "");
  const [proposalNotes, setProposalNotes] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Latest proposal (last proposal message in thread)
  const latestProposal = useMemo(() => {
    const proposals = messages.filter(m => m.kind === "proposal");
    return proposals.length > 0 ? proposals[proposals.length - 1] : null;
  }, [messages]);

  const isConfirmed = latestProposal?.proposal_status === "accepted";
  const hasAnyProposal = useMemo(() => messages.some(m => m.kind === "proposal"), [messages]);
  const isArchived = !!archivedAt;
  // Churches must lead with a proposal — text composer locked until they send one.
  const churchMustProposeFirst = isChurchSide && !hasAnyProposal;
  const composerLocked = isArchived || churchMustProposeFirst;
  const archiveLabel = archiveReason === "request_filled"
    ? "Request was filled by another musician"
    : archiveReason === "request_cancelled"
      ? "The church cancelled this request"
      : archiveReason === "request_closed"
        ? "Request was closed"
        : archiveReason === "past_service"
          ? "Service date has passed"
          : archiveReason === "stale"
            ? "Inactive for 21 days"
            : "Archived";

  // Sync sidebar fee to latest proposal fee when it changes. Using the
  // "store previous prop" pattern so the reset happens during render, not in
  // an effect (avoids cascading renders).
  const [syncedProposalId, setSyncedProposalId] = useState<string | null>(null);
  if (latestProposal && latestProposal.id !== syncedProposalId) {
    setSyncedProposalId(latestProposal.id);
    if (latestProposal.proposal?.fee != null) {
      setProposalFee(latestProposal.proposal.fee);
      setProposalNotes(latestProposal.proposal.notes ?? "");
    }
  }

  // Realtime: INSERTs + UPDATEs
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_profile_id !== currentUserId) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, currentUserId]);

  async function sendMessage() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    const supabase = createClient();
    const optimistic: Message = {
      id: `opt-${Date.now()}`, thread_id: threadId,
      sender_profile_id: currentUserId, kind: "text",
      body: content, proposal: null, proposal_status: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    const { data } = await supabase
      .from("messages")
      .insert({ thread_id: threadId, sender_profile_id: currentUserId, kind: "text", body: content })
      .select().single();
    if (data) setMessages(prev => prev.map(m => m.id === optimistic.id ? data as Message : m));
    setSending(false);
    textareaRef.current?.focus();
  }

  async function sendProposal() {
    if (sendingProposal) return;
    setSendingProposal(true);
    const supabase = createClient();
    const proposal: ProposalData = {
      fee: proposalFee === "" ? null : Number(proposalFee),
      feeType: requestInfo?.fee_type ?? "Per service",
      date: requestInfo?.service_date ?? null,
      notes: proposalNotes,
    };
    const { data } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_profile_id: currentUserId,
        kind: "proposal",
        body: null,
        proposal,
        proposal_status: "pending",
      })
      .select().single();
    if (data) setMessages(prev => [...prev, data as Message]);
    setSendingProposal(false);
  }

  async function acceptProposal(msgId: string) {
    if (accepting) return;
    setAccepting(msgId);
    setAcceptError(null);
    try {
      const res = await fetch("/api/proposals/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: msgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAcceptError(json.error ?? "Could not accept proposal");
        return;
      }
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, proposal_status: "accepted" } : m
      ));
    } finally {
      setAccepting(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const fmtShortDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Mark which messages should display a date divider (first message of each
  // calendar day). Computed up-front so render doesn't reassign across iterations.
  const dividerMessageIds = useMemo(() => {
    const ids = new Set<string>();
    let prev = "";
    for (const m of messages) {
      const d = fmtDate(m.created_at);
      if (d !== prev) { ids.add(m.id); prev = d; }
    }
    return ids;
  }, [messages]); // fmtDate is stable (defined in scope, no closure deps)

  return (
    <div className="sm-thread-layout">

      {/* ── Chat ── */}
      <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--sm-border-subtle)" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)" }}>{otherName}</div>
          {requestInfo && <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", marginTop: 1 }}>Re: {requestInfo.title}</div>}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10, background: "var(--sm-bg-2)" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--sm-fg-4)", fontSize: 14, padding: "32px 0" }}>
              Start the conversation with {otherName.split(" ")[0]}.
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.sender_profile_id === currentUserId;
            const msgDate = fmtDate(msg.created_at);
            const showDivider = dividerMessageIds.has(msg.id);

            return (
              <div key={msg.id}>
                {showDivider && (
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--sm-fg-4)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, margin: "8px 0", position: "relative" }}>
                    <span style={{ background: "var(--sm-bg-2)", padding: "0 10px", position: "relative", zIndex: 1 }}>{msgDate}</span>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "var(--sm-border-subtle)", zIndex: 0 }} />
                  </div>
                )}

                {msg.kind === "proposal" ? (
                  <ProposalBubble
                    msg={msg}
                    isMe={isMe}
                    isChurchSide={isChurchSide}
                    otherName={otherName}
                    onAccept={acceptProposal}
                    accepting={accepting}
                    fmtTime={fmtTime}
                    fmtShortDate={fmtShortDate}
                  />
                ) : (
                  <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "68%", padding: "10px 14px", borderRadius: 8,
                      fontSize: 14.5, lineHeight: 1.5, wordBreak: "break-word",
                      background: isMe ? "var(--sm-fg-1)" : "var(--sm-bg-1)",
                      color: isMe ? "white" : "var(--sm-fg-1)",
                      border: isMe ? "none" : "1px solid var(--sm-border-subtle)",
                      borderBottomRightRadius: isMe ? 3 : 8,
                      borderBottomLeftRadius: isMe ? 8 : 3,
                    }}>
                      {msg.body}
                      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{fmtTime(msg.created_at)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {acceptError && (
          <div style={{
            borderTop: "1px solid rgba(197,48,48,0.2)",
            padding: "10px 18px",
            background: "rgba(197,48,48,0.06)",
            color: "var(--sm-status-error, #c53030)",
            fontSize: 13.5,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{acceptError}</span>
            <button
              onClick={() => setAcceptError(null)}
              aria-label="Dismiss"
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
            >×</button>
          </div>
        )}

        {/* Composer / lock banner */}
        {composerLocked ? (
          <div style={{ borderTop: "1px solid var(--sm-border-subtle)", padding: "14px 18px", background: "var(--sm-bg-2)", textAlign: "center", color: "var(--sm-fg-3)", fontSize: 13.5, lineHeight: 1.5 }}>
            {isArchived
              ? `This conversation is archived — ${archiveLabel.toLowerCase()}. You can read it but not send new messages.`
              : "Send a proposal to start the conversation. Use the panel on the right to set the date and fee."}
          </div>
        ) : (
          <div style={{ borderTop: "1px solid var(--sm-border-subtle)", padding: "10px 14px", background: "var(--sm-bg-1)", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              placeholder={`Message ${otherName.split(" ")[0]}…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 14.5, background: "transparent", lineHeight: 1.5, padding: "6px 4px", fontFamily: "inherit", color: "var(--sm-fg-1)", minHeight: 34, maxHeight: 140, overflowY: "auto" }}
            />
            <button className="btn btn--primary btn--sm" onClick={sendMessage} disabled={!draft.trim() || sending}>
              Send
            </button>
          </div>
        )}
      </div>

      {/* ── Agreement sidebar ── */}
      <aside style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", padding: 20, position: "sticky", top: 90, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", maxHeight: "calc(100vh - 110px)" }}>
        {/* Status header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)" }}>Agreement</h3>
          {isConfirmed ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(22,163,74,0.1)", color: "var(--sm-status-success)" }}>✓ Confirmed</span>
          ) : latestProposal ? (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 4, background: "rgba(228,123,2,0.1)", color: "#8a5a05" }}>Pending</span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 4, background: "var(--sm-bg-3)", color: "var(--sm-fg-4)" }}>No proposal</span>
          )}
        </div>

        {/* Request details */}
        {requestInfo && (
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--sm-border-subtle)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Request details</div>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <Row label="Date" value={fmtShortDate(requestInfo.service_date)} />
              {requestInfo.service_time && <Row label="Time" value={requestInfo.service_time} />}
              {requestInfo.instruments_needed.length > 0 && (
                <Row label="Instruments" value={requestInfo.instruments_needed.join(", ")} />
              )}
              <Row label="Rehearsals" value={requestInfo.rehearsals} />
            </dl>
          </div>
        )}

        {/* Church: editable proposal form */}
        {isChurchSide && requestInfo && !isConfirmed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
              {latestProposal ? "Revise terms" : "Send proposal"}
            </div>
            <div className="field">
              <label className="label" htmlFor="propFee">Offered fee ($)</label>
              <input
                id="propFee"
                type="number"
                className="input"
                min={0}
                value={proposalFee}
                onChange={e => setProposalFee(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder={requestInfo.offered_fee != null ? String(requestInfo.offered_fee) : "e.g. 200"}
              />
              <div className="help">{requestInfo.fee_type}</div>
            </div>
            <div className="field">
              <label className="label" htmlFor="propNotes">Notes for musician</label>
              <textarea
                id="propNotes"
                className="textarea"
                rows={3}
                value={proposalNotes}
                onChange={e => setProposalNotes(e.target.value)}
                placeholder="Arrival time, attire, parking, sound check…"
              />
            </div>
            <button
              className="btn btn--primary"
              disabled={sendingProposal || proposalFee === "" || isArchived}
              onClick={sendProposal}
              style={{ width: "100%" }}
            >
              {sendingProposal ? "Sending…" : latestProposal ? "Send revised terms" : "Send proposal"}
            </button>
          </div>
        )}

        {/* Church: confirmed state */}
        {isChurchSide && isConfirmed && latestProposal?.proposal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Agreed terms</div>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {latestProposal.proposal.fee != null && (
                <Row label="Fee" value={`$${latestProposal.proposal.fee} / ${latestProposal.proposal.feeType.toLowerCase()}`} />
              )}
              {latestProposal.proposal.notes && <Row label="Notes" value={latestProposal.proposal.notes} />}
            </dl>
            {bookingId && !cancelledAt && (
              <>
                <p style={{ fontSize: 12, color: "var(--sm-fg-4)", lineHeight: 1.4, margin: "8px 0 0" }}>
                  Card on file will be charged on the service date.
                </p>
                <button
                  className="btn btn--sm"
                  onClick={cancelBooking}
                  disabled={cancelling}
                  style={{ marginTop: 8, alignSelf: "flex-start" }}
                >
                  {cancelling ? "Cancelling…" : "Cancel booking"}
                </button>
              </>
            )}
            {cancelledAt && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--sm-fg-3)", padding: "8px 10px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-2)" }}>
                Booking cancelled. No charge will be made.
              </div>
            )}
            {cancelError && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--sm-status-error, #c53030)" }}>{cancelError}</div>
            )}
          </div>
        )}

        {/* Musician: view only */}
        {!isChurchSide && (
          <div>
            {!latestProposal && (
              <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", lineHeight: 1.5, margin: 0 }}>
                The church will send a proposal with fee and any notes. You can then accept in the chat.
              </p>
            )}
            {latestProposal && !isConfirmed && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Proposed terms</div>
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {latestProposal.proposal?.fee != null && (
                    <Row label="Fee" value={`$${latestProposal.proposal.fee} / ${latestProposal.proposal.feeType.toLowerCase()}`} />
                  )}
                  {latestProposal.proposal?.notes && <Row label="Notes" value={latestProposal.proposal.notes} />}
                </dl>
                <p style={{ fontSize: 12, color: "var(--sm-fg-4)", marginTop: 12, lineHeight: 1.4 }}>
                  See the proposal in the chat to accept.
                </p>
              </>
            )}
            {isConfirmed && latestProposal?.proposal && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Agreed terms</div>
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {latestProposal.proposal.fee != null && (
                    <Row label="Fee" value={`$${latestProposal.proposal.fee} / ${latestProposal.proposal.feeType.toLowerCase()}`} />
                  )}
                  {latestProposal.proposal.notes && <Row label="Notes" value={latestProposal.proposal.notes} />}
                </dl>
                {bookingId && !cancelledAt && (
                  <>
                    <p style={{ fontSize: 12, color: "var(--sm-fg-4)", lineHeight: 1.4, margin: "10px 0 0" }}>
                      Payment will run on the service date. Cancelling stops the charge.
                    </p>
                    <button
                      className="btn btn--sm"
                      onClick={cancelBooking}
                      disabled={cancelling}
                      style={{ marginTop: 8, alignSelf: "flex-start" }}
                    >
                      {cancelling ? "Cancelling…" : "Cancel booking"}
                    </button>
                  </>
                )}
                {cancelledAt && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--sm-fg-3)", padding: "8px 10px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-2)" }}>
                    Booking cancelled. The card will not be charged.
                  </div>
                )}
                {cancelError && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--sm-status-error, #c53030)" }}>{cancelError}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* No request linked */}
        {!requestInfo && (
          <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", margin: 0, lineHeight: 1.5 }}>
            No request is linked to this conversation.
          </p>
        )}
      </aside>
    </div>
  );
}

function ProposalBubble({
  msg, isMe, isChurchSide, otherName, onAccept, accepting, fmtTime, fmtShortDate,
}: {
  msg: Message;
  isMe: boolean;
  isChurchSide: boolean;
  otherName: string;
  onAccept: (id: string) => void;
  accepting: string | null;
  fmtTime: (s: string) => string;
  fmtShortDate: (s: string) => string;
}) {
  const p = msg.proposal;
  const accepted = msg.proposal_status === "accepted";
  const pending = msg.proposal_status === "pending";
  const canAccept = !isChurchSide && pending;

  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "75%", border: `1.5px solid ${accepted ? "rgba(22,163,74,0.35)" : "var(--sm-accent)"}`,
        borderRadius: 10, background: "var(--sm-bg-1)", overflow: "hidden",
        borderBottomRightRadius: isMe ? 3 : 10, borderBottomLeftRadius: isMe ? 10 : 3,
      }}>
        {/* Proposal header */}
        <div style={{ padding: "9px 14px 8px", background: accepted ? "rgba(22,163,74,0.06)" : "rgba(228,123,2,0.06)", borderBottom: `1px solid ${accepted ? "rgba(22,163,74,0.15)" : "rgba(228,123,2,0.15)"}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: accepted ? "var(--sm-status-success)" : "var(--sm-accent)" }}>
            {accepted ? "✓ Agreed terms" : "📋 Proposal"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--sm-fg-4)" }}>
            {isMe ? `You sent` : `from ${otherName.split(" ")[0]}`}
          </span>
        </div>

        {/* Terms */}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          {p?.date && (
            <div style={{ display: "flex", gap: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--sm-fg-3)", minWidth: 52 }}>Date</span>
              <span style={{ color: "var(--sm-fg-1)", fontWeight: 500 }}>{fmtShortDate(p.date)}</span>
            </div>
          )}
          {p?.fee != null && (
            <div style={{ display: "flex", gap: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--sm-fg-3)", minWidth: 52 }}>Fee</span>
              <span style={{ color: "var(--sm-fg-1)", fontWeight: 600, fontSize: 15 }}>${p.fee} <span style={{ fontWeight: 400, fontSize: 13, color: "var(--sm-fg-3)" }}>/ {p.feeType.toLowerCase()}</span></span>
            </div>
          )}
          {p?.notes && (
            <div style={{ display: "flex", gap: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--sm-fg-3)", minWidth: 52 }}>Notes</span>
              <span style={{ color: "var(--sm-fg-2)", lineHeight: 1.4 }}>{p.notes}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--sm-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--sm-fg-4)" }}>{fmtTime(msg.created_at)}</span>
          {canAccept && (
            <button
              className="btn btn--primary btn--sm"
              disabled={accepting === msg.id}
              onClick={() => onAccept(msg.id)}
            >
              {accepting === msg.id ? "Accepting…" : "Accept terms"}
            </button>
          )}
          {accepted && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sm-status-success)" }}>✓ Accepted</span>
          )}
          {pending && isMe && (
            <span style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>Awaiting response…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
      <span style={{ color: "var(--sm-fg-3)", minWidth: 72, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--sm-fg-1)", fontWeight: 500, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
