import Link from "next/link";

interface Crumb { label: string; href?: string; }

interface TopbarProps {
  title: string;
  crumbs?: Crumb[];
  right?: React.ReactNode;
}

export function Topbar({ title, crumbs, right }: TopbarProps) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 32px",
      borderBottom: "1px solid var(--sm-border-subtle)",
      background: "var(--sm-bg-1)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div>
        {crumbs && crumbs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--sm-fg-3)", marginBottom: 2 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.href ? <Link href={c.href} style={{ color: "var(--sm-fg-3)", textDecoration: "none" }}>{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevRight />}
              </span>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: "-0.005em" }}>{title}</h1>
      </div>
      {right && <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>{right}</div>}
    </header>
  );
}

function ChevRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
