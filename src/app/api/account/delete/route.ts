import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard delete the account.
//
// Refuses if the user has captured-but-not-yet-paid bookings within the
// last 7 days (deletion would orphan in-flight Stripe state). Otherwise:
//   - voids any scheduled payments
//   - detaches the Stripe customer (church) or marks Connect account
//     unusable (musician) — we don't delete Connect accounts because
//     Stripe needs them around for tax-reporting on past payouts
//   - deletes auth.users → cascades to profiles and everything else via FK
//
// The user must have re-authenticated within their current session for
// this to succeed (Supabase enforces that for sensitive ops).
export const POST = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: musicianProfile } = await admin
    .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();
  const { data: churchProfile } = await admin
    .from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle();

  const sideFilter = musicianProfile
    ? { col: "musician_profile_id" as const, id: musicianProfile.id }
    : churchProfile
      ? { col: "church_profile_id" as const, id: churchProfile.id }
      : null;

  if (sideFilter) {
    const { data: scheduled } = await admin
      .from("payments")
      .select("id")
      .eq(sideFilter.col, sideFilter.id)
      .in("status", ["scheduled", "capturing"]);
    if (scheduled && scheduled.length > 0) {
      return NextResponse.json({
        error: "You have upcoming bookings. Cancel them first, then delete your account.",
        code: "scheduled_bookings",
      }, { status: 400 });
    }
  }

  // Detach Stripe artifacts so we don't leave them orphaned. Failures here
  // are logged but don't block deletion — better to lose a Stripe link than
  // strand a user mid-deletion.
  if (churchProfile) {
    const { data: cust } = await admin
      .from("stripe_customers")
      .select("stripe_customer_id, default_payment_method")
      .eq("church_profile_id", churchProfile.id)
      .maybeSingle();
    if (cust) {
      try {
        if (cust.default_payment_method) {
          await stripe().paymentMethods.detach(cust.default_payment_method);
        }
        await stripe().customers.del(cust.stripe_customer_id);
      } catch (e) {
        console.error("[account/delete] stripe customer cleanup", e);
      }
    }
  }
  if (musicianProfile) {
    const { data: acct } = await admin
      .from("stripe_accounts")
      .select("stripe_account_id")
      .eq("musician_profile_id", musicianProfile.id)
      .maybeSingle();
    if (acct) {
      // We do NOT delete Stripe Connect accounts on user request — Stripe
      // needs them for tax reporting on past payouts. Mark our row as
      // disabled so the app stops surfacing it.
      try {
        await admin
          .from("stripe_accounts")
          .update({ charges_enabled: false, payouts_enabled: false })
          .eq("stripe_account_id", acct.stripe_account_id);
      } catch (e) {
        console.error("[account/delete] stripe account disable", e);
      }
    }
  }

  // Mark soft-deleted first (so the auth user can still own the row during
  // the cascade), then delete the auth user — which cascades profiles +
  // all dependent rows via the FK on profiles.id.
  await admin.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Sign out the current session.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
});
