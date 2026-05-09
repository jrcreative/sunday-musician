import type { EmailMessage } from "../send";

const FOOT = `
<p style="font-size:12px;color:#888;margin-top:32px;">
You're receiving this because you created a Sunday Musician account.
</p>`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shell(body: string, ctaHref: string, ctaLabel: string) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f5;padding:24px;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:6px;padding:32px;">
${body}
<p style="margin-top:24px;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#e47b02;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:600;">${escapeHtml(ctaLabel)}</a></p>
${FOOT}
</div></body></html>`;
}

function plain(lines: string[], ctaHref: string) {
  return `${lines.join("\n\n")}\n\n${ctaHref}`;
}

export type MusicianOnboardingContext = {
  to: string;
  musicianName: string;
  profileUrl: string;
  dashboardUrl: string;
  payoutsUrl: string;
};

export function musicianOnboardingEmail(ctx: MusicianOnboardingContext): EmailMessage {
  const subject = `Welcome to Sunday Musician, ${ctx.musicianName}`;
  const html = shell(
    `<h2 style="margin:0 0 16px;font-size:20px;">Welcome, ${escapeHtml(ctx.musicianName)}</h2>
<p>Your musician account is ready. The best next step is completing your profile so churches can understand your instruments, experience, denomination fit, gear, and media samples.</p>
<p style="font-size:14px;color:#555;">After that, connect Stripe for payouts so accepted bookings can be paid out smoothly.</p>`,
    ctx.profileUrl,
    "Complete your profile"
  );
  const text = plain([
    `Welcome to Sunday Musician, ${ctx.musicianName}.`,
    "Your musician account is ready. Complete your profile so churches can understand your instruments, experience, denomination fit, gear, and media samples.",
    `Dashboard: ${ctx.dashboardUrl}`,
    `Payout setup: ${ctx.payoutsUrl}`,
    "Complete your profile:",
  ], ctx.profileUrl);
  return { to: ctx.to, subject, html, text };
}
