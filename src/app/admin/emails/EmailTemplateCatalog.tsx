"use client";

import { useState } from "react";

export type EmailTemplateEvent = {
  key: string;
  label: string;
  description: string;
  subject: string;
  category: string;
  suggestedTemplateName: string;
  templateEnv: string;
  templateId: string | null;
  tags: Array<{ name: string; description: string }>;
};

export function EmailTemplateCatalog({
  events,
}: {
  events: EmailTemplateEvent[];
}) {
  const [selected, setSelected] = useState<EmailTemplateEvent | null>(null);

  return (
    <>
      <section className="chart-card" style={{ marginBottom: 18 }}>
        <h3>Template triggers</h3>
        <div className="sub">Click a trigger to see its Resend mapping and available template tags.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map(event => (
            <button
              key={event.key}
              type="button"
              onClick={() => setSelected(event)}
              style={{
                width: "100%",
                border: "1px solid var(--sm-border-subtle)",
                borderRadius: 3,
                background: "var(--sm-bg-1)",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 14,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--sm-fg-1)" }}>{event.label}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--sm-fg-3)", marginTop: 3 }}>{event.description}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`a-pill ${event.templateId ? "a-pill--success" : "a-pill--warn"}`}>
                  {event.templateId ? "Resend" : "Fallback"}
                </span>
                <span style={{ color: "var(--sm-fg-4)", fontSize: 18 }}>›</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <TemplateDrawer event={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function TemplateDrawer({
  event,
  onClose,
}: {
  event: EmailTemplateEvent;
  onClose: () => void;
}) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Email template details">
        <div className="drawer-head">
          <div>
            <h2>{event.label}</h2>
            <div className="sub">{event.key}</div>
          </div>
          <button className="x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          <div className="section-h">Trigger</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--sm-fg-2)" }}>
            {event.description}
          </p>

          <div className="section-h">Resend mapping</div>
          <dl className="dl-grid">
            <dt>Category</dt><dd>{event.category}</dd>
            <dt>Subject</dt><dd>{event.subject}</dd>
            <dt>Suggested label</dt><dd>{event.suggestedTemplateName}</dd>
            <dt>Env var</dt><dd style={{ wordBreak: "break-word" }}>{event.templateEnv}</dd>
            <dt>Template ID</dt>
            <dd style={{ wordBreak: "break-word" }}>
              {event.templateId ? event.templateId : "Not configured. Local HTML fallback will be used."}
            </dd>
          </dl>

          <div className="section-h">Template tags</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {event.tags.map(tag => (
              <div key={tag.name} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: 3, padding: 12 }}>
                <code style={{ fontSize: 12.5, fontWeight: 700 }}>{tag.name}</code>
                <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", lineHeight: 1.5, marginTop: 4 }}>
                  {tag.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
