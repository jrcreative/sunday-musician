import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound, redirect } from "next/navigation";
import { ReviewClient } from "./ReviewClient";

export default async function ReviewPeriodPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");
  const role = profile.role as "musician" | "church";

  // Fetch period + booking + counterparty info.
  const { data: periodRaw } = await supabase
    .from("review_periods")
    .select(`
      id, reveal_at, released_at,
      bookings!inner (
        id, service_date, fee, fee_type,
        musician_profile_id, church_profile_id,
        musician_profiles ( id, profile_id, profiles ( display_name ) ),
        church_profiles ( id, profile_id, church_name )
      )
    `)
    .eq("id", periodId)
    .maybeSingle() as unknown as { data: {
      id: string;
      reveal_at: string;
      released_at: string | null;
      bookings: {
        id: string;
        service_date: string;
        fee: number | null;
        fee_type: string | null;
        musician_profile_id: string;
        church_profile_id: string;
        musician_profiles: { id: string; profile_id: string; profiles: { display_name: string } | null } | null;
        church_profiles: { id: string; profile_id: string; church_name: string } | null;
      } | null;
    } | null };

  if (!periodRaw || !periodRaw.bookings) notFound();

  const booking = periodRaw.bookings;
  const isMyMusicianBooking = role === "musician" && booking.musician_profiles?.profile_id === user.id;
  const isMyChurchBooking = role === "church" && booking.church_profiles?.profile_id === user.id;
  if (!isMyMusicianBooking && !isMyChurchBooking) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const serviceCompleted = booking.service_date <= today;

  // Fetch existing reviews on this period. RLS will hide the other side's review
  // until release; the client renders accordingly.
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, reviewer_role, rating, body, submitted_at")
    .eq("period_id", periodId);

  const myRole: "musician" | "church" = isMyMusicianBooking ? "musician" : "church";
  const myReview = (reviews ?? []).find(r => r.reviewer_role === myRole) ?? null;
  const otherReview = (reviews ?? []).find(r => r.reviewer_role !== myRole) ?? null;

  const counterpartyName = myRole === "church"
    ? (booking.musician_profiles?.profiles?.display_name ?? "Musician")
    : (booking.church_profiles?.church_name ?? "Church");

  return (
    <>
      <Topbar
        title="Review"
        crumbs={[{ label: "Reviews", href: "/reviews" }, { label: counterpartyName }]}
      />
      <div className="page page--narrow">
        <ReviewClient
          periodId={periodId}
          myRole={myRole}
          counterpartyName={counterpartyName}
          serviceDate={booking.service_date}
          revealAt={periodRaw.reveal_at}
          released={!!periodRaw.released_at}
          serviceCompleted={serviceCompleted}
          myReview={myReview}
          otherReview={otherReview}
        />
      </div>
    </>
  );
}
