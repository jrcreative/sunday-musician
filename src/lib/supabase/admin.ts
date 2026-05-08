import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role Supabase client for trusted server-side mutations (Stripe
// webhooks, cron, payment lifecycle). Always validate ownership at the API
// layer before using this — RLS is bypassed.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service env not configured");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
