import { EMAIL_EVENTS } from "@/lib/email/registry";
import { AdminTopbar } from "../../AdminTopbar";
import { KpiCard } from "../../_components/AdminPrimitives";
import { EmailTemplateCatalog, type EmailTemplateEvent } from "../EmailTemplateCatalog";

export default async function AdminEmailTriggersPage() {
  const templateEvents: EmailTemplateEvent[] = Object.values(EMAIL_EVENTS).map(event => ({
    key: event.key,
    label: event.label,
    description: event.description,
    subject: event.subject,
    category: event.category,
    suggestedTemplateName: event.suggestedTemplateName,
    templateEnv: event.templateEnv,
    templateId: process.env[event.templateEnv]?.trim() || null,
    tags: [...event.tags],
  }));
  const configured = templateEvents.filter(event => event.templateId).length;
  const fallback = templateEvents.length - configured;
  const critical = templateEvents.filter(event => event.category === "critical").length;

  return (
    <>
      <AdminTopbar title="Email triggers" sub="Registered events, Resend mappings, and template tags" />
      <div className="a-page">
        <div className="kpi-grid">
          <KpiCard label="Registered events" value={templateEvents.length} context="from EMAIL_EVENTS" />
          <KpiCard label="Resend templates" value={configured} context="configured by env var" />
          <KpiCard label="Fallback templates" value={fallback} context="local HTML fallback" />
          <KpiCard label="Critical events" value={critical} context="cannot be muted" />
        </div>

        <EmailTemplateCatalog events={templateEvents} />
      </div>
    </>
  );
}
