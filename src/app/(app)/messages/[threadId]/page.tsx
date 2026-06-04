import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound } from "next/navigation";
import { ThreadClient } from "./ThreadClient";
import type { CancellationPolicy } from "@/lib/disputes/policy";

export type RequestInfo = {
  id: string;
  title: string;
  service_date: string;
  service_time: string | null;
  service_end_time?: string | null;
  service_timezone?: string | null;
  offered_fee: number | null;
  fee_type: string;
  instruments_needed: string[];
  rehearsals: string;
  status: string;
};

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: thread } = await supabase
    .from("threads")
    .select("id, request_id, church_profile_id, musician_profile_id, archived_at, archive_reason, last_read_at_church, last_read_at_musician, unread_count_church, unread_count_musician")
    .eq("id", threadId)
    .single();
  if (!thread) notFound();

  const [
    { data: messages },
    { data: myCp },
    { data: booking },
    { data: req },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, thread_id, sender_profile_id, kind, body, proposal, proposal_status, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, cancelled_at, service_date, cancellation_policy, cancellation_policy_label, dispute_review_required")
      .eq("thread_id", threadId)
      .maybeSingle(),
    thread.request_id
      ? supabase
          .from("service_requests")
          .select("id, title, service_date, service_time, service_end_time, service_timezone, offered_fee, fee_type, instruments_needed, rehearsals, status")
          .eq("id", thread.request_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const isChurchSide = myCp?.id === thread.church_profile_id;

  const storedPolicy = booking?.cancellation_policy;
  const bookingPolicy = storedPolicy && typeof storedPolicy === "object" && !Array.isArray(storedPolicy) && Object.keys(storedPolicy).length > 0
    ? storedPolicy as unknown as CancellationPolicy
    : null;

  const requestInfo = req ? req as RequestInfo : null;

  let otherName = "Musician";
  if (isChurchSide) {
    const { data: mp } = await supabase
      .from("musician_profiles").select("profiles(display_name)").eq("id", thread.musician_profile_id).single();
    otherName = (mp as { profiles: { display_name: string } | null } | null)?.profiles?.display_name ?? "Musician";
  } else {
    const { data: cp } = await supabase
      .from("church_profiles").select("church_name").eq("id", thread.church_profile_id).single();
    otherName = (cp as { church_name: string } | null)?.church_name ?? "Church";
  }

  return (
    <>
      <Topbar
        title={otherName}
        crumbs={[
          { label: "Messages", href: "/messages" },
          { label: requestInfo?.title ?? "Conversation" },
        ]}
      />
      <ThreadClient
        threadId={threadId}
        currentUserId={user.id}
        isChurchSide={isChurchSide}
        otherName={otherName}
        requestInfo={requestInfo}
        archivedAt={thread.archived_at}
        archiveReason={thread.archive_reason}
        bookingId={booking?.id ?? null}
        bookingCancelledAt={booking?.cancelled_at ?? null}
        bookingCancellationPolicy={bookingPolicy}
        bookingCancellationPolicyLabel={booking?.cancellation_policy_label ?? null}
        bookingDisputeReviewRequired={booking?.dispute_review_required === true}
        initialLastReadAt={isChurchSide ? thread.last_read_at_church : thread.last_read_at_musician}
        initialUnreadCount={isChurchSide ? thread.unread_count_church : thread.unread_count_musician}
        initialMessages={(messages ?? []) as unknown as Parameters<typeof ThreadClient>[0]["initialMessages"]}
      />
    </>
  );
}
