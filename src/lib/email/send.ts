import { Resend } from "resend";

// Lazy singleton — only construct when an email is actually sent so missing
// env vars during unrelated dev work don't blow up imports.
let _client: Resend | null = null;
function client() {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  _client = new Resend(key);
  return _client;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "Sunday Musician <noreply@sundaymusician.com>";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Sends an email via Resend. Returns the message id on success.
 *  Throws on hard errors so the caller can decide whether to retry. */
export async function sendEmail(msg: EmailMessage): Promise<string | null> {
  const { data, error } = await client().emails.send({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
