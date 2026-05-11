import { NextResponse } from "next/server";
import { logAdminAction } from "@/app/admin/_lib/audit";
import { withAdminJson } from "@/app/admin/_lib/with-admin-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  requestId?: string;
  musicianProfileId?: string;
  message?: string;
};

type RequestRow = {
  id: string;
  title: string;
  service_date: string;
  church_profile_id: string;
  church_profiles: { profile_id: string; church_name: string } | null;
};

type MusicianRow = {
  id: string;
  profile_id: string;
  profiles: { display_name: string; email: string } | null;
};

export const POST = withAdminJson(async ({ actor, admin }, req: Request) => {
  const body = await req.json().catch(() => null) as Payload | null;
  const requestId = body?.requestId;
  const musicianProfileId = body?.musicianProfileId;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!requestId || !musicianProfileId || !message) {
    return NextResponse.json({ error: "Request, musician, and message are required" }, { status: 400 });
  }

  const [{ data: requestRow }, { data: musician }] = await Promise.all([
    admin
      .from("service_requests")
      .select("id, title, service_date, church_profile_id, church_profiles ( profile_id, church_name )")
      .eq("id", requestId)
      .maybeSingle() as unknown as Promise<{ data: RequestRow | null }>,
    admin
      .from("musician_profiles")
      .select("id, profile_id, profiles ( display_name, email )")
      .eq("id", musicianProfileId)
      .maybeSingle() as unknown as Promise<{ data: MusicianRow | null }>,
  ]);

  if (!requestRow?.church_profiles) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (!musician) {
    return NextResponse.json({ error: "Musician not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("threads")
    .select("id")
    .eq("request_id", requestRow.id)
    .eq("musician_profile_id", musician.id)
    .maybeSingle();

  let threadId = existing?.id ?? null;
  if (!threadId) {
    const { data: created, error: threadErr } = await admin
      .from("threads")
      .insert({
        church_profile_id: requestRow.church_profile_id,
        musician_profile_id: musician.id,
        request_id: requestRow.id,
      })
      .select("id")
      .single();
    if (threadErr || !created) {
      return NextResponse.json({ error: threadErr?.message ?? "Could not create thread" }, { status: 400 });
    }
    threadId = created.id;
  }

  const { error: messageErr } = await admin.from("messages").insert({
    thread_id: threadId,
    sender_profile_id: actor.id,
    kind: "text",
    body: message,
  });
  if (messageErr) {
    return NextResponse.json({ error: messageErr.message }, { status: 400 });
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "manual_match_contact_musician",
    targetType: "request",
    targetId: requestRow.id,
    targetLabel: requestRow.title,
    level: "success",
    metadata: {
      thread_id: threadId,
      musician_profile_id: musician.id,
      musician_name: musician.profiles?.display_name ?? null,
      already_invited: !!existing,
    },
  });

  return NextResponse.json({ ok: true, threadId, alreadyInvited: !!existing });
});
