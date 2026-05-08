"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Wraps the app layout with mobile-drawer affordances. Owns the open state
// for the sidebar; pages dispatch `sm:toggle-sidebar` from the Topbar
// hamburger to open it. Closes on route change, Escape, and backdrop tap.

export function AppShell({
  profile,
  userId,
  children,
}: {
  profile: Profile | null;
  userId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

  return (
    <div className={`sm-app${open ? " sidebar-open" : ""}`}>
      <Sidebar profile={profile} userId={userId} />
      <div
        className="sm-sidebar-backdrop"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <main className="main" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}
