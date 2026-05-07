"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const churchNav = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/find", label: "Find musicians", icon: SearchIcon },
  { href: "/requests", label: "My requests", icon: InboxIcon },
  { href: "/messages", label: "Messages", icon: MsgIcon },
  { href: "/reviews", label: "Reviews", icon: StarIcon },
];

const musicianNav = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/find", label: "Browse musicians", icon: SearchIcon },
  { href: "/availability", label: "Availability", icon: CalendarIcon },
  { href: "/messages", label: "Messages", icon: MsgIcon },
  { href: "/reviews", label: "Reviews", icon: StarIcon },
];

export function Sidebar({ profile, userId }: { profile: Profile | null; userId: string }) {
  const pathname = usePathname();
  const isChurch = profile?.role !== "musician";
  const nav = isChurch ? churchNav : musicianNav;
  const initials = profile?.display_name?.split(" ").map(w => w[0]).slice(0, 2).join("") ?? "?";

  // Per-thread unread is server-side (last_read_at_* on threads). The badge
  // here is a sum: count of threads where the latest message is from the other
  // side and newer than my last_read_at.
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const threadDataRef = useRef<Map<string, { lastReadAt: string | null; archived: boolean }>>(new Map());
  const profileSideRef = useRef<{ column: "church_profile_id" | "musician_profile_id"; profileId: string | null }>({
    column: "church_profile_id", profileId: null,
  });

  async function recompute() {
    const supabase = createClient();
    const { column, profileId } = profileSideRef.current;
    if (!profileId) return;

    // Pull threads with my last_read_at + their latest message timestamp.
    const { data } = await supabase
      .from("threads")
      .select("id, archived_at, last_read_at_church, last_read_at_musician, messages(created_at, sender_profile_id)")
      .eq(column, profileId) as unknown as { data: Array<{
        id: string; archived_at: string | null;
        last_read_at_church: string | null; last_read_at_musician: string | null;
        messages: { created_at: string; sender_profile_id: string }[];
      }> | null };

    let count = 0;
    threadDataRef.current.clear();
    for (const t of data ?? []) {
      const myLastRead = isChurch ? t.last_read_at_church : t.last_read_at_musician;
      threadDataRef.current.set(t.id, { lastReadAt: myLastRead, archived: !!t.archived_at });
      // Count threads with at least one message from the other side after my last_read_at.
      const hasUnread = t.messages.some(m =>
        m.sender_profile_id !== userId && (myLastRead == null || m.created_at > myLastRead)
      );
      if (hasUnread) count++;
    }
    setUnreadCount(count);
  }

  // Initial fetch + realtime subscription. Recompute on /messages exits since
  // visiting a thread updates last_read_at server-side.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function init() {
      // Resolve our profile-side id once.
      const tbl = isChurch ? "church_profiles" : "musician_profiles";
      const { data } = await supabase.from(tbl).select("id").eq("profile_id", userId).maybeSingle();
      profileSideRef.current = {
        column: isChurch ? "church_profile_id" : "musician_profile_id",
        profileId: (data as { id: string } | null)?.id ?? null,
      };
      if (!active) return;
      await recompute();

      // Realtime — refresh count whenever a message lands in any thread we know about.
      channelRef.current = supabase
        .channel("sidebar-unread")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const msg = payload.new as { thread_id: string; sender_profile_id: string };
            if (
              threadDataRef.current.has(msg.thread_id) &&
              msg.sender_profile_id !== userId
            ) {
              recompute();
            }
          }
        )
        .subscribe();
    }

    init();
    return () => {
      active = false;
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isChurch]);

  // When the user navigates away from a thread, the page render will have
  // updated last_read_at server-side. Refresh.
  useEffect(() => {
    if (!pathname.startsWith("/messages/")) {
      recompute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <aside className="sidebar" style={{
      borderRight: "1px solid var(--sm-border-subtle)",
      padding: "22px 18px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 28,
      position: "sticky",
      top: 0,
      height: "100vh",
      background: "var(--sm-bg-1)",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 14px", borderBottom: "1px solid var(--sm-border-subtle)" }}>
        <Image src="/assets/sm-logo-icon.svg" alt="" width={32} height={32} />
        <div>
          <div style={{ fontFamily: "var(--sm-font-logo)", fontWeight: 500, letterSpacing: "0.16em", fontSize: 13, textTransform: "uppercase", lineHeight: 1.1 }}>
            Sunday Musician
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--sm-fg-3)", textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>
            {isChurch ? "Church portal" : "Musician portal"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sm-fg-4)", fontWeight: 600, margin: "0 0 8px 8px" }}>Main</div>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const isMessages = href === "/messages";
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              borderRadius: "var(--sm-radius-sm)",
              color: active ? "var(--sm-fg-1)" : "var(--sm-fg-2)",
              background: active ? "var(--sm-bg-3)" : "transparent",
              textDecoration: "none",
              fontSize: 14.5,
              fontWeight: 500,
              transition: "background var(--sm-dur-base) var(--sm-ease), color var(--sm-dur-base) var(--sm-ease)",
            }}
              aria-current={active ? "page" : undefined}>
              <Icon style={{ width: 17, height: 17, flexShrink: 0, opacity: active ? 1 : 0.85, color: active ? "var(--sm-accent)" : "currentColor" }} />
              <span style={{ flex: 1 }}>{label}</span>
              {isMessages && unreadCount > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: "var(--sm-accent)", color: "#fff",
                  fontSize: 11, fontWeight: 700, lineHeight: "18px",
                  textAlign: "center", padding: "0 5px",
                  display: "inline-block",
                }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Church: new request CTA */}
      {isChurch && (
        <div>
          <Link href="/requests/new" className="btn btn--primary" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", textDecoration: "none" }}>
            <PlusIcon style={{ width: 14, height: 14 }} /> New request
          </Link>
        </div>
      )}

      {/* Bottom: avatar + profile + sign out */}
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--sm-border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, color: "var(--sm-fg-2)", flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sm-fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.display_name}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
            <Link href="/profile" style={{ fontSize: 12, color: "var(--sm-accent)", textDecoration: "none", fontWeight: 500 }}>
              My profile
            </Link>
            <span style={{ fontSize: 11, color: "var(--sm-fg-4)" }}>·</span>
            <button onClick={signOut} style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--sm-fg-3)", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function SearchIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
function InboxIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>;
}
function MsgIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function PlusIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>;
}
function CalendarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function StarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
