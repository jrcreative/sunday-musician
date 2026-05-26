import type { EmailMessage } from "../send";
import { appUrl } from "@/lib/app-url";

// CAN-SPAM compliant footer: includes physical mailing address and a link to
// manage email preferences. Rendered in every outgoing email.
function foot() {
  const notifUrl = appUrl("/profile/notifications");
  return `
<p style="font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #e8e6e1;padding-top:16px;line-height:1.6;">
  You're receiving this because you have a Sunday Musician account.<br/>
  <a href="${notifUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a><br/>
  Sunday Musician · 623 N 47th Ave · Ridgefield, WA 98642
</p>`;
}

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
${foot()}
</div></body></html>`;
}

function plain(lines: string[], ctaHref?: string) {
  const notifUrl = appUrl("/profile/notifications");
  const footer = `\n\n---\nManage email preferences: ${notifUrl}\nSunday Musician · 623 N 47th Ave · Ridgefield, WA 98642`;
  return lines.join("\n\n") + (ctaHref ? `\n\n${ctaHref}` : "") + footer;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export type MessageReceivedContext = {
  to: string;
  recipientName: string;
  senderName: string;
  requestTitle: string;
  preview: string;
  threadUrl: string;
};

export function messageReceivedEmail(ctx: MessageReceivedContext): EmailMessage {
  const subject = `New message from ${ctx.senderName}`;
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">New message from ${escapeHtml(ctx.senderName)}</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — ${escapeHtml(ctx.senderName)} sent you a message about <strong>${escapeHtml(ctx.requestTitle)}</strong>.</p>
<p style="font-size:14px;color:#555;border-left:3px solid #e8e6e1;padding-left:12px;">${escapeHtml(ctx.preview)}</p>`,
    ctx.threadUrl,
    "Reply"
  );
  const text = plain([
    `New message from ${ctx.senderName}.`,
    `Re: ${ctx.requestTitle}`,
    ctx.preview,
    `Reply:`,
  ], ctx.threadUrl);
  return { to: ctx.to, subject, html, text };
}

export type ProposalReceivedContext = {
  to: string;
  recipientName: string;
  churchName: string;
  requestTitle: string;
  serviceDate: string;
  feeLabel: string;
  threadUrl: string;
};

export function proposalReceivedEmail(ctx: ProposalReceivedContext): EmailMessage {
  const subject = `${ctx.churchName} sent proposal terms`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">New proposal from ${escapeHtml(ctx.churchName)}</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — ${escapeHtml(ctx.churchName)} sent terms for <strong>${escapeHtml(ctx.requestTitle)}</strong>.</p>
<p style="font-size:14px;color:#555;margin-bottom:0;">Date: ${escapeHtml(dateLabel)}<br/>Fee: ${escapeHtml(ctx.feeLabel)}</p>`,
    ctx.threadUrl,
    "Review proposal"
  );
  const text = plain([
    `New proposal from ${ctx.churchName}.`,
    `${ctx.requestTitle}`,
    `Date: ${dateLabel}`,
    `Fee: ${ctx.feeLabel}`,
    `Review proposal:`,
  ], ctx.threadUrl);
  return { to: ctx.to, subject, html, text };
}

export type BookingConfirmedContext = {
  to: string;
  recipientName: string;
  counterpartyName: string;
  requestTitle: string;
  serviceDate: string;
  feeLabel: string;
  threadUrl: string;
};

export function bookingConfirmedEmail(ctx: BookingConfirmedContext): EmailMessage {
  const subject = `Booking confirmed: ${ctx.requestTitle}`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Booking confirmed</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — <strong>${escapeHtml(ctx.requestTitle)}</strong> is confirmed with ${escapeHtml(ctx.counterpartyName)}.</p>
<p style="font-size:14px;color:#555;margin-bottom:0;">Date: ${escapeHtml(dateLabel)}<br/>Fee: ${escapeHtml(ctx.feeLabel)}</p>`,
    ctx.threadUrl,
    "Open conversation"
  );
  const text = plain([
    `Booking confirmed: ${ctx.requestTitle}`,
    `With: ${ctx.counterpartyName}`,
    `Date: ${dateLabel}`,
    `Fee: ${ctx.feeLabel}`,
    `Open conversation:`,
  ], ctx.threadUrl);
  return { to: ctx.to, subject, html, text };
}

export type BookingCancelledContext = {
  to: string;
  recipientName: string;
  cancelledByName: string;
  requestTitle: string;
  serviceDate: string;
  policyLabel: string;
  reason: string;
  threadUrl: string;
  disputeReviewRequired: boolean;
};

export function bookingCancelledEmail(ctx: BookingCancelledContext): EmailMessage {
  const subject = `Booking cancelled: ${ctx.requestTitle}`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const reviewLine = ctx.disputeReviewRequired
    ? "<p style=\"font-size:14px;color:#555;\">This cancellation has been flagged for admin review.</p>"
    : "";
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Booking cancelled</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — ${escapeHtml(ctx.cancelledByName)} cancelled <strong>${escapeHtml(ctx.requestTitle)}</strong>.</p>
<p style="font-size:14px;color:#555;margin-bottom:0;">Date: ${escapeHtml(dateLabel)}<br/>Policy: ${escapeHtml(ctx.policyLabel)}<br/>Reason: ${escapeHtml(ctx.reason)}</p>
${reviewLine}`,
    ctx.threadUrl,
    "Open conversation"
  );
  const text = plain([
    `Booking cancelled: ${ctx.requestTitle}`,
    `Cancelled by: ${ctx.cancelledByName}`,
    `Date: ${dateLabel}`,
    `Policy: ${ctx.policyLabel}`,
    `Reason: ${ctx.reason}`,
    ctx.disputeReviewRequired ? "This cancellation has been flagged for admin review." : "",
    `Open conversation:`,
  ].filter(Boolean), ctx.threadUrl);
  return { to: ctx.to, subject, html, text };
}

export type PaymentFailedContext = {
  to: string;
  recipientName: string;
  requestTitle: string;
  serviceDate: string;
  amountCents: number;
  errorMessage: string;
  actionUrl: string;
  recipientRole: "church" | "musician" | "admin";
};

export function paymentFailedEmail(ctx: PaymentFailedContext): EmailMessage {
  const subject = ctx.recipientRole === "church"
    ? `Payment failed for ${ctx.requestTitle}`
    : ctx.recipientRole === "musician"
      ? `Payment delayed for ${ctx.requestTitle}`
      : `Admin alert: payment failed for ${ctx.requestTitle}`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const roleCopy = ctx.recipientRole === "church"
    ? "Please update the payment method so the musician can be paid."
    : ctx.recipientRole === "musician"
      ? "The church payment did not go through. We have flagged it for follow-up."
      : "A scheduled marketplace payment failed and needs review.";
  const cta = ctx.recipientRole === "church" ? "Update billing" : ctx.recipientRole === "admin" ? "Review payment" : "View booking";
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Payment needs attention</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — ${escapeHtml(roleCopy)}</p>
<p style="font-size:14px;color:#555;margin-bottom:0;">Request: ${escapeHtml(ctx.requestTitle)}<br/>Date: ${escapeHtml(dateLabel)}<br/>Amount: ${escapeHtml(money(ctx.amountCents))}<br/>Error: ${escapeHtml(ctx.errorMessage)}</p>`,
    ctx.actionUrl,
    cta
  );
  const text = plain([
    `Payment needs attention.`,
    roleCopy,
    `Request: ${ctx.requestTitle}`,
    `Date: ${dateLabel}`,
    `Amount: ${money(ctx.amountCents)}`,
    `Error: ${ctx.errorMessage}`,
    `${cta}:`,
  ], ctx.actionUrl);
  return { to: ctx.to, subject, html, text };
}

export type CardExpiringContext = {
  to: string;
  recipientName: string;
  cardLast4: string;
  expMonth: number;
  expYear: number;
  billingUrl: string;
};

export function cardExpiringEmail(ctx: CardExpiringContext): EmailMessage {
  const subject = "Your payment card is expiring soon";
  const expLabel = `${String(ctx.expMonth).padStart(2, "0")}/${ctx.expYear}`;
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Your card is expiring soon</h2>
<p>Hi ${escapeHtml(ctx.recipientName)} — your card ending in <strong>${escapeHtml(ctx.cardLast4)}</strong> expires <strong>${escapeHtml(expLabel)}</strong>.</p>
<p>To avoid a failed payment on your next service booking, please update your card on file before it expires.</p>`,
    ctx.billingUrl,
    "Update billing"
  );
  const text = plain([
    `Your payment card is expiring soon.`,
    `Hi ${ctx.recipientName} — your card ending in ${ctx.cardLast4} expires ${expLabel}.`,
    `Please update your card on file to avoid failed payments.`,
    `Update billing:`,
  ], ctx.billingUrl);
  return { to: ctx.to, subject, html, text };
}
