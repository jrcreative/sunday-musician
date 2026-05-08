import Link from "next/link";

export function Money({
  cents,
  maximumFractionDigits = 0,
}: {
  cents: number | null | undefined;
  maximumFractionDigits?: number;
}) {
  const dollars = (cents ?? 0) / 100;
  return <>${dollars.toLocaleString(undefined, { maximumFractionDigits })}</>;
}

export function DateCell({ value }: { value: string | null | undefined }) {
  if (!value) return <>—</>;
  return (
    <>
      {new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </>
  );
}

const PILL_CLASSES = {
  neutral: "a-pill",
  success: "a-pill a-pill--success",
  info: "a-pill a-pill--info",
  warn: "a-pill a-pill--warn",
  error: "a-pill a-pill--error",
  accent: "a-pill a-pill--accent",
} as const;

export function StatusPill({
  children,
  tone = "neutral",
  href,
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_CLASSES;
  href?: string;
}) {
  const cls = PILL_CLASSES[tone];
  if (href) {
    return (
      <Link href={href} className={cls} style={{ textDecoration: "none" }}>
        {children}
      </Link>
    );
  }
  return <span className={cls}>{children}</span>;
}

export function KpiCard({
  label,
  value,
  context,
  delta,
  children,
}: {
  label: string;
  value: React.ReactNode;
  context?: string;
  delta?: { value: number; dir: "up" | "down" | "flat" };
  children?: React.ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="val">{value}</div>
      <div className="row">
        <div className={`delta ${delta?.dir ?? "flat"}`}>
          {!delta || delta.dir === "flat" ? "—" : `${delta.dir === "up" ? "↑" : "↓"} ${delta.value}%`}
        </div>
        {context && <div className="ctx">{context}</div>}
      </div>
      {children}
    </div>
  );
}

export function AdminTable({
  toolbar,
  headers,
  empty,
  children,
}: {
  toolbar?: React.ReactNode;
  headers: React.ReactNode[];
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="a-table-wrap">
      {toolbar && <div className="a-table-toolbar">{toolbar}</div>}
      <table className="a-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {children || (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                {empty ?? "No rows."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DrawerAction({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="action-row">
      <div>
        <div className="label" style={danger ? { color: "var(--sm-status-error, #b82105)" } : undefined}>{title}</div>
        <div className="desc">{description}</div>
      </div>
      <div className="right">{children}</div>
    </div>
  );
}
