import type { RequestQualityScore } from "@/lib/requests/quality";

export function RequestQualityCard({ score }: { score: RequestQualityScore }) {
  const accent =
    score.percent >= 90 ? "var(--sm-status-success)" :
    score.percent >= 75 ? "var(--sm-accent)" :
    score.percent >= 60 ? "var(--sm-status-warn)" :
    "var(--sm-status-error)";

  return (
    <section style={{
      border: "1px solid var(--sm-border-subtle)",
      borderRadius: "var(--sm-radius-sm)",
      padding: 20,
      background: "var(--sm-bg-1)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 6px" }}>
            Request readiness
          </h3>
          <p style={{ margin: 0, color: "var(--sm-fg-2)", fontSize: 14, lineHeight: 1.5 }}>{score.summary}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: accent }}>{score.percent}%</div>
          <div style={{ fontSize: 12, color: "var(--sm-fg-3)", fontWeight: 600, marginTop: 3 }}>{score.grade}</div>
        </div>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: "var(--sm-bg-3)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${score.percent}%`, height: "100%", background: accent }} />
      </div>

      <div className="sm-row-2" style={{ gap: 18 }}>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--sm-fg-2)" }}>Working well</h4>
          {score.strengths.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--sm-fg-3)", fontSize: 13.5, lineHeight: 1.55 }}>
              {score.strengths.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--sm-fg-4)", fontSize: 13.5 }}>Add core details to start building readiness.</p>
          )}
        </div>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--sm-fg-2)" }}>Improve response rate</h4>
          {score.improvements.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--sm-fg-3)", fontSize: 13.5, lineHeight: 1.55 }}>
              {score.improvements.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--sm-fg-3)", fontSize: 13.5 }}>No major readiness gaps found.</p>
          )}
        </div>
      </div>
    </section>
  );
}
