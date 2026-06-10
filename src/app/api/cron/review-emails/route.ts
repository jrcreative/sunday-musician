import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailMessage } from "@/lib/email/send";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import {
  reviewPromptEmail,
  reviewReminderEmail,
  reviewReleasedEmail,
} from "@/lib/email/templates/reviews";

// Daily sweep for review-related emails. Runs every cron tick (the queries
// are idempotent via the *_at tracking columns).
//
// Three jobs, each independent:
//   1. PROMPT — service is in the past, no prompt email sent yet, side hasn't submitted
//   2. REMINDER — within 2 days of reveal, no reminder sent, side hasn't submitted
//   3. RELEASE — reveal_at has passed and period not released → release it (single-side
//      reveal); also email both sides for any newly-released period that hasn't been
//      emailed about yet.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function deliverReviewEmail(input: {
  event: typeof EMAIL_EVENTS.reviewPrompt | typeof EMAIL_EVENTS.reviewReminder | typeof EMAIL_EVENTS.reviewReleased;
  periodId: string;
  role: "musician" | "church";
  recipientProfileId: string;
  message: EmailMessage;
  variables: Record<string, string | number>;
  payload?: Record<string, string | number>;
}) {
  const result = await sendTransactionalEmail({
    eventKey: input.event.key,
    category: input.event.category,
    dedupeKey: `${input.event.key}:${input.periodId}:${input.role}`,
    recipientProfileId: input.recipientProfileId,
    message: input.message,
    template: configuredTemplateId(input.event) ? {
      templateId: configuredTemplateId(input.event),
      variables: input.variables,
    } : undefined,
    payload: {
      period_id: input.periodId,
      reviewer_role: input.role,
      ...(input.payload ?? {}),
    },
  });
  return result.status === "sent" || result.status === "skipped";
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.SITE_URL ?? process.env.URL ?? "";
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }
  if (!siteUrl) {
    return NextResponse.json({ error: "SITE_URL/URL not configured" }, { status: 500 });
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = { prompted: 0, reminded: 0, released: 0, releaseEmailed: 0, errors: 0 };

  // ── 1. RELEASE expired periods (single-side reveal). Do this first so the
  //       release-emails block below can pick them up immediately.
  const nowIso = new Date().toISOString();
  const { data: toRelease } = await supabase
    .from("review_periods")
    .select("id")
    .is("released_at", null)
    .lt("reveal_at", nowIso);

  if (toRelease && toRelease.length > 0) {
    const ids = toRelease.map(r => r.id);
    // Only release if at least one review exists (else there's nothing to reveal).
    const { data: hasReviews } = await supabase
      .from("reviews")
      .select("period_id")
      .in("period_id", ids);
    const releasableIds = Array.from(new Set((hasReviews ?? []).map(r => r.period_id)));
    if (releasableIds.length > 0) {
      await supabase
        .from("review_periods")
        .update({ released_at: nowIso })
        .in("id", releasableIds);
      summary.released = releasableIds.length;
    }
  }

  // Fetch periods + booking + counterparty + recipient emails for all email jobs.
  // Done as one query to avoid N+1; we filter in code per job.
  const { data: periodsRaw } = await supabase
    .from("review_periods")
    .select(`
      id, reveal_at, released_at,
      prompt_musician_at, prompt_church_at,
      reminder_musician_at, reminder_church_at,
      released_email_musician_at, released_email_church_at,
      bookings!inner (
        service_date,
        musician_profile_id, church_profile_id,
        musician_profiles!inner ( profile_id, profiles!inner ( email, display_name ) ),
        church_profiles!inner ( profile_id, church_name, profiles!inner ( email, display_name ) )
      ),
      reviews ( reviewer_role )
    `);

  type PeriodRow = {
    id: string;
    reveal_at: string;
    released_at: string | null;
    prompt_musician_at: string | null;
    prompt_church_at: string | null;
    reminder_musician_at: string | null;
    reminder_church_at: string | null;
    released_email_musician_at: string | null;
    released_email_church_at: string | null;
    bookings: {
      service_date: string;
      musician_profile_id: string;
      church_profile_id: string;
      musician_profiles: {
        profile_id: string;
        profiles: { email: string; display_name: string };
      };
      church_profiles: {
        profile_id: string;
        church_name: string;
        profiles: { email: string; display_name: string };
      };
    };
    reviews: { reviewer_role: "musician" | "church" }[];
  };
  const periods = (periodsRaw ?? []) as unknown as PeriodRow[];

  const today = nowIso.slice(0, 10);
  const reviewUrlFor = (id: string) => `${siteUrl}/reviews/${id}`;

  for (const p of periods) {
    const { bookings: b } = p;
    const musicianName = b.musician_profiles.profiles.display_name;
    const churchName = b.church_profiles.church_name;
    const musicianEmail = b.musician_profiles.profiles.email;
    const churchEmail = b.church_profiles.profiles.email;
    const submittedRoles = new Set(p.reviews.map(r => r.reviewer_role));
    const serviceCompleted = b.service_date <= today;
    const inFinalStretch = !p.released_at && new Date(p.reveal_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

    // 1. PROMPT — day after service, side hasn't submitted, prompt not sent yet.
    if (serviceCompleted && !p.released_at) {
      if (!p.prompt_musician_at && !submittedRoles.has("musician")) {
        try {
          const event = EMAIL_EVENTS.reviewPrompt;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "musician",
            recipientProfileId: b.musician_profiles.profile_id,
            message: reviewPromptEmail({
            to: musicianEmail,
            recipientName: musicianName,
            counterpartyName: churchName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            }),
            variables: {
              RECIPIENT_NAME: musicianName,
              COUNTERPARTY_NAME: churchName,
              SERVICE_DATE: b.service_date,
              REVIEW_URL: reviewUrlFor(p.id),
            },
          });
          if (ok) {
            await supabase.from("review_periods").update({ prompt_musician_at: nowIso }).eq("id", p.id);
            summary.prompted++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
      if (!p.prompt_church_at && !submittedRoles.has("church")) {
        try {
          const event = EMAIL_EVENTS.reviewPrompt;
          const churchRecipientName = b.church_profiles.profiles.display_name;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "church",
            recipientProfileId: b.church_profiles.profile_id,
            message: reviewPromptEmail({
            to: churchEmail,
            recipientName: churchRecipientName,
            counterpartyName: musicianName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            }),
            variables: {
              RECIPIENT_NAME: churchRecipientName,
              COUNTERPARTY_NAME: musicianName,
              SERVICE_DATE: b.service_date,
              REVIEW_URL: reviewUrlFor(p.id),
            },
          });
          if (ok) {
            await supabase.from("review_periods").update({ prompt_church_at: nowIso }).eq("id", p.id);
            summary.prompted++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
    }

    // 2. REMINDER — final stretch, no reminder yet, side hasn't submitted.
    if (inFinalStretch) {
      const daysRemaining = Math.max(1, Math.ceil((new Date(p.reveal_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      if (!p.reminder_musician_at && !submittedRoles.has("musician")) {
        try {
          const event = EMAIL_EVENTS.reviewReminder;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "musician",
            recipientProfileId: b.musician_profiles.profile_id,
            message: reviewReminderEmail({
            to: musicianEmail,
            recipientName: musicianName,
            counterpartyName: churchName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            daysRemaining,
            }),
            variables: {
              RECIPIENT_NAME: musicianName,
              COUNTERPARTY_NAME: churchName,
              SERVICE_DATE: b.service_date,
              DAYS_REMAINING: daysRemaining,
              REVIEW_URL: reviewUrlFor(p.id),
            },
            payload: { days_remaining: daysRemaining },
          });
          if (ok) {
            await supabase.from("review_periods").update({ reminder_musician_at: nowIso }).eq("id", p.id);
            summary.reminded++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
      if (!p.reminder_church_at && !submittedRoles.has("church")) {
        try {
          const event = EMAIL_EVENTS.reviewReminder;
          const churchRecipientName = b.church_profiles.profiles.display_name;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "church",
            recipientProfileId: b.church_profiles.profile_id,
            message: reviewReminderEmail({
            to: churchEmail,
            recipientName: churchRecipientName,
            counterpartyName: musicianName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            daysRemaining,
            }),
            variables: {
              RECIPIENT_NAME: churchRecipientName,
              COUNTERPARTY_NAME: musicianName,
              SERVICE_DATE: b.service_date,
              DAYS_REMAINING: daysRemaining,
              REVIEW_URL: reviewUrlFor(p.id),
            },
            payload: { days_remaining: daysRemaining },
          });
          if (ok) {
            await supabase.from("review_periods").update({ reminder_church_at: nowIso }).eq("id", p.id);
            summary.reminded++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
    }

    // 3. RELEASE EMAIL — period released, side hasn't been notified.
    if (p.released_at) {
      if (!p.released_email_musician_at) {
        try {
          const event = EMAIL_EVENTS.reviewReleased;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "musician",
            recipientProfileId: b.musician_profiles.profile_id,
            message: reviewReleasedEmail({
            to: musicianEmail,
            recipientName: musicianName,
            counterpartyName: churchName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            }),
            variables: {
              RECIPIENT_NAME: musicianName,
              COUNTERPARTY_NAME: churchName,
              SERVICE_DATE: b.service_date,
              REVIEW_URL: reviewUrlFor(p.id),
            },
          });
          if (ok) {
            await supabase.from("review_periods").update({ released_email_musician_at: nowIso }).eq("id", p.id);
            summary.releaseEmailed++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
      if (!p.released_email_church_at) {
        try {
          const event = EMAIL_EVENTS.reviewReleased;
          const churchRecipientName = b.church_profiles.profiles.display_name;
          const ok = await deliverReviewEmail({
            event,
            periodId: p.id,
            role: "church",
            recipientProfileId: b.church_profiles.profile_id,
            message: reviewReleasedEmail({
            to: churchEmail,
            recipientName: churchRecipientName,
            counterpartyName: musicianName,
            serviceDate: b.service_date,
            reviewUrl: reviewUrlFor(p.id),
            }),
            variables: {
              RECIPIENT_NAME: churchRecipientName,
              COUNTERPARTY_NAME: musicianName,
              SERVICE_DATE: b.service_date,
              REVIEW_URL: reviewUrlFor(p.id),
            },
          });
          if (ok) {
            await supabase.from("review_periods").update({ released_email_church_at: nowIso }).eq("id", p.id);
            summary.releaseEmailed++;
          } else summary.errors++;
        } catch { summary.errors++; }
      }
    }
  }

  return NextResponse.json(summary);
}
