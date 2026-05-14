import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/shell/Topbar";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileCompleteness } from "../profile/ProfileCompleteness";
import { musicianCompleteness } from "../profile/completeness";
import {
  BOOKING_STATUS_CHIP,
  BOOKING_STATUS_LABEL,
  REQUEST_STATUS_CHIP,
  REQUEST_STATUS_LABEL,
  bookingDisplayStatus,
  requestDisplayStatus,
} from "@/lib/requests/status";
import { matchingInstruments, uniqueInstruments } from "@/lib/instruments";
import { scoreServiceReadiness } from "@/lib/matches/readiness";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function bookingDateTime(serviceDate: string | null) {
  return serviceDate ? new Date(serviceDate + "T12:00:00").getTime() : Number.POSITIVE_INFINITY;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const isChurch = profile?.role === "church";
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";

  // ── Church dashboard ─────────────────────────────────────────────────────
  if (isChurch) {
    const { data: churchProfile } = await supabase
      .from("church_profiles").select("*").eq("profile_id", user.id).single();

    const { data: requests } = churchProfile
      ? await supabase.from("service_requests").select("*").eq("church_profile_id", churchProfile.id).order("service_date").limit(5)
      : { data: [] };

    const today = new Date().toISOString().slice(0, 10);
    const decoratedRequests = (requests ?? []).map(r => ({
      ...r,
      _display: requestDisplayStatus(r.status, r.service_date, today),
    }));
    const openCount = decoratedRequests.filter(r => r._display === "open").length;
    const filledCount = decoratedRequests.filter(r => r._display === "filled").length;

    // Card-on-file expiry warning. We surface this on the dashboard (not
    // just /profile/billing) because a missed expiry would silently fail
    // the next event-day capture.
    const { data: stripeCustomer } = churchProfile
      ? await supabase
          .from("stripe_customers")
          .select("card_exp_month, card_exp_year, default_payment_method")
          .eq("church_profile_id", churchProfile.id)
          .maybeSingle()
      : { data: null };
    const cardExpiringSoon = (() => {
      if (!stripeCustomer?.default_payment_method || !stripeCustomer.card_exp_month || !stripeCustomer.card_exp_year) return false;
      const expiry = new Date(stripeCustomer.card_exp_year, stripeCustomer.card_exp_month, 1);
      // eslint-disable-next-line react-hooks/purity -- server component, each request is its own render
      const days = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    })();

    return (
      <>
        <Topbar
          title="Dashboard"
          right={<Link href="/requests/new" className="btn btn--primary btn--sm">+ New request</Link>}
        />
        <div className="page page--wide">
          {cardExpiringSoon && (
            <Link
              href="/profile/billing"
              style={{
                display: "block",
                padding: "12px 16px", marginBottom: 20,
                border: "1px solid rgba(184,33,5,0.3)",
                background: "rgba(184,33,5,0.06)",
                borderRadius: "var(--sm-radius-sm)",
                color: "var(--sm-status-error, #b82105)",
                fontSize: 13.5, lineHeight: 1.5,
                textDecoration: "none",
              }}
            >
              <strong>Your card expires soon.</strong> Update it to keep upcoming bookings from failing →
            </Link>
          )}

          <div style={{ marginBottom: 28 }}>
            <div className="sm-eyebrow" style={{ marginBottom: 8 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
              {greeting()}, {firstName}.
            </h2>
            <p style={{ color: "var(--sm-fg-3)", fontSize: 17, margin: 0 }}>
              {openCount > 0 ? `You have ${openCount} open ${openCount === 1 ? "request" : "requests"}.` : "No open requests right now."}
            </p>
          </div>

          <div>
            <div className="sm-row-3" style={{ marginBottom: 32 }}>
                {[
                  { label: "Open requests", val: openCount, sub: "awaiting reply" },
                  { label: "Filled", val: filledCount, sub: "this month" },
                  { label: "Total requests", val: decoratedRequests.length, sub: "all time" },
                ].map(s => (
                  <div key={s.label} style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22 }}>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginTop: 8 }}>{s.val}</div>
                    <div style={{ fontSize: 13, color: "var(--sm-fg-3)", marginTop: 6 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>
                Active requests
              </div>

              {decoratedRequests.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {decoratedRequests
                    .filter(r => r._display === "open")
                    .slice(0, 3)
                    .map(r => (
                    <Link key={r.id} href={`/requests/${r.id}`} style={{ textDecoration: "none" }}>
                      <div className="sm-list-card" style={{ padding: "22px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                        <div className="sm-list-card__date" style={{ textAlign: "center", paddingRight: 22, borderRight: "1px solid var(--sm-border-subtle)", minWidth: 78 }}>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                            {new Date(r.service_date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                          </div>
                          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 2 }}>
                            {new Date(r.service_date + "T12:00:00").getDate()}
                          </div>
                        </div>
                        <div className="sm-list-card__main">
                          <div style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "var(--sm-fg-1)" }}>{r.title}</div>
                          <div style={{ fontSize: 13.5, color: "var(--sm-fg-3)" }}>
                            {r.service_type}{r.offered_fee != null ? ` · $${r.offered_fee} offered` : ""}
                          </div>
                        </div>
                        <span className={REQUEST_STATUS_CHIP[r._display]}>{REQUEST_STATUS_LABEL[r._display]}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
                  <p style={{ margin: "0 0 16px" }}>No requests yet. Post your first one to find a musician.</p>
                  <Link href="/requests/new" className="btn btn--primary">Post a request</Link>
                </div>
              )}
            </div>
          </div>
      </>
    );
  }

  // ── Musician dashboard ────────────────────────────────────────────────────
  const { data: mp, error: mpError } = await supabase
    .from("musician_profiles")
    .select("id, instruments, city, state, lat, lng, bio, primary_instrument, fee_min, fee_max, is_volunteer, travel_radius_miles, denomination_tags, experience_notes, gear_notes, available, rating, review_count, profiles(display_name)")
    .eq("profile_id", user.id)
    .maybeSingle() as unknown as {
      data: {
        id: string;
        instruments: string[];
        city: string;
        state: string;
        lat: number | null;
        lng: number | null;
        bio: string;
        primary_instrument: string;
        fee_min: number;
        fee_max: number;
        is_volunteer: boolean;
        travel_radius_miles: number;
        denomination_tags: string[];
        experience_notes: string;
        gear_notes: string;
        available: boolean;
        rating: number;
        review_count: number;
        profiles: { display_name: string } | null;
      } | null;
      error: { message: string } | null;
    };
  if (mpError) console.error("[dashboard] musician_profiles fetch failed:", mpError.message);

  const today = new Date().toISOString().split("T")[0];
  const myInstruments = uniqueInstruments([
    ...(mp?.instruments ?? []),
    mp?.primary_instrument ?? "",
  ]);

  const { data: stripeAccount } = mp
    ? await supabase
        .from("stripe_accounts")
        .select("charges_enabled, payouts_enabled, details_submitted")
        .eq("musician_profile_id", mp.id)
        .maybeSingle() as unknown as {
          data: { charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean } | null;
        }
    : { data: null };

  type ConversationThreadRow = {
    id: string;
    request_id: string;
    archived_at: string | null;
    last_message_at: string | null;
    updated_at: string;
    service_requests: { title: string; service_type: string; service_date: string; status: string } | null;
    church_profiles: { church_name: string } | null;
  };

  let conversationThreads: ConversationThreadRow[] = [];
  const conversationRequestIds = new Set<string>();

  if (mp) {
    const { data: threadRows } = await supabase
      .from("threads")
      .select(`
        id, request_id, archived_at, last_message_at, updated_at,
        service_requests ( title, service_type, service_date, status ),
        church_profiles ( church_name )
      `)
      .eq("musician_profile_id", mp.id) as unknown as { data: ConversationThreadRow[] | null };

    conversationThreads = threadRows ?? [];
    for (const thread of conversationThreads) {
      if (thread.request_id) conversationRequestIds.add(thread.request_id);
    }
  }

  type OpenRequestRow = {
    id: string; title: string; service_type: string; service_date: string;
    service_time: string | null; offered_fee: number | null; fee_type: string; instruments_needed: string[];
    rehearsals: string; notes: string | null; tech_setup: string[]; setlist_url: string | null;
    church_profile_id: string;
    use_church_location: boolean;
    location_lat: number | null; location_lng: number | null; location_state: string | null; location_verified_at: string | null;
    church_profiles: {
      church_name: string; city: string; state: string;
      lat: number | null; lng: number | null; address_verified_at: string | null; musical_style: string | null;
    } | null;
  };

  const { data: rawRequests } = await supabase
    .from("service_requests")
    .select("id, title, service_type, service_date, service_time, offered_fee, fee_type, instruments_needed, rehearsals, notes, tech_setup, setlist_url, church_profile_id, use_church_location, location_lat, location_lng, location_state, location_verified_at, church_profiles(church_name, city, state, lat, lng, address_verified_at, musical_style)")
    .eq("status", "open")
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(50) as unknown as { data: OpenRequestRow[] | null };

  const { data: blocks } = mp
    ? await supabase
        .from("unavailability_blocks")
        .select("start_date, end_date")
        .eq("musician_profile_id", mp.id)
        .gte("end_date", today)
    : { data: [] as { start_date: string; end_date: string }[] };
  const blockedRanges = blocks ?? [];
  const isBlocked = (date: string) => blockedRanges.some(b => date >= b.start_date && date <= b.end_date);
  const paymentReady = !!stripeAccount?.charges_enabled && !!stripeAccount?.payouts_enabled && !!stripeAccount?.details_submitted;

  const openRequests = (rawRequests ?? [])
    .filter(r => !conversationRequestIds.has(r.id))
    .filter(r => !isBlocked(r.service_date))
    .map(r => {
      const serviceState = r.use_church_location
        ? r.church_profiles?.state ?? null
        : r.location_state;
      const serviceLat = r.use_church_location ? r.church_profiles?.lat ?? null : r.location_lat;
      const serviceLng = r.use_church_location ? r.church_profiles?.lng ?? null : r.location_lng;
      const matchedInstrs = matchingInstruments(r.instruments_needed, myInstruments, mp?.primary_instrument ?? "");
      const readiness = scoreServiceReadiness({
        title: r.title,
        serviceType: r.service_type,
        serviceStyle: r.church_profiles?.musical_style,
        serviceDate: r.service_date,
        serviceTime: r.service_time,
        useChurchLocation: r.use_church_location,
        churchLocationVerified: !!r.church_profiles?.address_verified_at,
        locationVerified: !!r.location_verified_at,
        instrumentsNeeded: r.instruments_needed,
        rehearsals: r.rehearsals,
        techSetup: r.tech_setup ?? [],
        offeredFee: r.offered_fee,
        feeType: r.fee_type,
        setlistUrl: r.setlist_url,
        notes: r.notes,
        serviceCoords: { lat: serviceLat, lng: serviceLng },
        serviceState,
      }, {
        displayName: mp?.profiles?.display_name ?? firstName,
        available: mp?.available,
        instruments: mp?.instruments ?? [],
        primaryInstrument: mp?.primary_instrument ?? "",
        city: mp?.city,
        state: mp?.state,
        lat: mp?.lat,
        lng: mp?.lng,
        travelRadiusMiles: mp?.travel_radius_miles,
        bio: mp?.bio,
        denominationTags: mp?.denomination_tags ?? [],
        experienceNotes: mp?.experience_notes,
        gearNotes: mp?.gear_notes,
        isVolunteer: mp?.is_volunteer,
        feeMin: mp?.fee_min,
        feeMax: mp?.fee_max,
        rating: mp?.rating,
        reviewCount: mp?.review_count,
        paymentReady,
      });

      return { ...r, matchedInstrs, readiness };
    })
    .filter(r =>
      myInstruments.length > 0 &&
      (r.instruments_needed.length === 0 || r.matchedInstrs.length > 0)
    )
    .sort((a, b) =>
      b.readiness.percent - a.readiness.percent ||
      a.service_date.localeCompare(b.service_date) ||
      a.title.localeCompare(b.title)
    )
    .slice(0, 5);

  // Bookings — read from the bookings table so cancelled rows are tracked
  // properly. Stats reflect live (non-cancelled) bookings only; the visible
  // list shows cancelled too so the musician sees what changed.
  type DashboardBooking = {
    bookingId: string;
    threadId: string;
    churchName: string;
    title: string;
    serviceDate: string | null;
    fee: number | null;
    feeType: string;
    acceptedAt: string;
    cancelledAt: string | null;
    cancellationPolicyLabel: string | null;
    disputeReviewRequired: boolean;
  };
  type BookingRow = {
    id: string;
    thread_id: string;
    service_date: string | null;
    fee: number | null;
    fee_type: string | null;
    accepted_at: string;
    cancelled_at: string | null;
    cancellation_policy_label: string | null;
    dispute_review_required: boolean | null;
    church_profiles: { church_name: string } | null;
    service_requests: { title: string } | null;
  };

  let allBookings: DashboardBooking[] = [];

  if (mp) {
    const admin = createAdminClient();
    const { data: rows, error: bookingsError } = await admin
      .from("bookings")
      .select(`
        id, thread_id, service_date, fee, fee_type, accepted_at, cancelled_at, cancellation_policy_label, dispute_review_required,
        church_profiles ( church_name ),
        service_requests ( title )
      `)
      .eq("musician_profile_id", mp.id)
      .order("service_date", { ascending: false, nullsFirst: false }) as unknown as { data: BookingRow[] | null; error: { message: string } | null };
    if (bookingsError) console.error("[dashboard] bookings fetch failed:", bookingsError.message);

    allBookings = (rows ?? []).map(r => ({
      bookingId: r.id,
      threadId: r.thread_id,
      churchName: r.church_profiles?.church_name ?? "Church",
      title: r.service_requests?.title ?? "Service",
      serviceDate: r.service_date,
      fee: r.fee,
      feeType: r.fee_type ?? "per service",
      acceptedAt: r.accepted_at,
      cancelledAt: r.cancelled_at,
      cancellationPolicyLabel: r.cancellation_policy_label,
      disputeReviewRequired: r.dispute_review_required === true,
    }));
  }

  const now = new Date().getTime();
  // Only show accepted (non-cancelled) bookings; sort upcoming ones first (nearest date at top),
  // then past completed ones (most recent past first).
  const dashboardBookings = [...allBookings]
    .filter(b => !b.cancelledAt)
    .sort((a, b) => {
      const aTime = bookingDateTime(a.serviceDate);
      const bTime = bookingDateTime(b.serviceDate);
      const aUpcoming = aTime >= now;
      const bUpcoming = bTime >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming && bUpcoming) return aTime - bTime;
      return bTime - aTime;
    });

  // Conversations in progress are request threads with no terminal proposal
  // outcome and no booking. A thread with no proposal yet still counts as a
  // started conversation, so it should leave "Open requests for you".
  let activeConversations: ConversationThreadRow[] = [];

  if (mp) {
    const bookedThreadIds = new Set(allBookings.map(b => b.threadId));
    const candidateThreadIds = conversationThreads
      .filter(t => !t.archived_at)
      .filter(t => !bookedThreadIds.has(t.id))
      .filter(t => ["open", "in_progress"].includes(t.service_requests?.status ?? ""))
      .map(t => t.id);

    const latestProposalByThreadId = new Map<string, string | null>();

    if (candidateThreadIds.length > 0) {
      const { data: proposalRows } = await supabase
        .from("messages")
        .select("thread_id, proposal_status, created_at")
        .in("thread_id", candidateThreadIds)
        .eq("kind", "proposal")
        .order("created_at", { ascending: true }) as unknown as {
          data: { thread_id: string; proposal_status: string | null; created_at: string }[] | null;
        };

      for (const proposal of proposalRows ?? []) {
        latestProposalByThreadId.set(proposal.thread_id, proposal.proposal_status);
      }

      const resolvedProposalStatuses = new Set(["accepted", "declined"]);
      activeConversations = conversationThreads
        .filter(t => candidateThreadIds.includes(t.id))
        .filter(t => !resolvedProposalStatuses.has(latestProposalByThreadId.get(t.id) ?? ""))
        .sort((a, b) =>
          new Date(b.last_message_at ?? b.updated_at).getTime() -
          new Date(a.last_message_at ?? a.updated_at).getTime()
        )
        .slice(0, 5);
    }
  }

  const liveBookings = allBookings.filter(b => !b.cancelledAt);
  const totalEarned = liveBookings.reduce((s, b) => s + (b.fee ?? 0), 0);
  const upcomingCount = liveBookings.filter(b => b.serviceDate && new Date(b.serviceDate + "T12:00:00") >= new Date()).length;
  const profileCompleteness = musicianCompleteness(mp);

  const stats = [
    { label: "Confirmed bookings", value: liveBookings.length.toString(), sub: "all time" },
    { label: "Total earned", value: totalEarned > 0 ? `$${totalEarned.toLocaleString()}` : "—", sub: "from agreements" },
    { label: "Upcoming", value: upcomingCount.toString(), sub: upcomingCount === 1 ? "service booked" : "services booked" },
  ];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="page">

        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-4)", marginBottom: 6 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
            {greeting()}, {firstName}.
          </h2>
          <p style={{ color: "var(--sm-fg-3)", fontSize: 16, margin: 0 }}>
            {openRequests.length > 0
              ? `${openRequests.length} open ${openRequests.length === 1 ? "request matches" : "requests match"} your instruments.`
              : "No new requests matching your instruments right now."}
          </p>
        </div>

        {profileCompleteness.percent < 100 && (
          <ProfileCompleteness
            percent={profileCompleteness.percent}
            missing={profileCompleteness.missing}
            previewHref="/profile"
            previewLabel="Complete your profile"
            openInNewTab={false}
          />
        )}

        {/* Stats */}
        <div className="sm-row-3" style={{ marginBottom: 40 }}>
          {stats.map(s => (
            <div key={s.label} style={{ padding: "20px 22px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "var(--sm-fg-1)", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* My bookings — shown first so musicians never miss an upcoming gig */}
        <Section
          label="My bookings"
          viewAllHref="/requests"
          viewAllLabel="View all bookings"
          empty={dashboardBookings.length === 0}
          emptyMessage="When you accept a church's terms, your confirmed bookings will appear here."
          emptyAction={{ href: "/open-requests", label: "Browse open requests" }}
        >
          {dashboardBookings.map((b, idx) => {
            const d = b.serviceDate ? new Date(b.serviceDate + "T12:00:00") : null;
            const status = bookingDisplayStatus(b.serviceDate, b.cancelledAt);
            const isNext = idx === 0 && status === "upcoming";
            const dim = status !== "upcoming";
            return (
              <Link key={b.bookingId} href={`/messages/${b.threadId}`} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 18, alignItems: "center",
                  padding: "16px 20px", marginBottom: 8, opacity: dim ? 0.7 : 1,
                  border: isNext ? "2px solid var(--sm-accent)" : "1px solid var(--sm-border-subtle)",
                  borderRadius: "var(--sm-radius-sm)",
                  background: isNext ? "color-mix(in srgb, var(--sm-accent) 6%, var(--sm-bg-1))" : "var(--sm-bg-1)",
                }}>
                  <div style={{ textAlign: "center", paddingRight: 18, borderRight: `1px solid ${isNext ? "color-mix(in srgb, var(--sm-accent) 30%, var(--sm-border-subtle))" : "var(--sm-border-subtle)"}` }}>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: dim ? "var(--sm-fg-4)" : "var(--sm-accent)", fontWeight: 700 }}>
                          {d.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 10.5, color: "var(--sm-fg-3)", marginTop: 1 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--sm-fg-4)" }}>TBD</div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)" }}>{b.title}</div>
                      {isNext && <span className="chip chip--accent" style={{ fontSize: 10, whiteSpace: "nowrap" }}>Next gig</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                      {b.churchName}
                      {b.disputeReviewRequired ? " · Admin review" : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {b.fee != null ? (
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--sm-fg-1)" }}>${b.fee}</div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>Volunteer</div>
                    )}
                    <span className={BOOKING_STATUS_CHIP[status]} style={{ fontSize: 11, marginTop: 4, display: "inline-block" }}>
                      {BOOKING_STATUS_LABEL[status]}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>

        {/* Conversations in progress */}
        <Section
          label="Conversations in progress"
          viewAllHref="/messages"
          viewAllLabel="View all messages"
          empty={activeConversations.length === 0}
          emptyMessage="No active negotiations right now. Reply to a request to start one."
          emptyAction={{ href: "/open-requests", label: "Browse open requests" }}
        >
          {activeConversations.map(t => {
            const sr = t.service_requests;
            const d = sr?.service_date ? new Date(sr.service_date + "T12:00:00") : null;
            return (
              <Link key={t.id} href={`/messages/${t.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 18, alignItems: "center", padding: "16px 20px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", marginBottom: 8 }}>
                  <div style={{ textAlign: "center", paddingRight: 18, borderRight: "1px solid var(--sm-border-subtle)" }}>
                    {d ? (
                      <>
                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                          {d.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 10.5, color: "var(--sm-fg-3)", marginTop: 1 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--sm-fg-4)" }}>TBD</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)", marginBottom: 2 }}>{sr?.title ?? "Service"}</div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                      {t.church_profiles?.church_name ?? "Church"}
                      {sr?.service_type ? ` · ${sr.service_type}` : ""}
                    </div>
                  </div>
                  <span className="chip chip--accent" style={{ fontSize: 11, whiteSpace: "nowrap" }}>In discussion</span>
                </div>
              </Link>
            );
          })}
        </Section>

        {/* Open requests */}
        <Section
          label="Open requests for you"
          viewAllHref="/open-requests"
          viewAllLabel="View all open requests"
          empty={openRequests.length === 0}
          emptyMessage={
            myInstruments.length === 0
              ? "Add your instruments to your profile to see matching requests."
              : "No open requests matching your instruments right now."
          }
          emptyAction={myInstruments.length === 0 ? { href: "/profile", label: "Update profile" } : { href: "/open-requests", label: "Browse all requests" }}
        >
          {openRequests.map(r => {
            const d = new Date(r.service_date + "T12:00:00");
            const matchedInstrs = r.matchedInstrs;
            return (
              <Link key={r.id} href={`/requests/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 18, alignItems: "center", padding: "16px 20px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)", marginBottom: 8 }}>
                  <div style={{ textAlign: "center", paddingRight: 18, borderRight: "1px solid var(--sm-border-subtle)" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--sm-accent)", fontWeight: 700 }}>
                      {d.toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--sm-fg-1)", marginTop: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: 10.5, color: "var(--sm-fg-3)", marginTop: 1 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--sm-fg-1)", marginBottom: 2 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--sm-fg-3)" }}>
                      {r.church_profiles?.church_name} · {r.church_profiles?.city}, {r.church_profiles?.state}
                      {r.offered_fee != null && ` · $${r.offered_fee}`}
                    </div>
                    {matchedInstrs.length > 0 && (
                      <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {matchedInstrs.map(i => <span key={i} className="chip chip--accent" style={{ fontSize: 11 }}>{i}</span>)}
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--sm-fg-3)" }}>
                      {r.readiness.percent}% match · {r.readiness.label}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--sm-fg-4)", whiteSpace: "nowrap" }}>View →</span>
                </div>
              </Link>
            );
          })}
        </Section>
      </div>
    </>
  );
}

function Section({ label, viewAllHref, viewAllLabel, empty, emptyMessage, emptyAction, children }: {
  label: string;
  viewAllHref: string;
  viewAllLabel: string;
  empty: boolean;
  emptyMessage: string;
  emptyAction: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--sm-fg-3)" }}>{label}</div>
        <Link href={viewAllHref} style={{ fontSize: 12.5, color: "var(--sm-accent)", textDecoration: "none", fontWeight: 500 }}>
          {viewAllLabel} →
        </Link>
      </div>
      {empty ? (
        <div style={{ padding: "28px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", textAlign: "center", background: "var(--sm-bg-1)" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--sm-fg-3)" }}>{emptyMessage}</p>
          <Link href={emptyAction.href} className="btn btn--secondary btn--sm">{emptyAction.label}</Link>
        </div>
      ) : children}
    </div>
  );
}
