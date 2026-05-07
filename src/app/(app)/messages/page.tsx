import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import Link from "next/link";
import { redirect } from "next/navigation";

const AV_COLORS = ["#f5d8b8","#d8e4f5","#d8f5dd","#f5d8d8","#ebd8f5","#f5ecd8"];
const AV_TEXT   = ["#8a5a05","#1159af","#13612e","#b82105","#5b1faf","#8a5a05"];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ church_id?: string; request_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Musician-side path: response to a specific request → find/create thread.
  // Both church_id and request_id are required — every thread is anchored to a request.
  if (params.church_id && params.request_id) {
    const { data: mp } = await supabase
      .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();
    if (mp) {
      const { data: existing } = await supabase
        .from("threads").select("id")
        .eq("request_id", params.request_id)
        .eq("musician_profile_id", mp.id)
        .maybeSingle();
      if (existing) redirect(`/messages/${existing.id}`);
      const { data: created } = await supabase
        .from("threads")
        .insert({ church_profile_id: params.church_id, musician_profile_id: mp.id, request_id: params.request_id })
        .select("id").single();
      if (created) redirect(`/messages/${created.id}`);
    }
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const isChurch = profile?.role === "church";

  // Fetch threads with the data needed for the inbox in one shot:
  //  - the request being discussed (title + service date for anchoring)
  //  - the latest message (preview + unread comparison timestamp)
  //  - my last_read_at for this side (for unread count)
  //  - the counterparty name
  const profileTable = isChurch ? "church_profiles" : "musician_profiles";
  const { data: myProfile } = await supabase
    .from(profileTable).select("id").eq("profile_id", user.id).maybeSingle();
  if (!myProfile) {
    return renderEmpty(isChurch);
  }
  const myProfileId = (myProfile as { id: string }).id;

  const filterCol = isChurch ? "church_profile_id" : "musician_profile_id";
  const { data: rawThreads } = await supabase
    .from("threads")
    .select(`
      id, request_id, archived_at, archive_reason, updated_at,
      church_profile_id, musician_profile_id,
      last_read_at_church, last_read_at_musician,
      service_requests ( title, service_date ),
      church_profiles ( church_name ),
      musician_profiles ( profiles ( display_name ) ),
      messages ( body, created_at, sender_profile_id, kind )
    `)
    .eq(filterCol, myProfileId)
    .order("updated_at", { ascending: false }) as unknown as { data: Array<{
      id: string;
      request_id: string;
      archived_at: string | null;
      archive_reason: string | null;
      updated_at: string;
      church_profile_id: string;
      musician_profile_id: string;
      last_read_at_church: string | null;
      last_read_at_musician: string | null;
      service_requests: { title: string; service_date: string } | null;
      church_profiles: { church_name: string } | null;
      musician_profiles: { profiles: { display_name: string } | null } | null;
      messages: { body: string | null; created_at: string; sender_profile_id: string; kind: string }[];
    }> | null };

  const threads = (rawThreads ?? []).map(t => {
    const msgs = (t.messages ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const last = msgs[0];
    const myLastRead = isChurch ? t.last_read_at_church : t.last_read_at_musician;
    // Unread = messages from the other side after my last_read_at.
    const unread = msgs.filter(m =>
      m.sender_profile_id !== user.id &&
      (myLastRead == null || m.created_at > myLastRead)
    ).length;
    const otherName = isChurch
      ? (t.musician_profiles?.profiles?.display_name ?? "Musician")
      : (t.church_profiles?.church_name ?? "Church");
    const preview = last
      ? (last.kind === "proposal" ? "Sent a proposal" : (last.body ?? ""))
      : "";
    return {
      id: t.id,
      requestTitle: t.service_requests?.title ?? "Request",
      serviceDate: t.service_requests?.service_date ?? null,
      archivedAt: t.archived_at,
      archiveReason: t.archive_reason,
      updatedAt: t.updated_at,
      otherName,
      preview,
      unread,
    };
  });

  const active = threads.filter(t => !t.archivedAt);
  const archived = threads.filter(t => !!t.archivedAt);

  return (
    <>
      <Topbar title="Messages" crumbs={[{ label: "Messages" }]} />
      <div className="page page--narrow">
        {threads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>No messages yet</h3>
            <p style={{ margin: "0 0 20px" }}>
              {isChurch
                ? "Find a musician and invite them to one of your requests."
                : "When a church reaches out about a request — or you respond to one — your conversations show up here."}
            </p>
            {isChurch && <Link href="/find" className="btn btn--primary">Find musicians</Link>}
            {!isChurch && <Link href="/open-requests" className="btn btn--primary">Browse open requests</Link>}
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <ThreadList threads={active} />
            )}
            {archived.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".07em", margin: "32px 0 10px" }}>
                  Archived
                </div>
                <ThreadList threads={archived} archivedSection />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function renderEmpty(isChurch: boolean) {
  return (
    <>
      <Topbar title="Messages" crumbs={[{ label: "Messages" }]} />
      <div className="page page--narrow">
        <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
          <p>Finish your profile to start messaging.</p>
          {isChurch && <Link href="/profile" className="btn btn--primary" style={{ marginTop: 12 }}>Go to profile</Link>}
        </div>
      </div>
    </>
  );
}

type ThreadRow = {
  id: string;
  requestTitle: string;
  serviceDate: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  updatedAt: string;
  otherName: string;
  preview: string;
  unread: number;
};

function ThreadList({ threads, archivedSection }: { threads: ThreadRow[]; archivedSection?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", overflow: "hidden", background: "var(--sm-bg-1)" }}>
      {threads.map((thread, i) => {
        const idx = i % 6;
        const initials = thread.otherName.split(" ").map(w => w[0]).slice(0, 2).join("");
        const dateLabel = thread.serviceDate
          ? new Date(thread.serviceDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "";
        const dim = archivedSection ? 0.65 : 1;
        return (
          <Link
            key={thread.id}
            href={`/messages/${thread.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom: i < threads.length - 1 ? "1px solid var(--sm-border-subtle)" : "none",
              textDecoration: "none",
              opacity: dim,
              transition: "background var(--sm-dur-base) var(--sm-ease)",
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, color: AV_TEXT[idx], flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)" }}>{thread.otherName}</span>
                <span style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>· {thread.requestTitle}</span>
                {dateLabel && <span style={{ fontSize: 12, color: "var(--sm-fg-4)" }}>· {dateLabel}</span>}
              </div>
              <div style={{ fontSize: 13.5, color: thread.unread > 0 ? "var(--sm-fg-1)" : "var(--sm-fg-3)", fontWeight: thread.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {thread.preview}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)" }}>
                {new Date(thread.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              {thread.unread > 0 && (
                <span style={{ background: "var(--sm-accent)", color: "#fff", fontSize: 11, padding: "1px 7px", borderRadius: 9, fontWeight: 700, minWidth: 18, textAlign: "center" }}>
                  {thread.unread > 99 ? "99+" : thread.unread}
                </span>
              )}
              {archivedSection && (
                <span style={{ fontSize: 11, color: "var(--sm-fg-4)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
                  Archived
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
