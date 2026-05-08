import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AdminUserFilters = {
  q: string;
  role: "all" | "church" | "musician";
  status: "all" | "active" | "suspended" | "unverified";
};

export async function fetchAdminUserRollups(admin: AdminClient, filters: AdminUserFilters) {
  let q = admin
    .from("admin_user_rollups")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.role !== "all") q = q.eq("role", filters.role);
  if (filters.status === "active") q = q.is("suspended_at", null);
  if (filters.status === "suspended") q = q.not("suspended_at", "is", null);
  if (filters.status === "unverified") q = q.eq("verified", false);
  if (filters.q.trim()) q = q.ilike("search_text", `%${filters.q.trim()}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDailyPaymentRollups(admin: AdminClient, startDay: string, endBeforeDay?: string) {
  let q = admin
    .from("admin_daily_payment_rollups")
    .select("day, gross_cents, platform_cents, captured_count")
    .gte("day", startDay);
  if (endBeforeDay) q = q.lt("day", endBeforeDay);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
