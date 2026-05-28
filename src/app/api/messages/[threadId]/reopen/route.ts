import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { withJsonErrors } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ThreadRow = {
  id: string;
  church_profile_id: string;
  musician_profile_id: string;
  archived_at: string | null;
  archive_reason: string | null;
};

async function participantSide(
  admin: ReturnType<typeof createAdminClient>,
  thread: ThreadRow,
  profileId: string,
) {
  const [{ data: churchProfile }, { data: musicianProfile }] = await Promise.all([
    admin
      .from("church_profiles")
      .select("id")
      .eq("id", thread.church_profile_id)
      .eq("profile_id", profileId)
      .maybeSingle(),
    admin
      .from("musician_profiles")
      .select("id")
      .eq("id", thread.musician_profile_id)
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (churchProfile?.id === thread.church_profile_id) return "church" as const;
  if (musicianProfile?.id === thread.musician_profile_id) return "musician" as const;
  return null;
}

export const POST = withJsonErrors(async (
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const { threadId } = await params;
  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .select("id, church_profile_id, musician_profile_id, archived_at, archive_reason")
    .eq("id", threadId)
    .maybeSingle() as unknown as { data: ThreadRow | null };

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const side = await participantSide(admin, thread, active.user.id);
  if (!side) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!thread.archived_at) {
    return NextResponse.json({ ok: true, alreadyOpen: true, side });
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, cancelled_at")
    .eq("thread_id", threadId)
    .maybeSingle() as unknown as { data: { id: string; cancelled_at: string | null } | null };

  const canReopenAcceptedBooking = !!booking && !booking.cancelled_at;
  const canReopenStaleConversation = thread.archive_reason === "stale";

  if (!canReopenAcceptedBooking && !canReopenStaleConversation) {
    return NextResponse.json({ error: "This conversation cannot be reopened." }, { status: 400 });
  }

  const reopenedAt = new Date().toISOString();
  const { error } = await admin
    .from("threads")
    .update({ archived_at: null, archive_reason: null, updated_at: reopenedAt })
    .eq("id", threadId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, side, reopenedAt });
});
