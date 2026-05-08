import { createAdminClient } from "@/lib/supabase/admin";

// Append a row to admin_actions. Always called from an /api/admin/*
// route after the privileged mutation succeeds. Failure to write the
// audit row is logged but does not block the user-facing response —
// the alternative would be losing the actual mutation's result on a
// secondary write failure.
export async function logAdminAction(input: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType?: "user" | "request" | "payment" | "platform" | null;
  targetId?: string | null;
  targetLabel?: string | null;
  level?: "info" | "warn" | "success" | "danger";
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_actions").insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    target_label: input.targetLabel ?? null,
    level: input.level ?? "info",
    metadata: (input.metadata ?? {}) as never,
  });
  if (error) {
    console.error("[admin] audit log write failed", error);
  }
}
