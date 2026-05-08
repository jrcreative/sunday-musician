"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

export type SavedCard = {
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
} | null;

export function CardOnFile({ initial }: { initial: SavedCard }) {
  const [card, setCard] = useState<SavedCard>(initial);
  const [showForm, setShowForm] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startAdd() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/setup-intent", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.clientSecret || !json.publishableKey) {
        throw new Error(json.error ?? "Could not start card setup");
      }
      setStripePromise(loadStripe(json.publishableKey));
      setClientSecret(json.clientSecret);
      setShowForm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function removeCard() {
    if (!confirm("Remove this card? You'll need to add one before accepting future bookings.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/payment-method", { method: "DELETE" });
    if (res.ok) {
      setCard(null);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not remove card");
    }
    setBusy(false);
  }

  return (
    <section className="sm-card" style={{ padding: 24, marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Payment method</h2>
      <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", marginBottom: 16 }}>
        Save a card on file. We&apos;ll authorize bookings when you accept proposals
        and charge on the day of the service.
      </p>

      {card?.card_last4 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{card.card_brand}</span>
            <span style={{ fontSize: 14, color: "var(--sm-fg-2)" }}>•••• {card.card_last4}</span>
            <span style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
              Exp {String(card.card_exp_month).padStart(2, "0")}/{String(card.card_exp_year).slice(-2)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--sm" onClick={startAdd} disabled={busy}>Replace</button>
            <button className="btn btn--sm" onClick={removeCard} disabled={busy}>Remove</button>
          </div>
        </div>
      ) : (
        !showForm && (
          <button className="btn btn--primary" onClick={startAdd} disabled={busy}>
            {busy ? "Loading…" : "Add card"}
          </button>
        )
      )}

      {showForm && stripePromise && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardForm
            clientSecret={clientSecret}
            onSaved={(c) => { setCard(c); setShowForm(false); setClientSecret(null); }}
            onCancel={() => { setShowForm(false); setClientSecret(null); }}
          />
        </Elements>
      )}

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{error}</div>
      )}
    </section>
  );
}

function CardForm({
  clientSecret,
  onSaved,
  onCancel,
}: {
  clientSecret: string;
  onSaved: (card: NonNullable<SavedCard>) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cardOptions = useMemo(() => ({
    style: {
      base: {
        fontSize: "15px",
        color: "#1a1a1a",
        "::placeholder": { color: "#9ca3af" },
      },
    },
  }), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setErr(null);
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) { setSubmitting(false); return; }

    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardEl },
    });
    if (result.error) {
      setErr(result.error.message ?? "Card setup failed");
      setSubmitting(false);
      return;
    }
    const pmId = typeof result.setupIntent.payment_method === "string"
      ? result.setupIntent.payment_method
      : result.setupIntent.payment_method?.id;
    if (!pmId) {
      setErr("No payment method returned");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/stripe/payment-method", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentMethodId: pmId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErr(json.error ?? "Could not save card");
      setSubmitting(false);
      return;
    }

    const pmDetail = typeof result.setupIntent.payment_method === "object"
      ? result.setupIntent.payment_method
      : null;
    onSaved({
      card_brand: pmDetail?.card?.brand ?? null,
      card_last4: pmDetail?.card?.last4 ?? null,
      card_exp_month: pmDetail?.card?.exp_month ?? null,
      card_exp_year: pmDetail?.card?.exp_year ?? null,
    });
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <div style={{
        padding: "12px 14px", border: "1px solid var(--sm-border-subtle)",
        borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)",
      }}>
        <CardElement options={cardOptions} />
      </div>
      {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--sm-status-error, #c53030)" }}>{err}</div>}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={!stripe || submitting}>
          {submitting ? "Saving…" : "Save card"}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}
