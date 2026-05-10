import Link from "next/link";
import { MobileMenuButton } from "./MobileMenuButton";

interface Crumb { label: string; href?: string; }

interface TopbarProps {
  title: string;
  crumbs?: Crumb[];
  right?: React.ReactNode;
}

export function Topbar({ title, crumbs, right }: TopbarProps) {
  return (
    <header className="sm-topbar">
      <MobileMenuButton />
      <div className="sm-topbar-title">
        {crumbs && crumbs.length > 0 && (
          <div className="sm-only-desktop" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--sm-fg-3)", marginBottom: 2 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.href ? <Link href={c.href} style={{ color: "var(--sm-fg-3)", textDecoration: "none" }}>{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevRight />}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
      </div>
      {right && <div className="sm-topbar-right">{right}</div>}
    </header>
  );
}

function ChevRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
