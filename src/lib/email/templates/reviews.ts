// Plain HTML templates. Kept simple on purpose — once we have more email
// surfaces, we can move to React Email and centralize the layout.

import type { EmailMessage } from "../send";

const FOOT = `
<p style="font-size:12px;color:#888;margin-top:32px;">
You're receiving this because you have a Sunday Musician account.
</p>`;

function shell(body: string, ctaHref?: string, ctaLabel?: string) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f5;padding:24px;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:6px;padding:32px;">
${body}
${ctaHref && ctaLabel ? `<p style="margin-top:24px;"><a href="${ctaHref}" style="display:inline-block;background:#e47b02;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">${ctaLabel}</a></p>` : ""}
${FOOT}
</div></body></html>`;
}

function plain(lines: string[], ctaHref?: string) {
  return lines.join("\n\n") + (ctaHref ? `\n\n${ctaHref}` : "");
}

export type ReviewEmailContext = {
  to: string;
  recipientName: string;
  counterpartyName: string;
  serviceDate: string;          // YYYY-MM-DD
  reviewUrl: string;            // absolute URL to /reviews/[periodId]
};

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** Day after the service: prompt for review. */
export function reviewPromptEmail(ctx: ReviewEmailContext): EmailMessage {
  const subject = `How was ${ctx.counterpartyName}?`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">How was ${ctx.counterpartyName}?</h2>
<p>Hi ${ctx.recipientName} — your service on ${dateLabel} just wrapped. Take a minute to leave a review.</p>
<p style="font-size:14px;color:#555;">Reviews are held privately for 7 days. They're released when both sides have submitted, or when the window closes — whichever comes first. This keeps feedback honest.</p>`,
    ctx.reviewUrl, "Leave a review"
  );
  const text = plain([
    `How was ${ctx.counterpartyName}?`,
    `Your service on ${dateLabel} just wrapped. Take a minute to leave a review.`,
    `Reviews are held privately for 7 days — released when both sides submit or the window closes.`,
    `Leave a review:`,
  ], ctx.reviewUrl);
  return { to: ctx.to, subject, html, text };
}

/** Day 4 (3 days into the window): nudge if they haven't submitted. */
export function reviewReminderEmail(ctx: ReviewEmailContext & { daysRemaining: number }): EmailMessage {
  const subject = `Reminder: review ${ctx.counterpartyName}`;
  const dateLabel = fmtDate(ctx.serviceDate);
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">${ctx.daysRemaining} ${ctx.daysRemaining === 1 ? "day" : "days"} left to review ${ctx.counterpartyName}</h2>
<p>Hi ${ctx.recipientName} — you haven't yet reviewed your service on ${dateLabel}. Once the window closes, we release whatever's been submitted, even if only one side responded.</p>`,
    ctx.reviewUrl, "Leave a review"
  );
  const text = plain([
    `${ctx.daysRemaining} ${ctx.daysRemaining === 1 ? "day" : "days"} left to review ${ctx.counterpartyName}.`,
    `Your service was on ${dateLabel}. Window closes soon.`,
    `Leave a review:`,
  ], ctx.reviewUrl);
  return { to: ctx.to, subject, html, text };
}

/** Both sides done (or window expired): reviews are now visible. */
export function reviewReleasedEmail(ctx: ReviewEmailContext): EmailMessage {
  const subject = `Your review of ${ctx.counterpartyName} is now visible`;
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Reviews are released</h2>
<p>Hi ${ctx.recipientName} — your review of ${ctx.counterpartyName}, and theirs of you, are now visible on each other's profiles.</p>`,
    ctx.reviewUrl, "View reviews"
  );
  const text = plain([
    `Reviews are released.`,
    `Your review of ${ctx.counterpartyName}, and theirs of you, are now visible.`,
    `View:`,
  ], ctx.reviewUrl);
  return { to: ctx.to, subject, html, text };
}
