import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";
import { requireActiveUser } from "@/lib/api/active-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-time login link for an Express dashboard (musician views payouts,
// updates bank info). Issued only when the connected account is fully set up.
export const POST = withJsonErrors(async () => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "musician") {
    return NextResponse.json({ error: "Musician account required" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: musicianProfile } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", active.user.id).single();
  if (!musicianProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: acct } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id, details_submitted")
    .eq("musician_profile_id", musicianProfile.id)
    .maybeSingle();
  if (!acct || !acct.details_submitted) {
    return NextResponse.json({ error: "Finish onboarding first" }, { status: 400 });
  }

  const link = await stripe().accounts.createLoginLink(acct.stripe_account_id);
  return NextResponse.json({ url: link.url });
});
