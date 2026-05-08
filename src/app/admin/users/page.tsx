import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { UsersClient, type UserFilter, type UserRow } from "./UsersClient";
import { fetchAdminUserRollups } from "../_lib/queries";

// Lists every live profile with denormalized booking volume + spend/earn.
// We do the join in two queries (profile + their side, payments) and
// stitch the totals in JS — small N for now; if this list ever crosses
// a few thousand rows we'll move the totals into a view.

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filters: UserFilter = {
    q: params.q ?? "",
    role: params.role === "church" || params.role === "musician" ? params.role : "all",
    status: params.status === "active" || params.status === "suspended" || params.status === "unverified" ? params.status : "all",
  };
  const admin = createAdminClient();

  const rollups = await fetchAdminUserRollups(admin, filters);
  const rows: UserRow[] = (rollups ?? []).map(r => ({
    id: r.id,
    role: r.role,
    name: r.name,
    email: r.email,
    city: r.city,
    state: r.state,
    joined: r.created_at,
    suspended_at: r.suspended_at,
    is_admin: r.is_admin,
    verified: r.verified,
    bookings: r.bookings,
    amount: Math.round(r.amount_cents / 100),
  }));

  return (
    <>
      <AdminTopbar title="User accounts" sub={`${rows.length} live`} />
      <UsersClient rows={rows} initialFilter={filters} />
    </>
  );
}
