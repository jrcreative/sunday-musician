"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DrawerAction, StatusPill } from "../_components/AdminPrimitives";

export type UserRow = {
  id: string;
  role: "church" | "musician";
  name: string;
  email: string;
  city: string;
  state: string;
  joined: string;             // ISO
  suspended_at: string | null;
  is_admin: boolean;
  verified: boolean;
  bookings: number;
  amount: number;             // dollars total — earned (musician) or spent (church)
};

export type UserFilter = {
  q: string;
  role: "all" | "church" | "musician";
  status: "all" | "active" | "suspended" | "unverified";
};

export function UsersClient({ rows: initialRows, initialFilter }: { rows: UserRow[]; initialFilter: UserFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<UserRow[]>(initialRows);
  const [f, setF] = useState<UserFilter>(initialFilter);
  const [active, setActive] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function setFilter(patch: Partial<UserFilter>) {
    const next = { ...f, ...patch };
    setF(next);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.role !== "all") params.set("role", next.role);
    if (next.status !== "all") params.set("status", next.status);
    startTransition(() => {
      router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  const filtered = useMemo(() => rows, [rows]);

  function patchUser(id: string, patch: Partial<UserRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setActive(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="a-page">
        <div className="a-table-wrap">
          <div className="a-table-toolbar">
            <input
              className="input"
              placeholder="Search name, email, city…"
              value={f.q}
              onChange={e => setFilter({ q: e.target.value })}
              style={{ width: 260, padding: "7px 10px" }}
            />
            <select className="select" value={f.role} onChange={e => setFilter({ role: e.target.value as UserFilter["role"] })}
              style={{ width: 140, padding: "7px 10px" }}>
              <option value="all">All roles</option>
              <option value="church">Churches</option>
              <option value="musician">Musicians</option>
            </select>
            <select className="select" value={f.status} onChange={e => setFilter({ status: e.target.value as UserFilter["status"] })}
              style={{ width: 160, padding: "7px 10px" }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="unverified">Unverified</option>
            </select>
            <div className="right">
              <span className="count"><strong>{filtered.length}</strong> {filtered.length === 1 ? "user" : "users"}</span>
            </div>
          </div>
          <table className="a-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Location</th>
                <th>Status</th>
                <th className="num">Bookings</th>
                <th className="num">Volume</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.id}
                  data-selected={active?.id === r.id}
                  onClick={() => setActive(r)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div className="name-cell">
                      <div>
                        <div className="name">
                          {r.name}
                          {r.verified && (
                            <span title="Verified" style={{ marginLeft: 6, color: "var(--sm-status-success)" }}>✓</span>
                          )}
                        </div>
                        <div className="secondary">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={r.role === "church" ? "info" : "accent"}>{r.role}</StatusPill>
                  </td>
                  <td className="secondary">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>
                    {r.suspended_at
                      ? <StatusPill tone="error">Suspended</StatusPill>
                      : <StatusPill tone="success">Active</StatusPill>}
                  </td>
                  <td className="num">{r.bookings}</td>
                  <td className="num">${r.amount.toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px 12px", color: "var(--sm-fg-3)" }}>
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <UserDrawer
          user={active}
          onClose={() => setActive(null)}
          onUpdate={(patch) => patchUser(active.id, patch)}
          onToast={showToast}
        />
      )}

      {toast && <div className="a-toast">{toast}</div>}
    </>
  );
}

function UserDrawer({
  user,
  onClose,
  onUpdate,
  onToast,
}: {
  user: UserRow;
  onClose: () => void;
  onUpdate: (patch: Partial<UserRow>) => void;
  onToast: (msg: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function call(action: string, path: string, body?: object): Promise<unknown> {
    setPending(action);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(json.error ?? `${action} failed`);
        return null;
      }
      return json;
    } finally {
      setPending(null);
    }
  }

  async function resetPassword() {
    const ok = await call("reset", `/api/admin/users/${user.id}/reset-password`);
    if (ok) onToast(`Password reset email sent to ${user.email}`);
  }

  async function toggleSuspend() {
    const newSuspended = !user.suspended_at;
    if (newSuspended && !confirm(`Suspend ${user.name}? They'll be unable to post or message.`)) return;
    if (newSuspended && user.is_admin) {
      onToast("Admin accounts cannot be suspended.");
      return;
    }
    const result = await call("suspend", `/api/admin/users/${user.id}/suspend`, {
      suspended: newSuspended,
      reason: newSuspended ? reason || null : null,
    });
    if (result) {
      onUpdate({ suspended_at: newSuspended ? new Date().toISOString() : null });
      onToast(newSuspended ? `${user.name} suspended` : `${user.name} unsuspended`);
    }
  }

  async function toggleVerify() {
    const result = await call("verify", `/api/admin/users/${user.id}/verify`, {
      verified: !user.verified,
    });
    if (result) {
      onUpdate({ verified: !user.verified });
      onToast(user.verified ? `${user.name} unverified` : `${user.name} verified`);
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="User details">
        <div className="drawer-head">
          <div>
            <h2>{user.name}</h2>
            <div className="sub">{user.role} · {user.email}</div>
          </div>
          <button className="x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          <div className="section-h">Profile</div>
          <dl className="dl-grid">
            <dt>Role</dt><dd style={{ textTransform: "capitalize" }}>{user.role}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Location</dt><dd>{[user.city, user.state].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Joined</dt><dd>{new Date(user.joined).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>
            <dt>Status</dt>
            <dd>
              {user.suspended_at
                ? <StatusPill tone="error">Suspended</StatusPill>
                : <StatusPill tone="success">Active</StatusPill>}
              {" "}
              {user.verified
                ? <StatusPill tone="success">Verified</StatusPill>
                : <StatusPill>Unverified</StatusPill>}
              {" "}
              {user.is_admin && <StatusPill tone="accent">Admin</StatusPill>}
            </dd>
            <dt>Bookings</dt><dd>{user.bookings}</dd>
            <dt>{user.role === "musician" ? "Earned" : "Spent"}</dt><dd>${user.amount.toLocaleString()}</dd>
          </dl>

          <div className="section-h">Actions</div>

          <DrawerAction title="Send password reset" description={`Emails a reset link to ${user.email}.`}>
              <button className="btn btn--sm" disabled={!!pending} onClick={resetPassword}>
                {pending === "reset" ? "Sending…" : "Send"}
              </button>
          </DrawerAction>

          <DrawerAction title={`${user.verified ? "Unverify" : "Verify"} account`} description="Toggle the verified badge shown on their profile.">
              <button className="btn btn--sm" disabled={!!pending} onClick={toggleVerify}>
                {pending === "verify" ? "…" : user.verified ? "Unverify" : "Verify"}
              </button>
          </DrawerAction>

          <div className="action-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div>
              <div className="label">{user.suspended_at ? "Unsuspend" : "Suspend"} user</div>
              <div className="desc">
                {user.suspended_at
                  ? "Restores ability to post requests and message."
                  : "Blocks them from posting requests or sending messages. They can still sign in to read the reason."}
              </div>
            </div>
            {!user.suspended_at && (
              <input
                className="input"
                placeholder="Reason (visible only to admins)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn--sm"
                disabled={!!pending || (!user.suspended_at && user.is_admin)}
                onClick={toggleSuspend}
                style={{
                  background: !user.suspended_at ? "var(--sm-status-error, #b82105)" : undefined,
                  color: !user.suspended_at ? "white" : undefined,
                  borderColor: !user.suspended_at ? "var(--sm-status-error, #b82105)" : undefined,
                }}
              >
                {pending === "suspend" ? "…" : user.suspended_at ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
