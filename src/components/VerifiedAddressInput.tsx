"use client";

import { useState } from "react";

export type VerifiedAddressValue = {
  formattedAddress: string;
  streetAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
};

export function VerifiedAddressInput({
  id,
  label,
  value,
  verifiedAddress,
  placeholder = "Start typing a full address",
  help = "Enter the full address, then verify it for accurate matching.",
  required = false,
  onValueChange,
  onVerified,
  onClear,
}: {
  id: string;
  label: string;
  value: string;
  verifiedAddress: VerifiedAddressValue | null;
  placeholder?: string;
  help?: string;
  required?: boolean;
  onValueChange: (value: string) => void;
  onVerified: (address: VerifiedAddressValue) => void;
  onClear: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const query = value.trim();
    if (!query || verifying) return;

    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/locations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await res.json().catch(() => ({})) as Partial<VerifiedAddressValue> & { error?: string };
      if (
        !res.ok ||
        typeof payload.lat !== "number" ||
        typeof payload.lng !== "number" ||
        !payload.formattedAddress ||
        !payload.streetAddress
      ) {
        throw new Error(payload.error ?? "Could not verify address");
      }

      const verified = {
        formattedAddress: payload.formattedAddress,
        streetAddress: payload.streetAddress,
        lat: payload.lat,
        lng: payload.lng,
        city: payload.city ?? "",
        state: payload.state ?? "",
        zip: payload.zip ?? "",
      };
      onVerified(verified);
      onValueChange(verified.formattedAddress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify address");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
        <input
          id={id}
          type="text"
          className="input"
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={e => {
            onValueChange(e.target.value);
            onClear();
            setError(null);
          }}
          onBlur={() => {
            if (!verifiedAddress && value.trim().length >= 8) verify();
          }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              verify();
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={verify} disabled={verifying || value.trim().length < 8}>
          {verifying ? "Verifying..." : "Verify"}
        </button>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {verifiedAddress ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sm-status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span style={{ fontSize: 13, color: "var(--sm-status-success)", flex: 1 }}>{verifiedAddress.formattedAddress}</span>
          </>
        ) : error ? (
          <span style={{ fontSize: 13, color: "var(--sm-status-error)" }}>{error}</span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--sm-fg-4)" }}>{help}</span>
        )}
      </div>
    </div>
  );
}
