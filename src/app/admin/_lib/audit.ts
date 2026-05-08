import { createAdminClient } from "@/lib/supabase/admin";

// Append a row to admin_actions. For privileged work, an audit write is part
// of the operation, not telemetry. Fail hard if the row cannot be written so
// callers never report success for an unaudited admin action.
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
    throw new Error(`Audit log write failed: ${error.message}`);
  }
}
