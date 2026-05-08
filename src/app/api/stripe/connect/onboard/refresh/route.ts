import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, siteUrl } from "@/lib/stripe/server";
import { requireActiveUser } from "@/lib/api/active-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe redirects here when the AccountLink expires (it's short-lived).
// We mint a fresh link and bounce the musician back into onboarding.
export async function GET() {
  const active = await requireActiveUser();
  if (!active.ok) return NextResponse.redirect(`${siteUrl()}/auth/login`);
  if (active.user.role !== "musician") return NextResponse.redirect(`${siteUrl()}/profile`);

  const supabase = await createClient();

  const { data: musicianProfile } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", active.user.id).single();
  if (!musicianProfile) return NextResponse.redirect(`${siteUrl()}/profile`);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id")
    .eq("musician_profile_id", musicianProfile.id)
    .maybeSingle();
  if (!row) return NextResponse.redirect(`${siteUrl()}/profile`);

  const link = await stripe().accountLinks.create({
    account: row.stripe_account_id,
    refresh_url: `${siteUrl()}/api/stripe/connect/onboard/refresh`,
    return_url: `${siteUrl()}/profile?stripe=connected`,
    type: "account_onboarding",
  });
  return NextResponse.redirect(link.url);
}
