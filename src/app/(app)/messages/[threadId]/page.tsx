import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound } from "next/navigation";
import { ThreadClient } from "./ThreadClient";

export type RequestInfo = {
  id: string;
  title: string;
  service_date: string;
  service_time: string | null;
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

  const { data: thread } = await supabase.from("threads").select("*").eq("id", threadId).single();
  if (!thread) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  let requestInfo: RequestInfo | null = null;
  if (thread.request_id) {
    const { data: req } = await supabase
      .from("service_requests")
      .select("id, title, service_date, service_time, offered_fee, fee_type, instruments_needed, rehearsals, status")
      .eq("id", thread.request_id)
      .single();
    if (req) requestInfo = req as RequestInfo;
  }

  const { data: churchProfile } = await supabase
    .from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle();
  const isChurchSide = churchProfile?.id === thread.church_profile_id;

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
        crumbs={[{ label: "Messages", href: "/messages" }, { label: otherName }]}
      />
      <ThreadClient
        threadId={threadId}
        currentUserId={user.id}
        isChurchSide={isChurchSide}
        otherName={otherName}
        requestInfo={requestInfo}
        initialMessages={(messages ?? []) as unknown as Parameters<typeof ThreadClient>[0]["initialMessages"]}
      />
    </>
  );
}
