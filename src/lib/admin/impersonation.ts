import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_IMPERSONATION_COOKIE = "sm_admin_view_as";
export const ADMIN_IMPERSONATION_TTL_SECONDS = 60 * 60 * 2;

export type AdminImpersonationPayload = {
  adminId: string;
  targetId: string;
  exp: number;
};

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
}

function encode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signature(payload: string) {
  const key = secret();
  if (!key) throw new Error("Impersonation signing secret is not configured");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createAdminImpersonationToken(input: { adminId: string; targetId: string }) {
  const payload: AdminImpersonationPayload = {
    adminId: input.adminId,
    targetId: input.targetId,
    exp: Math.floor(Date.now() / 1000) + ADMIN_IMPERSONATION_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${signature(encodedPayload)}`;
}

export function verifyAdminImpersonationToken(token?: string | null): AdminImpersonationPayload | null {
  if (!token) return null;
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = signature(encodedPayload);
  const expected = Buffer.from(expectedSignature, "base64url");
  const provided = Buffer.from(providedSignature, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  const payload = JSON.parse(decode(encodedPayload)) as Partial<AdminImpersonationPayload>;
  if (!payload.adminId || !payload.targetId || !payload.exp) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return {
    adminId: payload.adminId,
    targetId: payload.targetId,
    exp: payload.exp,
  };
}
