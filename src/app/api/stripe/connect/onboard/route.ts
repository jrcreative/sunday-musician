import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, siteUrl } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";
import { requireActiveUser } from "@/lib/api/active-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Creates (or reuses) a Stripe Connect Express account for the current
// musician and returns a fresh AccountLink URL for hosted onboarding.
export const POST = withJsonErrors(async () => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "musician") {
    return NextResponse.json({ error: "Musician account required" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles").select("id, role, email, display_name").eq("id", active.user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: musicianProfile } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", active.user.id).single();
  if (!musicianProfile) {
    return NextResponse.json({ error: "Complete your musician profile first" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id")
    .eq("musician_profile_id", musicianProfile.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: "US",
      email: profile.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        musician_profile_id: musicianProfile.id,
        sm_user_id: active.user.id,
      },
    });
    accountId = account.id;
    const { error: insertErr } = await admin.from("stripe_accounts").insert({
      musician_profile_id: musicianProfile.id,
      stripe_account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl()}/api/stripe/connect/onboard/refresh`,
    return_url: `${siteUrl()}/profile?stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
});
