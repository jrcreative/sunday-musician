import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import Link from "next/link";
import { RequestsClient } from "./RequestsClient";
import { BookingsClient, type Booking } from "./BookingsClient";
import { redirect } from "next/navigation";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isChurch = profile?.role === "church";

  // ── Church: own requests ──
  if (isChurch) {
    const { data: churchProfile } = await supabase
      .from("church_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    let requests: unknown[] = [];
    if (churchProfile) {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .eq("church_profile_id", churchProfile.id)
        .order("service_date", { ascending: true });
      requests = data ?? [];
    }

    return (
      <>
        <Topbar
          title="Requests"
          crumbs={[{ label: "Requests" }]}
          right={<Link href="/requests/new" className="btn btn--primary btn--sm">+ New request</Link>}
        />
        <RequestsClient requests={requests as Parameters<typeof RequestsClient>[0]["requests"]} isChurch={true} />
      </>
    );
  }

  // ── Musician: confirmed bookings ──
  // Read straight from the bookings table — that's the row that actually
  // tracks cancellation. The previous version derived bookings from
  // messages.proposal_status='accepted', which never gets reset on cancel,
  // so cancelled bookings still showed as "Upcoming". Going through the
  // real table also gives us the booking id (for cancel actions) and the
  // canonical fee/feeType captured at acceptance time.
  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  let bookings: Booking[] = [];

  if (mp) {
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
      church_profiles: { church_name: string; city: string; state: string } | null;
      service_requests: { title: string; service_type: string } | null;
    };

    const { data: rows } = await supabase
      .from("bookings")
      .select(`
        id, thread_id, service_date, fee, fee_type, accepted_at, cancelled_at, cancellation_policy_label, dispute_review_required,
        church_profiles ( church_name, city, state ),
        service_requests ( title, service_type )
      `)
      .eq("musician_profile_id", mp.id)
      .order("service_date", { ascending: false, nullsFirst: false }) as unknown as { data: BookingRow[] | null };

    bookings = (rows ?? []).map(r => ({
      bookingId: r.id,
      threadId: r.thread_id,
      churchName: r.church_profiles?.church_name ?? "Church",
      churchCity: r.church_profiles?.city ?? "",
      churchState: r.church_profiles?.state ?? "",
      title: r.service_requests?.title ?? "Service",
      serviceDate: r.service_date,
      serviceType: r.service_requests?.service_type ?? "",
      fee: r.fee,
      feeType: r.fee_type ?? "per service",
      acceptedAt: r.accepted_at,
      cancelledAt: r.cancelled_at,
      cancellationPolicyLabel: r.cancellation_policy_label,
      disputeReviewRequired: r.dispute_review_required === true,
    }));
  }

  return (
    <>
      <Topbar title="My Bookings" crumbs={[{ label: "My Bookings" }]} />
      <BookingsClient bookings={bookings} />
    </>
  );
}
