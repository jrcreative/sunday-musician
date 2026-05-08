import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_EVENTS } from "@/lib/email/registry";
import { AdminTopbar } from "../AdminTopbar";
import { AdminTable, DateCell, KpiCard, StatusPill } from "../_components/AdminPrimitives";

function toneFor(status: string) {
  if (status === "sent") return "success";
  if (status === "failed") return "error";
  if (status === "skipped") return "warn";
  return "info";
}

export default async function AdminEmailsPage() {
  const admin = createAdminClient();
  const { data: deliveries } = await admin
    .from("email_deliveries")
    .select("id, event_key, category, to_email, subject, template_id, status, provider_message_id, error, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = deliveries ?? [];
  const sent = rows.filter(r => r.status === "sent").length;
  const failed = rows.filter(r => r.status === "failed").length;
  const skipped = rows.filter(r => r.status === "skipped").length;

  return (
    <>
      <AdminTopbar title="Email deliveries" sub="Transactional email attempts, Resend IDs, template mappings, and failures" />

      <div className="a-page">
      <div className="kpi-grid">
        <KpiCard label="Sent" value={sent} context="latest 100" />
        <KpiCard label="Failed" value={failed} context="needs attention" />
        <KpiCard label="Skipped" value={skipped} context="duplicate or preferences" />
        <KpiCard label="Events" value={Object.keys(EMAIL_EVENTS).length} context="registered in code" />
      </div>

      <section className="chart-card" style={{ marginBottom: 18 }}>
        <h3>Registered templates</h3>
        <div className="sub">Create these in Resend, then set the matching env var when you want hosted templates instead of local HTML.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {Object.values(EMAIL_EVENTS).map(event => (
            <div key={event.key} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: 3, padding: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", marginBottom: 6 }}>{event.key}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{event.templateName}</div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--sm-fg-3)" }}>Env: {event.templateEnv}</div>
            </div>
          ))}
        </div>
      </section>

      <AdminTable
        headers={["Status", "Event", "Recipient", "Subject", "Template", "Sent", "Error"]}
        empty="No email deliveries yet."
      >
        {rows.map(row => (
          <tr key={row.id}>
            <td><StatusPill tone={toneFor(row.status)}>{row.status}</StatusPill></td>
            <td>
              <div style={{ fontWeight: 600 }}>{row.event_key}</div>
              <div className="secondary">{row.category}</div>
            </td>
            <td className="secondary">{row.to_email}</td>
            <td>{row.subject}</td>
            <td className="secondary">
              {row.template_id || "local HTML"}
              {row.provider_message_id && <div>{row.provider_message_id}</div>}
            </td>
            <td><DateCell value={row.sent_at ?? row.created_at} /></td>
            <td className="secondary" style={{ maxWidth: 260 }}>
              {row.error || "—"}
            </td>
          </tr>
        ))}
      </AdminTable>
      </div>
    </>
  );
}
