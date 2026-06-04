import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Common gate for /api/admin/* routes. Returns the actor's id+email if
// they're an admin, or a NextResponse to short-circuit the handler.
export async function requireAdmin(): Promise<
  | { ok: true; actor: { id: string; email: string } }
  | { ok: false; response: Response }
> {
  const supabase = await createClient({ bypassImpersonation: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email, deleted_at, suspended_at")
    .eq("id", user.id)
    .single();
  if (!profile || profile.deleted_at || profile.suspended_at || !profile.is_admin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, actor: { id: user.id, email: profile.email ?? user.email ?? "" } };
}
