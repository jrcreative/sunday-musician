import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-time login link for an Express dashboard (musician views payouts,
// updates bank info). Issued only when the connected account is fully set up.
export const POST = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: musicianProfile } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", user.id).single();
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
