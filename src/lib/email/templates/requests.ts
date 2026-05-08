import type { EmailMessage } from "../send";

const FOOT = `
<p style="font-size:12px;color:#888;margin-top:32px;">
You're receiving this because you have a Sunday Musician account.
</p>`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shell(body: string, ctaHref?: string, ctaLabel?: string) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f5;padding:24px;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:6px;padding:32px;">
${body}
${ctaHref && ctaLabel ? `<p style="margin-top:24px;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#e47b02;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">${escapeHtml(ctaLabel)}</a></p>` : ""}
${FOOT}
</div></body></html>`;
}

function plain(lines: string[], ctaHref?: string) {
  return lines.join("\n\n") + (ctaHref ? `\n\n${ctaHref}` : "");
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export type RequestCreatedChurchContext = {
  to: string;
  churchName: string;
  requestTitle: string;
  serviceDate: string;
  requestUrl: string;
};

export type RequestInviteMusicianContext = {
  to: string;
  musicianName: string;
  churchName: string;
  requestTitle: string;
  serviceDate: string;
  feeLabel: string;
  threadUrl: string;
};

export function requestCreatedChurchEmail(ctx: RequestCreatedChurchContext): EmailMessage {
  const title = escapeHtml(ctx.requestTitle);
  const dateLabel = fmtDate(ctx.serviceDate);
  const subject = `Request posted: ${ctx.requestTitle}`;
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Your request is live</h2>
<p>Hi ${escapeHtml(ctx.churchName)} — your request, <strong>${title}</strong>, has been posted for ${escapeHtml(dateLabel)}.</p>
<p style="font-size:14px;color:#555;">You can review the request, invite musicians, and manage conversations from Sunday Musician.</p>`,
    ctx.requestUrl,
    "View request"
  );
  const text = plain([
    `Your request is live.`,
    `${ctx.requestTitle} has been posted for ${dateLabel}.`,
    `View request:`,
  ], ctx.requestUrl);
  return { to: ctx.to, subject, html, text };
}

export function requestInviteMusicianEmail(ctx: RequestInviteMusicianContext): EmailMessage {
  const subject = `${ctx.churchName} invited you to ${ctx.requestTitle}`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">New invitation from ${escapeHtml(ctx.churchName)}</h2>
<p>Hi ${escapeHtml(ctx.musicianName)} — ${escapeHtml(ctx.churchName)} invited you to <strong>${escapeHtml(ctx.requestTitle)}</strong>.</p>
<p style="font-size:14px;color:#555;margin-bottom:0;">Date: ${escapeHtml(dateLabel)}<br/>Fee: ${escapeHtml(ctx.feeLabel)}</p>`,
    ctx.threadUrl,
    "Review invitation"
  );
  const text = plain([
    `New invitation from ${ctx.churchName}.`,
    `${ctx.requestTitle}`,
    `Date: ${dateLabel}`,
    `Fee: ${ctx.feeLabel}`,
    `Review invitation:`,
  ], ctx.threadUrl);
  return { to: ctx.to, subject, html, text };
}
