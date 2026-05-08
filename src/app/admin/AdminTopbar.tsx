// Server component — title comes from the page that wraps it.

export function AdminTopbar({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="a-topbar">
      <h1>{title}</h1>
      {sub && <span className="sub">· {sub}</span>}
      {right && <div className="right">{right}</div>}
    </div>
  );
}
