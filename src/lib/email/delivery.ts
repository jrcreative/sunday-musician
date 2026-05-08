import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailDeliveryCategory, Json } from "@/lib/supabase/types";
import { sendEmail, sendTemplateEmail, type EmailMessage } from "./send";

type TemplateConfig = {
  templateId?: string;
  variables?: Record<string, string | number | boolean | null>;
};

export type TransactionalEmail = {
  eventKey: string;
  category: EmailDeliveryCategory;
  dedupeKey: string;
  recipientProfileId: string | null;
  message: EmailMessage;
  template?: TemplateConfig;
  payload?: Json;
};

type DeliveryResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: "duplicate" | "preferences" | "missing_recipient" }
  | { status: "failed"; error: string };

const PREF_BY_CATEGORY: Partial<Record<EmailDeliveryCategory, "payment_emails" | "activity_emails" | "system_emails">> = {
  payment: "payment_emails",
  activity: "activity_emails",
  system: "system_emails",
};

async function allowsEmail(recipientProfileId: string | null, category: EmailDeliveryCategory) {
  if (category === "critical" || !recipientProfileId) return true;
  const column = PREF_BY_CATEGORY[category];
  if (!column) return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .select("payment_emails, activity_emails, system_emails")
    .eq("profile_id", recipientProfileId)
    .maybeSingle();

  if (error) return true;
  return data?.[column] ?? true;
}

export async function sendTransactionalEmail(input: TransactionalEmail): Promise<DeliveryResult> {
  if (!input.message.to.trim()) {
    return { status: "skipped", reason: "missing_recipient" };
  }

  const admin = createAdminClient();
  const allowed = await allowsEmail(input.recipientProfileId, input.category);
  if (!allowed) {
    const { error } = await admin.from("email_deliveries").insert({
      event_key: input.eventKey,
      category: input.category,
      dedupe_key: input.dedupeKey,
      recipient_profile_id: input.recipientProfileId,
      to_email: input.message.to,
      subject: input.message.subject,
      template_id: input.template?.templateId ?? null,
      payload: input.payload ?? {},
      status: "skipped",
      error: "User has disabled this email category",
    });
    if (error?.code === "23505") return { status: "skipped", reason: "duplicate" };
    return { status: "skipped", reason: "preferences" };
  }

  const { data: delivery, error: insertError } = await admin
    .from("email_deliveries")
    .insert({
      event_key: input.eventKey,
      category: input.category,
      dedupe_key: input.dedupeKey,
      recipient_profile_id: input.recipientProfileId,
      to_email: input.message.to,
      subject: input.message.subject,
      template_id: input.template?.templateId ?? null,
      payload: input.payload ?? {},
      status: "sending",
    })
    .select("id")
    .single();

  if (insertError?.code === "23505") return { status: "skipped", reason: "duplicate" };
  if (insertError || !delivery) return { status: "failed", error: insertError?.message ?? "Could not create email delivery" };

  try {
    const providerId = input.template?.templateId
      ? await sendTemplateEmail({
          to: input.message.to,
          subject: input.message.subject,
          templateId: input.template.templateId,
          variables: input.template.variables ?? {},
        })
      : await sendEmail(input.message);

    await admin
      .from("email_deliveries")
      .update({
        status: "sent",
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    return { status: "sent", id: providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    await admin
      .from("email_deliveries")
      .update({ status: "failed", error: message })
      .eq("id", delivery.id);
    return { status: "failed", error: message };
  }
}
