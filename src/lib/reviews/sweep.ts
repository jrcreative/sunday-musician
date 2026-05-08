import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailMessage } from "@/lib/email/send";
import { sendEmail as defaultSendEmail } from "@/lib/email/send";
import {
  reviewPromptEmail,
  reviewReminderEmail,
  reviewReleasedEmail,
} from "@/lib/email/templates/reviews";

type ReviewRole = "musician" | "church";

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
  reviews: { reviewer_role: ReviewRole }[];
};

export type ReviewSweepSummary = {
  prompted: number;
  reminded: number;
  released: number;
  releaseEmailed: number;
  errors: number;
  promptsDue: number;
  remindersDue: number;
  releasesDue: number;
  releaseEmailsDue: number;
};

export async function sweepReviews({
  supabase,
  siteUrl,
  now = new Date(),
  write = true,
  sendEmails = true,
  periodId,
  sendEmail = defaultSendEmail,
}: {
  supabase: SupabaseClient<Database>;
  siteUrl: string;
  now?: Date;
  write?: boolean;
  sendEmails?: boolean;
  periodId?: string;
  sendEmail?: (message: EmailMessage) => Promise<unknown>;
}): Promise<ReviewSweepSummary> {
  const summary: ReviewSweepSummary = {
    prompted: 0,
    reminded: 0,
    released: 0,
    releaseEmailed: 0,
    errors: 0,
    promptsDue: 0,
    remindersDue: 0,
    releasesDue: 0,
    releaseEmailsDue: 0,
  };

  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  let releaseQuery = supabase
    .from("review_periods")
    .select("id")
    .is("released_at", null)
    .lt("reveal_at", nowIso);
  if (periodId) releaseQuery = releaseQuery.eq("id", periodId);
  const { data: toRelease } = await releaseQuery;

  if (toRelease && toRelease.length > 0) {
    const ids = toRelease.map(r => r.id);
    const { data: hasReviews } = await supabase
      .from("reviews")
      .select("period_id")
      .in("period_id", ids);
    const releasableIds = Array.from(new Set((hasReviews ?? []).map(r => r.period_id)));
    summary.releasesDue = releasableIds.length;
    if (write && releasableIds.length > 0) {
      await supabase
        .from("review_periods")
        .update({ released_at: nowIso })
        .in("id", releasableIds);
      summary.released = releasableIds.length;
    }
  }

  let periodsQuery = supabase
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
  if (periodId) periodsQuery = periodsQuery.eq("id", periodId);
  const { data: periodsRaw } = await periodsQuery;
  const periods = (periodsRaw ?? []) as unknown as PeriodRow[];

  const today = nowIso.slice(0, 10);
  const reviewUrlFor = (id: string) => `${siteUrl}/reviews/${id}`;

  async function maybeSend(message: EmailMessage, update: Record<string, string>, period: string, bucket: "prompted" | "reminded" | "releaseEmailed") {
    if (!sendEmails) return;
    try {
      await sendEmail(message);
      if (write) await supabase.from("review_periods").update(update as never).eq("id", period);
      summary[bucket]++;
    } catch {
      summary.errors++;
    }
  }

  for (const p of periods) {
    const { bookings: b } = p;
    const musicianName = b.musician_profiles.profiles.display_name;
    const churchName = b.church_profiles.church_name;
    const musicianEmail = b.musician_profiles.profiles.email;
    const churchEmail = b.church_profiles.profiles.email;
    const submittedRoles = new Set(p.reviews.map(r => r.reviewer_role));
    const serviceCompleted = b.service_date <= today;
    const revealMs = new Date(p.reveal_at).getTime();
    const inFinalStretch = !p.released_at && revealMs - nowMs < 3 * 24 * 60 * 60 * 1000;

    if (serviceCompleted && !p.released_at) {
      if (!p.prompt_musician_at && !submittedRoles.has("musician")) {
        summary.promptsDue++;
        await maybeSend(reviewPromptEmail({
          to: musicianEmail,
          recipientName: musicianName,
          counterpartyName: churchName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
        }), { prompt_musician_at: nowIso }, p.id, "prompted");
      }
      if (!p.prompt_church_at && !submittedRoles.has("church")) {
        summary.promptsDue++;
        await maybeSend(reviewPromptEmail({
          to: churchEmail,
          recipientName: b.church_profiles.profiles.display_name,
          counterpartyName: musicianName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
        }), { prompt_church_at: nowIso }, p.id, "prompted");
      }
    }

    if (inFinalStretch) {
      const daysRemaining = Math.max(1, Math.ceil((revealMs - nowMs) / (24 * 60 * 60 * 1000)));
      if (!p.reminder_musician_at && !submittedRoles.has("musician")) {
        summary.remindersDue++;
        await maybeSend(reviewReminderEmail({
          to: musicianEmail,
          recipientName: musicianName,
          counterpartyName: churchName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
          daysRemaining,
        }), { reminder_musician_at: nowIso }, p.id, "reminded");
      }
      if (!p.reminder_church_at && !submittedRoles.has("church")) {
        summary.remindersDue++;
        await maybeSend(reviewReminderEmail({
          to: churchEmail,
          recipientName: b.church_profiles.profiles.display_name,
          counterpartyName: musicianName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
          daysRemaining,
        }), { reminder_church_at: nowIso }, p.id, "reminded");
      }
    }

    if (p.released_at) {
      if (!p.released_email_musician_at) {
        summary.releaseEmailsDue++;
        await maybeSend(reviewReleasedEmail({
          to: musicianEmail,
          recipientName: musicianName,
          counterpartyName: churchName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
        }), { released_email_musician_at: nowIso }, p.id, "releaseEmailed");
      }
      if (!p.released_email_church_at) {
        summary.releaseEmailsDue++;
        await maybeSend(reviewReleasedEmail({
          to: churchEmail,
          recipientName: b.church_profiles.profiles.display_name,
          counterpartyName: musicianName,
          serviceDate: b.service_date,
          reviewUrl: reviewUrlFor(p.id),
        }), { released_email_church_at: nowIso }, p.id, "releaseEmailed");
      }
    }
  }

  return summary;
}
