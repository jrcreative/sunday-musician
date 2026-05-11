"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

const HOME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const USERS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const CARD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);
const LOG_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
  </svg>
);
const ALERT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const CHART_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const MATCH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 7h8"/>
    <path d="M8 17h8"/>
    <path d="M7 7a3 3 0 1 1-3-3"/>
    <path d="M17 17a3 3 0 1 0 3 3"/>
    <path d="M4 4v5h5"/>
    <path d="M20 20v-5h-5"/>
  </svg>
);
const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="m3 7 9 6 9-6"/>
  </svg>
);

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: HOME_ICON },
      { href: "/admin/liquidity", label: "Liquidity", icon: CHART_ICON },
      { href: "/admin/match", label: "Match assist", icon: MATCH_ICON },
    ],
  },
  {
    group: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: USERS_ICON },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CARD_ICON },
    ],
  },
  {
    group: "Compliance",
    items: [
      { href: "/admin/trust-safety", label: "Trust & safety", icon: ALERT_ICON },
      { href: "/admin/disputes", label: "Disputes", icon: ALERT_ICON },
      {
        href: "/admin/emails",
        label: "Emails",
        icon: MAIL_ICON,
        children: [
          { href: "/admin/emails", label: "Overview & log" },
          { href: "/admin/emails/triggers", label: "Triggers" },
        ],
      },
      { href: "/admin/audit", label: "Audit log", icon: LOG_ICON },
    ],
  },
];

export function AdminSidebar({
  actorEmail,
}: {
  actorEmail: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="a-sidebar">
      <Link href="/admin" className="a-brand" style={{ textDecoration: "none", color: "inherit" }}>
        <div>
          <div className="wm">Sunday Musician</div>
          <div className="role"><span className="pill-mini">Admin</span></div>
        </div>
      </Link>

      {NAV.map(g => (
        <nav key={g.group} className="a-nav" aria-label={g.group}>
          <h4>{g.group}</h4>
          {g.items.map(item => {
            const active = item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const childActive = item.children?.some(child => pathname === child.href) ?? false;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="a-nav-item"
                  data-parent-active={active ? "true" : undefined}
                  aria-current={active && !childActive ? "page" : undefined}
                >
                  {item.icon}
                  {item.label}
                </Link>
                {item.children && active && (
                  <div className="a-nav-children">
                    {item.children.map(child => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="a-nav-child"
                          aria-current={isActive ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      ))}

      <div className="footer">
        <div className="av av-2" aria-hidden style={{ width: 30, height: 30, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
          {actorEmail.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, fontSize: 12.5 }}>
          <div style={{ fontWeight: 600, color: "var(--sm-fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{actorEmail}</div>
          <Link href="/dashboard" style={{ color: "var(--sm-fg-3)", textDecoration: "none" }}>← Back to app</Link>
        </div>
      </div>
    </aside>
  );
}
