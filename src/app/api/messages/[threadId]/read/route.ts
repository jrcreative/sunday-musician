import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { withJsonErrors } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ThreadParticipantRow = {
  id: string;
  church_profile_id: string;
  musician_profile_id: string;
};

async function participantSide(
  admin: ReturnType<typeof createAdminClient>,
  thread: ThreadParticipantRow,
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
    .select("id, church_profile_id, musician_profile_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const side = await participantSide(admin, thread, active.user.id);
  if (!side) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readAt = new Date().toISOString();
  const update = side === "church"
    ? { last_read_at_church: readAt }
    : { last_read_at_musician: readAt };

  const { error } = await admin
    .from("threads")
    .update(update)
    .eq("id", threadId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, side, readAt });
});
