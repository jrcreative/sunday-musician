import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;

async function fetchPaged<T>(query: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>) {
  const rows: T[] = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await query(from, to);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

// Returns a JSON file with everything the user can see about themselves.
// Privacy-friendly default: queries via the user's session (RLS-bound) so
// we only ship what they're authorized to read. Counterparty messages are
// included where they participate in the thread, mirroring what the UI
// already shows them.
export const GET = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, musicianProfile, churchProfile, prefs] = await Promise.all([
    supabase.from("profiles").select("id, role, display_name, email, avatar_url, deleted_at, verified, suspended_at, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("musician_profiles").select("id, profile_id, city, state, instruments, primary_instrument, experience_notes, gear_notes, is_volunteer, fee_min, fee_max, bio, denomination_tags, rating, review_count, available, address, zip, formatted_address, address_verified_at, travel_radius_miles, youtube_links, created_at").eq("profile_id", user.id).maybeSingle(),
    supabase.from("church_profiles").select("id, profile_id, church_name, city, state, capacity, service_count, musical_style, production_level, address, zip, formatted_address, address_verified_at, contact_name, denomination, musical_approach, music_value, worship_theology, additional_worship_values, created_at").eq("profile_id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("payment_emails, activity_emails, system_emails, created_at, updated_at").eq("profile_id", user.id).maybeSingle(),
  ]);

  const musicianProfileId = musicianProfile.data?.id ?? null;
  const churchProfileId = churchProfile.data?.id ?? null;
  const bookingFilter = [
    musicianProfileId ? `musician_profile_id.eq.${musicianProfileId}` : "",
    churchProfileId ? `church_profile_id.eq.${churchProfileId}` : "",
  ].filter(Boolean).join(",");
  const threadFilter = [
    musicianProfileId ? `musician_profile_id.eq.${musicianProfileId}` : "",
    churchProfileId ? `church_profile_id.eq.${churchProfileId}` : "",
  ].filter(Boolean).join(",");

  const [bookings, threads, stripeAccount, stripeCustomer] = await Promise.all([
    bookingFilter
      ? fetchPaged(from => supabase
          .from("bookings")
          .select("id, request_id, thread_id, church_profile_id, musician_profile_id, service_date, fee, fee_type, accepted_at, cancelled_at, cancelled_by, cancel_reason, cancel_category, cancellation_policy_label, dispute_review_required, created_at")
          .or(bookingFilter)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1))
      : [],
    threadFilter
      ? fetchPaged(from => supabase
          .from("threads")
          .select("id, request_id, church_profile_id, musician_profile_id, archived_at, archive_reason, last_message_at, last_message_preview, last_message_kind, created_at, updated_at")
          .or(threadFilter)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1))
      : [],
    musicianProfileId
      ? supabase.from("stripe_accounts").select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted, created_at").eq("musician_profile_id", musicianProfileId)
      : { data: [] },
    churchProfileId
      ? supabase.from("stripe_customers").select("stripe_customer_id, card_brand, card_last4, card_exp_month, card_exp_year, created_at").eq("church_profile_id", churchProfileId)
      : { data: [] },
  ]);

  const threadIds = threads.map(t => t.id);
  const bookingIds = bookings.map(b => b.id);
  const [messages, reviewPeriods, payments] = await Promise.all([
    threadIds.length > 0
      ? fetchPaged(from => supabase
          .from("messages")
          .select("id, thread_id, sender_profile_id, kind, body, proposal, proposal_status, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1))
      : [],
    bookingIds.length > 0
      ? fetchPaged(from => supabase
          .from("review_periods")
          .select("id, booking_id, reveal_at, released_at, created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1))
      : [],
    bookingFilter
      ? fetchPaged(from => supabase
          .from("payments")
          .select("id, booking_id, church_profile_id, musician_profile_id, status, musician_amount, platform_fee, charge_total, scheduled_for, attempted_at, captured_at, failed_at, failure_message, cancelled_at, created_at, updated_at")
          .or(bookingFilter)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1))
      : [],
  ]);

  const periodIds = reviewPeriods.map(p => p.id);
  const reviews = periodIds.length > 0
    ? await fetchPaged(from => supabase
        .from("reviews")
        .select("id, period_id, reviewer_role, rating, body, submitted_at")
        .in("period_id", periodIds)
        .order("submitted_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1))
    : [];

  const payload = {
    exported_at: new Date().toISOString(),
    auth_user: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    musician_profile: musicianProfile.data,
    church_profile: churchProfile.data,
    notification_preferences: prefs.data,
    bookings,
    threads,
    messages,
    review_periods: reviewPeriods,
    reviews,
    payments,
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
