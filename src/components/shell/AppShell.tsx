"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ShellImpersonation = {
  target: {
    display_name: string;
    email: string;
  };
};

// Wraps the app layout with mobile-drawer affordances. Owns the open state
// for the sidebar; pages dispatch `sm:toggle-sidebar` from the Topbar
// hamburger to open it. Closes on route change, Escape, and backdrop tap.

export function AppShell({
  profile,
  userId,
  impersonation,
  children,
}: {
  profile: Profile | null;
  userId: string;
  impersonation: ShellImpersonation | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Close on route change. Using the "store previous prop" pattern (a render-
  // phase setState gated by inequality) instead of an effect — avoids the
  // cascading-render anti-pattern flagged by react-hooks/set-state-in-effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Toggle event from MobileMenuButton (rendered inside Topbar)
  useEffect(() => {
    const onToggle = () => setOpen(o => !o);
    window.addEventListener("sm:toggle-sidebar", onToggle);
    return () => window.removeEventListener("sm:toggle-sidebar", onToggle);
  }, []);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function stopImpersonating() {
    if (stopping) return;
    setStopping(true);
    try {
      const res = await fetch("/api/admin/impersonation/stop", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.assign(json.redirectTo ?? "/admin/users");
        return;
      }
      router.refresh();
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className={`sm-app${open ? " sidebar-open" : ""}`}>
      <Sidebar profile={profile} userId={userId} />
      <div
        className="sm-sidebar-backdrop"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <main className="main sm-main">
        {impersonation && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: "9px 16px",
            borderBottom: "1px solid rgba(184,33,5,0.22)",
            background: "rgba(184,33,5,0.07)",
            color: "var(--sm-status-error, #b82105)",
            fontSize: 13,
            lineHeight: 1.35,
          }}>
            <div style={{ minWidth: 0 }}>
              Viewing as <strong>{impersonation.target.display_name}</strong>
              <span style={{ color: "var(--sm-fg-3)" }}> · {impersonation.target.email}</span>
            </div>
            <button
              type="button"
              className="btn btn--sm"
              onClick={stopImpersonating}
              disabled={stopping}
              style={{ whiteSpace: "nowrap" }}
            >
              {stopping ? "Stopping..." : "Stop viewing"}
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
