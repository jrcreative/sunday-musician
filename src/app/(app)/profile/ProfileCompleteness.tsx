"use client";

// Completeness meter: shows the user how far through they are filling in
// their profile and surfaces the "view as the other side sees me" link.
// Pure presentation — the parent passes the computed percentage and a list
// of missing-field labels.

export function ProfileCompleteness({
  percent,
  missing,
  previewHref,
  previewLabel,
  openInNewTab = true,
}: {
  percent: number;
  missing: string[];
  previewHref: string | null;
  previewLabel: string;
  openInNewTab?: boolean;
}) {
  return (
    <section style={{
      display: "flex", flexDirection: "column", gap: 12,
      padding: "16px 20px",
      border: "1px solid var(--sm-border-subtle)",
      borderRadius: "var(--sm-radius-sm)",
      background: "var(--sm-bg-1)",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sm-fg-2)" }}>
            Profile completeness
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: percent === 100 ? "var(--sm-status-success)" : "var(--sm-fg-1)" }}>
            {percent}%
          </span>
        </div>
        {previewHref && (
          <a
            href={previewHref}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
            className="btn btn--sm"
          >
            {previewLabel}
          </a>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--sm-bg-3)",
          overflow: "hidden",
        }}
      >
        <div style={{
          width: `${percent}%`,
          height: "100%",
          background: percent === 100 ? "var(--sm-status-success)" : "var(--sm-accent)",
          transition: "width 200ms ease",
        }} />
      </div>
      {missing.length > 0 && (
        <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", lineHeight: 1.5 }}>
          Still missing: {missing.join(" · ")}
        </div>
      )}
    </section>
  );
}
