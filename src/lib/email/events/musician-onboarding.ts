import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { musicianOnboardingEmail } from "@/lib/email/templates/onboarding";

function appUrl(path: string) {
  const base = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function sendMusicianOnboardingEmail(profileId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, email, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.role !== "musician") {
    return { status: "skipped" as const, reason: "not_musician" as const };
  }

  const event = EMAIL_EVENTS.musicianOnboarding;
  const templateId = configuredTemplateId(event);
  const profileUrl = appUrl("/profile");
  const dashboardUrl = appUrl("/dashboard");
  const payoutsUrl = appUrl("/profile/payouts");
  const message = musicianOnboardingEmail({
    to: profile.email,
    musicianName: profile.display_name,
    profileUrl,
    dashboardUrl,
    payoutsUrl,
  });

  return sendTransactionalEmail({
    eventKey: event.key,
    category: event.category,
    dedupeKey: `${event.key}:${profile.id}`,
    recipientProfileId: profile.id,
    message,
    template: templateId ? {
      templateId,
      variables: {
        MUSICIAN_NAME: profile.display_name,
        PROFILE_URL: profileUrl,
        DASHBOARD_URL: dashboardUrl,
        PAYOUTS_URL: payoutsUrl,
      },
    } : undefined,
    payload: {
      template_name: event.suggestedTemplateName,
      profile_id: profile.id,
    },
  });
}
