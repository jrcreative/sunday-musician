import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { requireActiveUser } from "@/lib/api/active-user";
import { withJsonErrors } from "@/lib/api/handler";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import {
  messageReceivedEmail,
  proposalReceivedEmail,
} from "@/lib/email/templates/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProposalPayload = {
  fee?: number | null;
  feeType?: string;
  date?: string | null;
  notes?: string;
};

type MessagePayload = {
  threadId?: string;
  kind?: "text" | "proposal";
  body?: string | null;
  proposal?: ProposalPayload | null;
};

type ThreadNoticeRow = {
  id: string;
  request_id: string;
  church_profile_id: string;
  musician_profile_id: string;
  service_requests: { title: string; service_date: string; fee_type: string } | null;
  church_profiles: {
    church_name: string;
    profile_id: string;
    profiles: { email: string; display_name: string } | null;
  } | null;
  musician_profiles: {
    profile_id: string;
    profiles: { email: string; display_name: string } | null;
  } | null;
};

function feeLabel(proposal: ProposalPayload | null | undefined, fallbackFeeType: string | undefined) {
  const fee = proposal?.fee;
  if (fee == null || !Number.isFinite(Number(fee))) return "Fee TBD";
  return `$${Number(fee)} ${proposal?.feeType ?? fallbackFeeType ?? "Per service"}`;
}

function preview(value: string | null | undefined) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Open the conversation to read the latest message.";
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

async function notifyCounterparty(input: {
  messageId: string;
  senderProfileId: string;
  kind: "text" | "proposal";
  body: string | null;
  proposal: ProposalPayload | null;
  thread: ThreadNoticeRow;
}) {
  const senderIsChurch = input.thread.church_profiles?.profile_id === input.senderProfileId;
  const senderName = senderIsChurch
    ? input.thread.church_profiles?.church_name ?? "Church"
    : input.thread.musician_profiles?.profiles?.display_name ?? "Musician";
  const recipientProfileId = senderIsChurch
    ? input.thread.musician_profiles?.profile_id ?? null
    : input.thread.church_profiles?.profile_id ?? null;
  const recipient = senderIsChurch
    ? input.thread.musician_profiles?.profiles
    : input.thread.church_profiles?.profiles;
  if (!recipientProfileId || !recipient?.email) return;

  const requestTitle = input.thread.service_requests?.title ?? "your request";
  const threadUrl = appUrl(`/messages/${input.thread.id}`);

  if (input.kind === "proposal") {
    const event = EMAIL_EVENTS.proposalReceived;
    const message = proposalReceivedEmail({
      to: recipient.email,
      recipientName: recipient.display_name,
      churchName: input.thread.church_profiles?.church_name ?? "A church",
      requestTitle,
      serviceDate: input.proposal?.date ?? input.thread.service_requests?.service_date ?? new Date().toISOString().slice(0, 10),
      feeLabel: feeLabel(input.proposal, input.thread.service_requests?.fee_type),
      threadUrl,
    });
    await sendTransactionalEmail({
      eventKey: event.key,
      category: event.category,
      dedupeKey: `${event.key}:${input.messageId}`,
      recipientProfileId,
      message,
      template: configuredTemplateId(event) ? {
        templateId: configuredTemplateId(event),
        variables: {
          RECIPIENT_NAME: recipient.display_name,
          CHURCH_NAME: input.thread.church_profiles?.church_name ?? "A church",
          REQUEST_TITLE: requestTitle,
          SERVICE_DATE: input.proposal?.date ?? input.thread.service_requests?.service_date ?? "",
          FEE_LABEL: feeLabel(input.proposal, input.thread.service_requests?.fee_type),
          THREAD_URL: threadUrl,
        },
      } : undefined,
      payload: { thread_id: input.thread.id, message_id: input.messageId, request_id: input.thread.request_id },
    });
    return;
  }

  const event = EMAIL_EVENTS.messageReceived;
  const message = messageReceivedEmail({
    to: recipient.email,
    recipientName: recipient.display_name,
    senderName,
    requestTitle,
    preview: preview(input.body),
    threadUrl,
  });
  await sendTransactionalEmail({
    eventKey: event.key,
    category: event.category,
    dedupeKey: `${event.key}:${input.messageId}`,
    recipientProfileId,
    message,
    template: configuredTemplateId(event) ? {
      templateId: configuredTemplateId(event),
      variables: {
        RECIPIENT_NAME: recipient.display_name,
        SENDER_NAME: senderName,
        REQUEST_TITLE: requestTitle,
        MESSAGE_PREVIEW: preview(input.body),
        THREAD_URL: threadUrl,
      },
    } : undefined,
    payload: { thread_id: input.thread.id, message_id: input.messageId, request_id: input.thread.request_id },
  });
}

export const POST = withJsonErrors(async (req: Request) => {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;

  const body = await req.json().catch(() => null) as MessagePayload | null;
  const threadId = body?.threadId;
  const kind = body?.kind === "proposal" ? "proposal" : "text";
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });

  // Input length limits — keep storage reasonable and surface clear errors.
  const MAX_BODY_LENGTH = 5000;
  const MAX_PROPOSAL_NOTES_LENGTH = 1000;
  const MAX_FEE_DOLLARS = 50_000;

  if (kind === "text") {
    const rawBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!rawBody) return NextResponse.json({ error: "Message body required" }, { status: 400 });
    if (rawBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Message is too long (max ${MAX_BODY_LENGTH} characters)` }, { status: 400 });
    }
  }

  if (kind === "proposal") {
    const proposalNotes = body?.proposal?.notes ?? "";
    if (proposalNotes.length > MAX_PROPOSAL_NOTES_LENGTH) {
      return NextResponse.json({ error: `Proposal notes are too long (max ${MAX_PROPOSAL_NOTES_LENGTH} characters)` }, { status: 400 });
    }
    const fee = body?.proposal?.fee;
    if (fee != null) {
      if (!Number.isFinite(Number(fee)) || Number(fee) <= 0) {
        return NextResponse.json({ error: "Fee must be a positive number" }, { status: 400 });
      }
      if (Number(fee) > MAX_FEE_DOLLARS) {
        return NextResponse.json({ error: `Fee cannot exceed $${MAX_FEE_DOLLARS.toLocaleString()}` }, { status: 400 });
      }
    }
  }

  const insert: Database["public"]["Tables"]["messages"]["Insert"] = kind === "proposal"
    ? {
      thread_id: threadId,
      sender_profile_id: active.user.id,
      kind,
      body: null,
      proposal: (body?.proposal ?? null) as Json,
      proposal_status: "pending" as const,
    }
    : {
      thread_id: threadId,
      sender_profile_id: active.user.id,
      kind,
      body: typeof body?.body === "string" ? body.body.trim() : "",
    };

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("messages")
    .insert(insert)
    .select()
    .single();
  if (error || !message) {
    return NextResponse.json({ error: error?.message ?? "Could not send message" }, { status: 400 });
  }

  // Cancel any other pending proposals in this thread so the musician cannot
  // accept a superseded proposal after the church sends a revised one.
  if (kind === "proposal") {
    const admin = createAdminClient();
    await admin
      .from("messages")
      .update({ proposal_status: "declined" })
      .eq("thread_id", threadId)
      .eq("kind", "proposal")
      .eq("proposal_status", "pending")
      .neq("id", message.id);
  }

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .select(`
      id, request_id, church_profile_id, musician_profile_id,
      service_requests ( title, service_date, fee_type ),
      church_profiles ( church_name, profile_id, profiles ( email, display_name ) ),
      musician_profiles ( profile_id, profiles ( email, display_name ) )
    `)
    .eq("id", threadId)
    .single() as unknown as { data: ThreadNoticeRow | null };

  if (thread) {
    await notifyCounterparty({
      messageId: message.id,
      senderProfileId: active.user.id,
      kind,
      body: kind === "text" ? message.body : null,
      proposal: kind === "proposal" ? (message.proposal as ProposalPayload | null) : null,
      thread,
    });
  }

  return NextResponse.json(message);
});
