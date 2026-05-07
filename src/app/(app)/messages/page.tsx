import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import Link from "next/link";

const AV_COLORS = ["#f5d8b8","#d8e4f5","#d8f5dd","#f5d8d8","#ebd8f5","#f5ecd8"];
const AV_TEXT   = ["#8a5a05","#1159af","#13612e","#b82105","#5b1faf","#8a5a05"];

import { redirect } from "next/navigation";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ musician?: string; church_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Handle direct "Message" click from musician profile — find/create thread and redirect
  if (params.musician) {
    const [{ data: cp }, { data: mp }] = await Promise.all([
      supabase.from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle(),
      supabase.from("musician_profiles").select("id").eq("profile_id", params.musician).maybeSingle(),
    ]);
    if (cp && mp) {
      const { data: existing } = await supabase
        .from("threads").select("id")
        .eq("church_profile_id", cp.id).eq("musician_profile_id", mp.id)
        .maybeSingle();
      if (existing) redirect(`/messages/${existing.id}`);
      const { data: created } = await supabase
        .from("threads")
        .insert({ church_profile_id: cp.id, musician_profile_id: mp.id, request_id: null })
        .select("id").single();
      if (created) redirect(`/messages/${created.id}`);
    }
  }

  // Handle "Message church" from musician side — church_id is church_profiles.id
  if (params.church_id) {
    const { data: mp } = await supabase
      .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();
    if (mp) {
      const { data: existing } = await supabase
        .from("threads").select("id")
        .eq("church_profile_id", params.church_id).eq("musician_profile_id", mp.id)
        .maybeSingle();
      if (existing) redirect(`/messages/${existing.id}`);
      const { data: created } = await supabase
        .from("threads")
        .insert({ church_profile_id: params.church_id, musician_profile_id: mp.id, request_id: null })
        .select("id").single();
      if (created) redirect(`/messages/${created.id}`);
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isChurch = profile?.role === "church";

  // Get the user's church or musician profile ID to query threads
  let threads: Array<{
    id: string;
    updated_at: string;
    church_profile_id: string;
    musician_profile_id: string;
    lastMessage?: string;
    otherName?: string;
  }> = [];

  if (isChurch) {
    const { data: cp } = await supabase
      .from("church_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (cp) {
      const { data } = await supabase
        .from("threads")
        .select("*, messages(body, created_at, sender_profile_id)")
        .eq("church_profile_id", cp.id)
        .order("updated_at", { ascending: false }) as unknown as {
          data: Array<{ id: string; church_profile_id: string; musician_profile_id: string; updated_at: string; messages: Array<{ body: string | null; created_at: string }> }> | null;
          error: unknown;
        };

      // Fetch musician names
      if (data) {
        threads = await Promise.all(data.map(async (t) => {
          const { data: mp } = await supabase
            .from("musician_profiles")
            .select("profiles(display_name)")
            .eq("id", t.musician_profile_id)
            .single() as unknown as { data: { profiles: { display_name: string } | null } | null; error: unknown };
          const msgs = t.messages;
          const last = msgs?.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return {
            ...t,
            lastMessage: last?.body ?? undefined,
            otherName: mp?.profiles?.display_name ?? "Musician",
          };
        }));
      }
    }
  } else {
    const { data: mp } = await supabase
      .from("musician_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (mp) {
      const { data } = await supabase
        .from("threads")
        .select("*, messages(body, created_at, sender_profile_id)")
        .eq("musician_profile_id", mp.id)
        .order("updated_at", { ascending: false }) as unknown as {
          data: Array<{ id: string; church_profile_id: string; musician_profile_id: string; updated_at: string; messages: Array<{ body: string | null; created_at: string }> }> | null;
          error: unknown;
        };

      if (data) {
        threads = await Promise.all(data.map(async (t) => {
          const { data: cp } = await supabase
            .from("church_profiles")
            .select("church_name")
            .eq("id", t.church_profile_id)
            .single() as unknown as { data: { church_name: string } | null; error: unknown };
          const msgs = t.messages;
          const last = msgs?.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return {
            ...t,
            lastMessage: last?.body ?? undefined,
            otherName: cp?.church_name ?? "Church",
          };
        }));
      }
    }
  }

  return (
    <>
      <Topbar title="Messages" crumbs={[{ label: "Messages" }]} />
      <div style={{ padding: "32px 32px 80px", maxWidth: 900, width: "100%" }}>
        {threads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>No messages yet</h3>
            <p style={{ margin: "0 0 20px" }}>
              {isChurch
                ? "Find a musician and message them to start a conversation."
                : "When churches reach out, your conversations will appear here."}
            </p>
            {isChurch && <Link href="/find" className="btn btn--primary">Find musicians</Link>}
          </div>
        ) : (
          <div style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", overflow: "hidden" }}>
            {threads.map((thread, i) => {
              const idx = i % 6;
              const name = thread.otherName ?? "—";
              const initials = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("");
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
                    background: "var(--sm-bg-1)",
                    transition: "background var(--sm-dur-base) var(--sm-ease)",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, color: AV_TEXT[idx], flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 2 }}>{name}</div>
                    {thread.lastMessage && (
                      <div style={{ fontSize: 13.5, color: "var(--sm-fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {thread.lastMessage}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", flexShrink: 0 }}>
                    {new Date(thread.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
