import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { cardExpiringEmail } from "@/lib/email/templates/marketplace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Daily sweep: find church payment cards expiring within 30 days and send a
// one-per-month reminder so they can update before a booking payment fails.
//
// Dedupe key: `card-expiry-{profileId}-{YYYY-MM}` — one email per church per
// calendar month, regardless of how many times the cron runs.

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  // Fetch church stripe_customers where the card expires within 30 days
  // and the profile is active (not deleted/suspended).
  const { data: expiringCards, error } = await admin
    .from("stripe_customers")
    .select(`
      profile_id,
      card_last4,
      card_exp_month,
      card_exp_year,
      profiles ( email, display_name, deleted_at, suspended_at )
    `)
    .not("card_last4", "is", null)
    .not("card_exp_month", "is", null)
    .not("card_exp_year", "is", null) as unknown as {
      data: Array<{
        profile_id: string;
        card_last4: string;
        card_exp_month: number;
        card_exp_year: number;
        profiles: { email: string; display_name: string; deleted_at: string | null; suspended_at: string | null } | null;
      }> | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error("[card-expiry-reminders] fetch failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  for (const row of expiringCards ?? []) {
    // Skip deleted or suspended accounts.
    if (row.profiles?.deleted_at || row.profiles?.suspended_at) {
      skipped.push(row.profile_id);
      continue;
    }

    // Check if the card actually expires within the next 30 days.
    const expiry = new Date(row.card_exp_year, row.card_exp_month - 1, 1); // first of expiry month
    // Card is valid through the end of the expiry month; expires on first of next month.
    const expiresAt = new Date(expiry);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (expiresAt > thirtyDaysOut) {
      skipped.push(row.profile_id);
      continue;
    }

    const email = row.profiles?.email;
    const name = row.profiles?.display_name ?? "there";
    if (!email) { skipped.push(row.profile_id); continue; }

    const event = EMAIL_EVENTS.cardExpiringReminder;
    const billingUrl = appUrl("/profile/billing");
    const message = cardExpiringEmail({
      to: email,
      recipientName: name,
      cardLast4: row.card_last4,
      expMonth: row.card_exp_month,
      expYear: row.card_exp_year,
      billingUrl,
    });

    const result = await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${row.profile_id}:${monthKey}`,
      recipientProfileId: row.profile_id,
      message,
      template: configuredTemplateId(event) ? {
        templateId: configuredTemplateId(event),
        variables: {
          RECIPIENT_NAME: name,
          CARD_LAST4: row.card_last4,
          EXP_MONTH: String(row.card_exp_month).padStart(2, "0"),
          EXP_YEAR: String(row.card_exp_year),
          BILLING_URL: billingUrl,
        },
      } : undefined,
      payload: { profile_id: row.profile_id, card_last4: row.card_last4 },
    });

    if (result.status === "sent") sent.push(row.profile_id);
    else if (result.status === "failed") { failed.push(row.profile_id); console.error("[card-expiry-reminders] send failed:", result.error); }
    else skipped.push(row.profile_id);
  }

  return NextResponse.json({ sent: sent.length, skipped: skipped.length, failed: failed.length });
}
