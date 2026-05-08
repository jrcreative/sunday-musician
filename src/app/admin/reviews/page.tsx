import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { ReviewLabClient, type ReviewLabOption, type ReviewLabPeriod } from "./ReviewLabClient";

export default async function AdminReviewLabPage() {
  const admin = createAdminClient();

  const [{ data: periodsRaw }, { data: churchesRaw }, { data: musiciansRaw }] = await Promise.all([
    admin.from("review_periods")
      .select(`
        id, reveal_at, released_at,
        prompt_musician_at, prompt_church_at,
        reminder_musician_at, reminder_church_at,
        released_email_musician_at, released_email_church_at,
        bookings!inner (
          service_date,
          musician_profiles!inner ( id, profiles!inner ( display_name ) ),
          church_profiles!inner ( id, church_name )
        ),
        reviews ( reviewer_role )
      `)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("church_profiles")
      .select("id, church_name, profiles!inner(email)")
      .order("church_name")
      .limit(200),
    admin.from("musician_profiles")
      .select("id, profiles!inner(display_name, email)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  type RawPeriod = {
    id: string;
    reveal_at: string;
    released_at: string | null;
    prompt_musician_at: string | null;
    prompt_church_at: string | null;
    reminder_musician_at: string | null;
    reminder_church_at: string | null;
    released_email_musician_at: string | null;
    released_email_church_at: string | null;
    bookings: {
      service_date: string;
      musician_profiles: { id: string; profiles: { display_name: string } };
      church_profiles: { id: string; church_name: string };
    };
    reviews: { reviewer_role: "musician" | "church" }[];
  };

  const periods: ReviewLabPeriod[] = ((periodsRaw ?? []) as unknown as RawPeriod[]).map(p => ({
    id: p.id,
    serviceDate: p.bookings.service_date,
    revealAt: p.reveal_at,
    releasedAt: p.released_at,
    churchName: p.bookings.church_profiles.church_name,
    musicianName: p.bookings.musician_profiles.profiles.display_name,
    musicianSubmitted: p.reviews.some(r => r.reviewer_role === "musician"),
    churchSubmitted: p.reviews.some(r => r.reviewer_role === "church"),
    promptMusicianAt: p.prompt_musician_at,
    promptChurchAt: p.prompt_church_at,
    reminderMusicianAt: p.reminder_musician_at,
    reminderChurchAt: p.reminder_church_at,
    releasedEmailMusicianAt: p.released_email_musician_at,
    releasedEmailChurchAt: p.released_email_church_at,
  }));

  const churches = (churchesRaw ?? []) as unknown as Array<{ id: string; church_name: string; profiles: { email: string } }>;
  const musicians = (musiciansRaw ?? []) as unknown as Array<{ id: string; profiles: { display_name: string; email: string } }>;

  const churchOptions: ReviewLabOption[] = churches.map(c => ({
    id: c.id,
    label: `${c.church_name} · ${c.profiles.email}`,
  }));
  const musicianOptions: ReviewLabOption[] = musicians.map(m => ({
    id: m.id,
    label: `${m.profiles.display_name} · ${m.profiles.email}`,
  }));

  return (
    <>
      <AdminTopbar title="Review Lab" sub="Test review lifecycle without waiting on dates" />
      <ReviewLabClient periods={periods} churches={churchOptions} musicians={musicianOptions} />
    </>
  );
}
