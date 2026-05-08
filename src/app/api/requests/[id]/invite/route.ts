import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { requestInviteMusicianEmail } from "@/lib/email/templates/requests";

type InvitePayload = {
  musicianProfileId?: string;
};

type MusicianRow = {
  id: string;
  profile_id: string;
  profiles: { email: string; display_name: string } | null;
};

function appUrl(path: string) {
  const base = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function feeLabel(fee: number | null, feeType: string) {
  if (fee == null) return "Fee TBD";
  return `$${fee} ${feeType}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: requestId } = await params;
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "church") {
    return NextResponse.json({ error: "Only churches can invite musicians" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as InvitePayload | null;
  if (!body?.musicianProfileId) {
    return NextResponse.json({ error: "Musician profile is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: churchProfile } = await admin
    .from("church_profiles")
    .select("id, church_name")
    .eq("profile_id", active.user.id)
    .maybeSingle();

  if (!churchProfile) {
    return NextResponse.json({ error: "Church profile not found" }, { status: 404 });
  }

  const { data: requestRow, error: requestErr } = await admin
    .from("service_requests")
    .select("id, title, service_date, offered_fee, fee_type, notes, status, church_profile_id")
    .eq("id", requestId)
    .eq("church_profile_id", churchProfile.id)
    .maybeSingle();

  if (requestErr || !requestRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (requestRow.status !== "open") {
    return NextResponse.json({ error: "Only open requests can be used for invitations" }, { status: 400 });
  }

  const { data: musician } = await admin
    .from("musician_profiles")
    .select("id, profile_id, profiles(email, display_name)")
    .eq("id", body.musicianProfileId)
    .maybeSingle() as unknown as { data: MusicianRow | null; error: unknown };

  if (!musician?.profiles) {
    return NextResponse.json({ error: "Musician not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("threads")
    .select("id")
    .eq("request_id", requestRow.id)
    .eq("musician_profile_id", musician.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ threadId: existing.id, alreadyInvited: true });
  }

  const { data: thread, error: threadErr } = await admin
    .from("threads")
    .insert({
      church_profile_id: churchProfile.id,
      musician_profile_id: musician.id,
      request_id: requestRow.id,
    })
    .select("id")
    .single();

  if (threadErr || !thread) {
    return NextResponse.json({ error: threadErr?.message ?? "Could not create thread" }, { status: 400 });
  }

  const { error: messageErr } = await admin.from("messages").insert({
    thread_id: thread.id,
    sender_profile_id: active.user.id,
    kind: "proposal",
    body: null,
    proposal: {
      fee: requestRow.offered_fee,
      feeType: requestRow.fee_type,
      date: requestRow.service_date,
      notes: requestRow.notes ?? "",
    },
    proposal_status: "pending",
  });

  if (messageErr) {
    return NextResponse.json({ threadId: thread.id, warning: messageErr.message });
  }

  const event = EMAIL_EVENTS.requestInviteMusician;
  const templateId = configuredTemplateId(event);
  const threadUrl = appUrl(`/messages/${thread.id}`);
  const fee = feeLabel(requestRow.offered_fee, requestRow.fee_type);
  const message = requestInviteMusicianEmail({
    to: musician.profiles.email,
    musicianName: musician.profiles.display_name,
    churchName: churchProfile.church_name,
    requestTitle: requestRow.title,
    serviceDate: requestRow.service_date,
    feeLabel: fee,
    threadUrl,
  });

  await sendTransactionalEmail({
    eventKey: event.key,
    category: event.category,
    dedupeKey: `${event.key}:${requestRow.id}:${musician.id}`,
    recipientProfileId: musician.profile_id,
    message,
    template: templateId ? {
      templateId,
      variables: {
        MUSICIAN_NAME: musician.profiles.display_name,
        CHURCH_NAME: churchProfile.church_name,
        REQUEST_TITLE: requestRow.title,
        SERVICE_DATE: requestRow.service_date,
        FEE_LABEL: fee,
        THREAD_URL: threadUrl,
      },
    } : undefined,
    payload: {
      request_id: requestRow.id,
      thread_id: thread.id,
      musician_profile_id: musician.id,
      template_name: event.templateName,
    },
  });

  return NextResponse.json({ threadId: thread.id });
}
