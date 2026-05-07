"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Review = {
  id: string;
  reviewer_role: "musician" | "church";
  rating: number;
  body: string;
  submitted_at: string;
};

export function ReviewClient({
  periodId,
  myRole,
  counterpartyName,
  serviceDate,
  revealAt,
  released,
  serviceCompleted,
  myReview,
  otherReview,
}: {
  periodId: string;
  myRole: "musician" | "church";
  counterpartyName: string;
  serviceDate: string;
  revealAt: string;
  released: boolean;
  serviceCompleted: boolean;
  myReview: Review | null;
  otherReview: Review | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [body, setBody] = useState(myReview?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dateLabel = new Date(serviceDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const revealDate = new Date(revealAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) { setError("Pick a star rating from 1 to 5."); return; }
    if (body.trim().length === 0) { setError("Add a short description."); return; }

    setBusy(true);
    const { error } = await supabase.from("reviews").insert({
      period_id: periodId,
      reviewer_role: myRole,
      rating,
      body: body.trim(),
    });
    setBusy(false);

    if (error) { setError(error.message); return; }
    router.refresh();
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
          Service on {dateLabel}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--sm-fg-1)" }}>
          {myReview ? `Your review of ${counterpartyName}` : `How was ${counterpartyName}?`}
        </h1>
        <p style={{ fontSize: 14, color: "var(--sm-fg-3)", margin: 0, lineHeight: 1.55, maxWidth: 560 }}>
          {released
            ? "Both reviews are now visible below."
            : myReview
              ? `Your review is locked until ${counterpartyName} also submits, or until ${revealDate} when the window closes.`
              : "Leave a 1–5 star rating and a short description. Reviews are held until both sides submit, or for 7 days — whichever comes first."}
        </p>
      </div>

      {/* My review */}
      {!myReview && serviceCompleted && (
        <form onSubmit={submit} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 24, background: "var(--sm-bg-1)", marginBottom: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--sm-fg-2)", marginBottom: 8 }}>Rating</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--sm-fg-2)", marginBottom: 8 }}>What stood out?</label>
            <textarea
              className="input"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder={myRole === "church"
                ? "Were they on time, prepared, and easy to work with?"
                : "Was the service well-organized? How did the team treat you?"}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
          {error && (
            <div style={{ padding: 10, borderRadius: "var(--sm-radius-sm)", background: "rgba(184,33,5,0.08)", color: "var(--sm-status-danger, #b82105)", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </form>
      )}

      {!myReview && !serviceCompleted && (
        <div style={{ padding: 18, border: "1px dashed var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)", fontSize: 14, marginBottom: 20 }}>
          You'll be able to review {counterpartyName} after the service date.
        </div>
      )}

      {myReview && (
        <ReviewBlock
          title="Your review"
          subtitle={released ? "Released" : "Held until both sides submit"}
          rating={myReview.rating}
          body={myReview.body}
          accent
        />
      )}

      {/* Other side's review */}
      {otherReview && (released
        ? <ReviewBlock
            title={`${counterpartyName}'s review`}
            subtitle={new Date(otherReview.submitted_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            rating={otherReview.rating}
            body={otherReview.body}
          />
        : null
      )}

      {!released && myReview && !otherReview && (
        <div style={{ padding: 16, marginTop: 14, border: "1px dashed var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)", fontSize: 14 }}>
          Waiting for {counterpartyName} to submit. We'll email you when their review is released — or when the window closes on {revealDate}.
        </div>
      )}
    </>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 32,
            lineHeight: 1,
            padding: 2,
            color: n <= value ? "var(--sm-accent)" : "var(--sm-border-subtle)",
            transition: "color 100ms",
          }}
        >★</button>
      ))}
    </div>
  );
}

function ReviewBlock({
  title,
  subtitle,
  rating,
  body,
  accent,
}: {
  title: string;
  subtitle: string;
  rating: number;
  body: string;
  accent?: boolean;
}) {
  return (
    <div style={{
      border: `1px solid ${accent ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
      borderRadius: "var(--sm-radius-sm)",
      padding: 20,
      background: "var(--sm-bg-1)",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--sm-fg-1)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>{subtitle}</div>
      </div>
      <div style={{ color: "var(--sm-accent)", fontSize: 16, marginBottom: 8 }}>{"★".repeat(rating)}<span style={{ color: "var(--sm-border-subtle)" }}>{"★".repeat(5 - rating)}</span></div>
      <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</p>
    </div>
  );
}
