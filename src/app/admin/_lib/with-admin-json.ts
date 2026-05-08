import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/api/handler";
import { requireAdmin } from "./require-admin";

type AdminContext = {
  actor: { id: string; email: string };
  admin: ReturnType<typeof createAdminClient>;
};

// Common wrapper for /api/admin/* routes: JSON error boundary, active admin
// gate, and service-role client creation in one place.
export function withAdminJson<Args extends unknown[]>(
  handler: (ctx: AdminContext, ...args: Args) => Promise<Response>,
) {
  return withJsonErrors(async (...args: Args) => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;
    return handler({ actor: gate.actor, admin: createAdminClient() }, ...args);
  });
}
