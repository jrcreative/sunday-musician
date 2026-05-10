"use client";

import { useState } from "react";
import Link from "next/link";
import {
  REQUEST_STATUS_CHIP,
  REQUEST_STATUS_LABEL,
  type RequestStatusRaw,
  requestDisplayStatus,
} from "@/lib/requests/status";

type Request = {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  service_time: string | null;
  location: string | null;
  offered_fee: number | null;
  fee_type: string;
  status: RequestStatusRaw;
  instruments_needed: string[];
  created_at: string;
};

export function RequestsClient({ requests, isChurch }: { requests: Request[]; isChurch: boolean }) {
  const [tab, setTab] = useState<"all" | "open" | "closed">("all");

  const decorated = requests.map(r => ({ ...r, _display: requestDisplayStatus(r.status, r.service_date) }));

  const filtered = decorated.filter(r => {
    if (tab === "all") return true;
    if (tab === "open") return r._display === "open";
    return r._display !== "open"; // closed = filled | cancelled | expired
  });

  const counts = {
    all: decorated.length,
    open: decorated.filter(r => r._display === "open").length,
    closed: decorated.filter(r => r._display !== "open").length,
  };

  return (
    <div className="page">
      {requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16 }}>
            {isChurch ? "No requests yet. Post your first one to find a musician." : "You haven't applied to any requests yet."}
          </p>
          {isChurch && <Link href="/requests/new" className="btn btn--primary">Post a request</Link>}
          {!isChurch && <Link href="/find" className="btn btn--primary">Find musicians</Link>}
        </div>
      ) : (
        <>
          <div className="tabs">
            {(["all", "open", "closed"] as const).map(t => (
              <button
                key={t}
                className="tab"
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t === "all" ? "All" : t === "open" ? "Open" : "Closed"}
                <span className="count">{counts[t]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--sm-fg-3)" }}>
              No {tab} requests.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(r => {
                const d = new Date(r.service_date + "T12:00:00");
                return (
                  <Link key={r.id} href={`/requests/${r.id}`} style={{ textDecoration: "none" }}>
                    <div className="sm-list-card" style={{
                      padding: "20px 24px",
                      border: "1px solid var(--sm-border-subtle)",
                      borderRadius: "var(--sm-radius-sm)",
                      background: "var(--sm-bg-1)",
                      transition: "border-color var(--sm-dur-base) var(--sm-ease)",
                      cursor: "pointer",
                      opacity: r._display === "open" ? 1 : 0.78,
                    }}>
                      {/* Date block */}
                      <div className="sm-list-card__date" style={{ textAlign: "center", paddingRight: 22, borderRight: "1px solid var(--sm-border-subtle)", minWidth: 72 }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                          {d.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 2 }}>
                          {d.getDate()}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--sm-fg-3)", marginTop: 2 }}>
                          {d.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="sm-list-card__main">
                        <div style={{ fontSize: 15.5, fontWeight: 600, margin: "0 0 5px", color: "var(--sm-fg-1)" }}>{r.title}</div>
                        <div className="sm-list-card__meta" style={{ fontSize: 13.5, color: "var(--sm-fg-3)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                          <span>{r.service_type}</span>
                          {r.offered_fee != null && <span>· ${r.offered_fee} {r.fee_type.toLowerCase()}</span>}
                          {r.location && <span>· {r.location}</span>}
                        </div>
                        {r.instruments_needed.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {r.instruments_needed.map(i => <span key={i} className="chip">{i}</span>)}
                          </div>
                        )}
                      </div>

                      {/* Status */}
                      <div style={{ textAlign: "right" }}>
                        <span className={REQUEST_STATUS_CHIP[r._display]}>{REQUEST_STATUS_LABEL[r._display]}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
