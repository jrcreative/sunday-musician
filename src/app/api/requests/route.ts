import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/delivery";
import { EMAIL_EVENTS, configuredTemplateId } from "@/lib/email/registry";
import { requestCreatedChurchEmail } from "@/lib/email/templates/requests";
import { uniqueInstruments } from "@/lib/instruments";

type RequestPayload = {
  title?: string;
  service_type?: string;
  service_date?: string;
  service_time?: string | null;
  location?: string | null;
  instruments_needed?: string[];
  rehearsals?: string;
  setlist_url?: string | null;
  tech_setup?: string[];
  offered_fee?: number | null;
  fee_type?: string;
  notes?: string | null;
};

function appUrl(path: string) {
  const base = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function POST(req: Request) {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "church") {
    return NextResponse.json({ error: "Only churches can create requests" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as RequestPayload | null;
  if (!body?.service_date) {
    return NextResponse.json({ error: "Service date is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: churchProfile, error: churchErr } = await admin
    .from("church_profiles")
    .select("id, church_name")
    .eq("profile_id", active.user.id)
    .maybeSingle();

  if (churchErr || !churchProfile) {
    return NextResponse.json({ error: "Church profile not found" }, { status: 404 });
  }

  const fields = {
    church_profile_id: churchProfile.id,
    title: body.title || "Untitled request",
    service_type: body.service_type || "Sunday morning",
    service_date: body.service_date,
    service_time: body.service_time || null,
    location: body.location ?? null,
    instruments_needed: uniqueInstruments(body.instruments_needed ?? []),
    rehearsals: body.rehearsals ?? "None",
    setlist_url: body.setlist_url || null,
    tech_setup: body.tech_setup ?? [],
    offered_fee: body.offered_fee ?? null,
    fee_type: body.fee_type || "Per service",
    notes: body.notes || null,
    status: "open" as const,
  };

  const { data: created, error: insertErr } = await admin
    .from("service_requests")
    .insert(fields)
    .select("id, title, service_date")
    .single();

  if (insertErr || !created) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not create request" }, { status: 400 });
  }

  const event = EMAIL_EVENTS.requestCreatedChurchConfirmation;
  const templateId = configuredTemplateId(event);
  const requestUrl = appUrl(`/requests/${created.id}`);
  const message = requestCreatedChurchEmail({
    to: active.user.email,
    churchName: churchProfile.church_name,
    requestTitle: created.title,
    serviceDate: created.service_date,
    requestUrl,
  });

  await sendTransactionalEmail({
    eventKey: event.key,
    category: event.category,
    dedupeKey: `${event.key}:${created.id}:${active.user.id}`,
    recipientProfileId: active.user.id,
    message,
    template: templateId ? {
      templateId,
      variables: {
        CHURCH_NAME: churchProfile.church_name,
        REQUEST_TITLE: created.title,
        SERVICE_DATE: created.service_date,
        REQUEST_URL: requestUrl,
      },
    } : undefined,
    payload: {
      request_id: created.id,
      church_profile_id: churchProfile.id,
      template_name: event.suggestedTemplateName,
    },
  });

  return NextResponse.json({ id: created.id });
}
