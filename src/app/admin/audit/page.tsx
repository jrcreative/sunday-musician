import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { DateCell, StatusPill } from "../_components/AdminPrimitives";

// Read-only timeline of every privileged admin action. Latest 500 rows.
// Filtering is by query param (?actor= / ?level= / ?action=) so admins can
// share filtered views via URL.

const LEVEL_TONE = {
  info: "neutral",
  success: "success",
  warn: "warn",
  danger: "error",
} as const;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; level?: string; action?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();

  let q = admin.from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (params.actor) q = q.eq("actor_email", params.actor);
  if (params.level) q = q.eq("level", params.level);
  if (params.action) q = q.eq("action", params.action);

  const { data: rows } = await q;

  return (
    <>
      <AdminTopbar title="Audit log" sub={`${(rows ?? []).length} entries`} />
      <div className="a-page">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--sm-fg-3)", fontSize: 12.5 }}>
                    <DateCell value={r.created_at} />
                  </td>
                  <td className="secondary">{r.actor_email}</td>
                  <td>
                    <code style={{ fontSize: 12, padding: "2px 6px", background: "var(--sm-bg-2)", borderRadius: 2 }}>
                      {r.action}
                    </code>
                  </td>
                  <td>
                    {r.target_label ?? r.target_id ?? "—"}
                    {r.target_type && (
                      <span className="secondary" style={{ marginLeft: 8 }}>· {r.target_type}</span>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={LEVEL_TONE[r.level as keyof typeof LEVEL_TONE] ?? "neutral"}>{r.level}</StatusPill>
                  </td>
                </tr>
              ))}
              {(rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
