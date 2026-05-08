import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ActiveUser = {
  id: string;
  email: string;
  role: "church" | "musician";
};

// Shared gate for user-initiated API routes that later use the service-role
// client. RLS no longer protects those writes, so suspension/deletion must be
// checked before privileged work starts.
export async function requireActiveUser(): Promise<
  | { ok: true; user: ActiveUser }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, deleted_at, suspended_at, suspend_reason")
    .eq("id", user.id)
    .single();

  if (!profile || profile.deleted_at) {
    return { ok: false, response: NextResponse.json({ error: "Account unavailable" }, { status: 403 }) };
  }

  if (profile.suspended_at) {
    return {
      ok: false,
      response: NextResponse.json({
        error: profile.suspend_reason
          ? `Your account is suspended: ${profile.suspend_reason}`
          : "Your account is suspended. Contact support.",
        code: "account_suspended",
      }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: profile.email ?? user.email ?? "",
      role: profile.role,
    },
  };
}
