import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  ADMIN_IMPERSONATION_COOKIE,
  verifyAdminImpersonationToken,
} from "@/lib/admin/impersonation";
import { createAdminClient } from "./admin";
import type { Database } from "./types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export type ActiveImpersonation = {
  adminId: string;
  targetId: string;
  expiresAt: string;
  target: {
    id: string;
    email: string;
    display_name: string;
    role: "church" | "musician";
  };
};

type CreateClientOptions = {
  bypassImpersonation?: boolean;
};

function createSessionClient(cookieStore: CookieStore) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function impersonatedUser(target: ActiveImpersonation["target"]): User {
  return {
    id: target.id,
    aud: "authenticated",
    role: "authenticated",
    email: target.email,
    app_metadata: {},
    user_metadata: {
      role: target.role,
      display_name: target.display_name,
    },
    created_at: "",
  } as User;
}

async function resolveImpersonation(
  cookieStore: CookieStore,
  sessionClient: ReturnType<typeof createSessionClient>,
): Promise<ActiveImpersonation | null> {
  const payload = verifyAdminImpersonationToken(cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value);
  if (!payload) return null;

  const { data: { user: actor } } = await sessionClient.auth.getUser();
  if (!actor || actor.id !== payload.adminId) return null;

  const admin = createAdminClient();
  const [{ data: actorProfile }, { data: targetProfile }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, is_admin, deleted_at, suspended_at")
      .eq("id", payload.adminId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, email, display_name, role, deleted_at")
      .eq("id", payload.targetId)
      .maybeSingle(),
  ]);

  if (!actorProfile?.is_admin || actorProfile.deleted_at || actorProfile.suspended_at) return null;
  if (!targetProfile || targetProfile.deleted_at) return null;

  return {
    adminId: payload.adminId,
    targetId: payload.targetId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    target: {
      id: targetProfile.id,
      email: targetProfile.email,
      display_name: targetProfile.display_name,
      role: targetProfile.role,
    },
  };
}

export async function getActiveImpersonation() {
  const cookieStore = await cookies();
  return resolveImpersonation(cookieStore, createSessionClient(cookieStore));
}

export async function createClient(options: CreateClientOptions = {}) {
  const cookieStore = await cookies();
  const sessionClient = createSessionClient(cookieStore);
  if (options.bypassImpersonation) return sessionClient;

  const impersonation = await resolveImpersonation(cookieStore, sessionClient);
  if (!impersonation) return sessionClient;

  const adminClient = createAdminClient();
  const user = impersonatedUser(impersonation.target);
  adminClient.auth.getUser = async () => ({ data: { user }, error: null });
  return adminClient;
}
