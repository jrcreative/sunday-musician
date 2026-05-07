"use client";

// Hamburger button rendered inside Topbar. Hidden via CSS above the mobile
// breakpoint (.sm-menu-btn). Dispatches a custom event that AppShell listens
// for to toggle the drawer — keeps Topbar (server component) free of state.

export function MobileMenuButton() {
  return (
    <button
      type="button"
      className="sm-menu-btn"
      aria-label="Open menu"
      onClick={() => window.dispatchEvent(new CustomEvent("sm:toggle-sidebar"))}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}
