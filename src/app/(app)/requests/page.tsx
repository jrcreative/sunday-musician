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
  const { data: mp } = await supabase
    .from("musician_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  let bookings: Booking[] = [];

  if (mp) {
    // Fetch all threads for this musician with church + request info
    const { data: threads } = await supabase
      .from("threads")
      .select("id, church_profile_id, request_id, church_profiles(church_name, city, state), service_requests(title, service_date, service_type, fee_type)")
      .eq("musician_profile_id", mp.id) as unknown as {
        data: Array<{
          id: string;
          church_profile_id: string;
          request_id: string | null;
          church_profiles: { church_name: string; city: string; state: string } | null;
          service_requests: { title: string; service_date: string; service_type: string; fee_type: string } | null;
        }> | null;
      };

    if (threads && threads.length > 0) {
      const threadIds = threads.map(t => t.id);

      // Find accepted proposals across all threads
      const { data: acceptedMsgs } = await supabase
        .from("messages")
        .select("thread_id, proposal, created_at")
        .in("thread_id", threadIds)
        .eq("proposal_status", "accepted")
        .order("created_at", { ascending: false }) as unknown as {
          data: Array<{
            thread_id: string;
            proposal: { fee: number | null; feeType: string; date: string | null; notes: string } | null;
            created_at: string;
          }> | null;
        };

      // Keep only the most recent accepted proposal per thread
      const acceptedByThread = new Map<string, typeof acceptedMsgs extends Array<infer T> | null ? NonNullable<NonNullable<typeof acceptedMsgs>[number]> : never>();
      for (const msg of acceptedMsgs ?? []) {
        if (!acceptedByThread.has(msg.thread_id)) {
          acceptedByThread.set(msg.thread_id, msg);
        }
      }

      bookings = threads
        .filter(t => acceptedByThread.has(t.id))
        .map(t => {
          const proposal = acceptedByThread.get(t.id)!.proposal;
          const acceptedAt = acceptedByThread.get(t.id)!.created_at;
          return {
            threadId: t.id,
            churchName: t.church_profiles?.church_name ?? "Church",
            churchCity: t.church_profiles?.city ?? "",
            churchState: t.church_profiles?.state ?? "",
            title: t.service_requests?.title ?? "Service",
            serviceDate: t.service_requests?.service_date ?? null,
            serviceType: t.service_requests?.service_type ?? "",
            fee: proposal?.fee ?? null,
            feeType: proposal?.feeType ?? t.service_requests?.fee_type ?? "per service",
            acceptedAt,
          };
        })
        .sort((a, b) => {
          const da = a.serviceDate ?? a.acceptedAt;
          const db = b.serviceDate ?? b.acceptedAt;
          return db.localeCompare(da);
        });
    }
  }

  return (
    <>
      <Topbar title="My Bookings" crumbs={[{ label: "My Bookings" }]} />
      <BookingsClient bookings={bookings} />
    </>
  );
}
