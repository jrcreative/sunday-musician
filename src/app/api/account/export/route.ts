import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns a JSON file with everything the user can see about themselves.
// Privacy-friendly default: queries via the user's session (RLS-bound) so
// we only ship what they're authorized to read. Counterparty messages are
// included where they participate in the thread, mirroring what the UI
// already shows them.
export const GET = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, musicianProfile, churchProfile, prefs, bookings, threads, messages, reviews, payments, stripeAccount, stripeCustomer] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("musician_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase.from("church_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase.from("bookings").select("*"),
    supabase.from("threads").select("*"),
    supabase.from("messages").select("*"),
    supabase.from("reviews").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("stripe_accounts").select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted, created_at"),
    supabase.from("stripe_customers").select("stripe_customer_id, card_brand, card_last4, card_exp_month, card_exp_year, created_at"),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    auth_user: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    musician_profile: musicianProfile.data,
    church_profile: churchProfile.data,
    notification_preferences: prefs.data,
    bookings: bookings.data ?? [],
    threads: threads.data ?? [],
    messages: messages.data ?? [],
    reviews: reviews.data ?? [],
    payments: payments.data ?? [],
    stripe_accounts: stripeAccount.data ?? [],
    stripe_customers: stripeCustomer.data ?? [],
  };

  const filename = `sunday-musician-data-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
});
