import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTopbar } from "../AdminTopbar";
import { UsersClient, type UserRow } from "./UsersClient";

// Lists every live profile with denormalized booking volume + spend/earn.
// We do the join in two queries (profile + their side, payments) and
// stitch the totals in JS — small N for now; if this list ever crosses
// a few thousand rows we'll move the totals into a view.

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: musicianProfiles }, { data: churchProfiles }, { data: payments }] = await Promise.all([
    admin.from("profiles")
      .select("id, role, display_name, email, suspended_at, verified, deleted_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin.from("musician_profiles").select("id, profile_id, city, state"),
    admin.from("church_profiles").select("id, profile_id, city, state, church_name"),
    admin.from("payments").select("musician_profile_id, church_profile_id, musician_amount, charge_total, status"),
  ]);

  const musicianByProfile = new Map((musicianProfiles ?? []).map(m => [m.profile_id, m]));
  const churchByProfile = new Map((churchProfiles ?? []).map(c => [c.profile_id, c]));

  const musicianStats = new Map<string, { bookings: number; amount: number }>();
  const churchStats = new Map<string, { bookings: number; amount: number }>();
  for (const p of payments ?? []) {
    if (p.status !== "captured") continue;
    const m = musicianStats.get(p.musician_profile_id) ?? { bookings: 0, amount: 0 };
    m.bookings += 1; m.amount += p.musician_amount;
    musicianStats.set(p.musician_profile_id, m);
    const c = churchStats.get(p.church_profile_id) ?? { bookings: 0, amount: 0 };
    c.bookings += 1; c.amount += p.charge_total;
    churchStats.set(p.church_profile_id, c);
  }

  const rows: UserRow[] = (profiles ?? []).map(p => {
    if (p.role === "musician") {
      const mp = musicianByProfile.get(p.id);
      const stats = mp ? musicianStats.get(mp.id) ?? { bookings: 0, amount: 0 } : { bookings: 0, amount: 0 };
      return {
        id: p.id,
        role: "musician",
        name: p.display_name,
        email: p.email,
        city: mp?.city ?? "",
        state: mp?.state ?? "",
        joined: p.created_at,
        suspended_at: p.suspended_at,
        verified: p.verified,
        bookings: stats.bookings,
        amount: Math.round(stats.amount / 100),
      };
    }
    const cp = churchByProfile.get(p.id);
    const stats = cp ? churchStats.get(cp.id) ?? { bookings: 0, amount: 0 } : { bookings: 0, amount: 0 };
    return {
      id: p.id,
      role: "church",
      name: cp?.church_name ?? p.display_name,
      email: p.email,
      city: cp?.city ?? "",
      state: cp?.state ?? "",
      joined: p.created_at,
      suspended_at: p.suspended_at,
      verified: p.verified,
      bookings: stats.bookings,
      amount: Math.round(stats.amount / 100),
    };
  });

  return (
    <>
      <AdminTopbar title="User accounts" sub={`${rows.length} live`} />
      <UsersClient rows={rows} />
    </>
  );
}
