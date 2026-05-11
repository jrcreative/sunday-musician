import { NextResponse } from "next/server";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import type { EmailDeliveryCategory } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  eventKey?: string;
};

type EmailEvent = {
  key: string;
  label: string;
  description: string;
  subject: string;
  category: EmailDeliveryCategory;
  suggestedTemplateName: string;
  templateEnv: string;
  tags: Array<{ name: string; description: string }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sampleValue(tag: string) {
  if (tag.endsWith("_URL")) return "https://example.com/test";
  if (tag.endsWith("_DATE")) return "2026-06-07";
  if (tag === "DAYS_REMAINING") return 2;
  if (tag === "AMOUNT") return "$255.00";
  if (tag === "FEE_LABEL") return "$250 Per service";
  if (tag.includes("EMAIL")) return "admin@example.com";
  if (tag.includes("ERROR")) return "Test payment failure message";
  if (tag.includes("REASON")) return "Schedule conflict";
  if (tag.includes("POLICY")) return "Standard cancellation";
  if (tag.includes("MESSAGE")) return "This is a sample message preview.";
  if (tag.includes("REQUEST_TITLE")) return "Sunday morning service";
  if (tag.includes("CHURCH")) return "Grace Community Church";
  if (tag.includes("MUSICIAN")) return "Jordan Lee";
  if (tag.includes("COUNTERPARTY")) return "Grace Community Church";
  if (tag.includes("SENDER")) return "Jordan Lee";
  if (tag.includes("RECIPIENT")) return "Admin";
  return `Sample ${tag.toLowerCase().replaceAll("_", " ")}`;
}

function sampleVariables(event: EmailEvent) {
  return Object.fromEntries(event.tags.map(tag => [tag.name, sampleValue(tag.name)]));
}

function interpolate(subject: string, variables: Record<string, string | number>) {
  return subject.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => String(variables[key] ?? key));
}

function localTestEmail(event: EmailEvent, to: string, variables: Record<string, string | number>) {
  const rows = Object.entries(variables)
    .map(([key, value]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;"><code>${escapeHtml(key)}</code></td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(String(value))}</td></tr>`)
    .join("");
  return {
    to,
    subject: `[Test] ${interpolate(event.subject, variables)}`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f5;padding:24px;color:#1a1a1a;">
<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:6px;padding:32px;">
<h2 style="margin:0 0 12px;font-size:20px;">Test email: ${escapeHtml(event.label)}</h2>
<p style="font-size:14px;color:#555;line-height:1.5;">${escapeHtml(event.description)}</p>
<p style="font-size:13px;color:#777;">Event key: <code>${escapeHtml(event.key)}</code><br/>Template: ${escapeHtml(event.suggestedTemplateName)}</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:18px;">${rows}</table>
<p style="font-size:12px;color:#888;margin-top:32px;">Admin test send from Sunday Musician.</p>
</div></body></html>`,
    text: [
      `Test email: ${event.label}`,
      event.description,
      `Event key: ${event.key}`,
      `Template: ${event.suggestedTemplateName}`,
      ...Object.entries(variables).map(([key, value]) => `${key}: ${value}`),
    ].join("\n"),
  };
}

export const POST = withAdminJson(async ({ actor }, req: Request) => {
  const body = await req.json().catch(() => null) as Payload | null;
  const event = Object.values(EMAIL_EVENTS).find(e => e.key === body?.eventKey) as EmailEvent | undefined;
  if (!event) return NextResponse.json({ error: "Email event not found" }, { status: 404 });
  if (!actor.email) return NextResponse.json({ error: "Admin email not found" }, { status: 400 });

  const templateId = configuredTemplateId(event);
  const variables = sampleVariables(event);
  const message = localTestEmail(event, actor.email, variables);
  const result = await sendTransactionalEmail({
    eventKey: `${event.key}.test`,
    category: "critical",
    dedupeKey: `${event.key}:test:${actor.id}:${Date.now()}`,
    recipientProfileId: actor.id,
    message,
    template: templateId ? {
      templateId,
      variables,
    } : undefined,
    payload: {
      tested_event_key: event.key,
      template_id: templateId ?? null,
      source: "admin_email_trigger_test",
    },
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: result.status, providerId: result.status === "sent" ? result.id : null });
});
