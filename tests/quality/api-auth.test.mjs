import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the active-user gate blocks deleted and suspended accounts", () => {
  const source = read("src/lib/api/active-user.ts");

  assert.match(source, /supabase\.auth\.getUser\(\)/, "the gate must resolve the session user server-side");
  assert.match(source, /deleted_at/, "deleted accounts must be rejected before privileged work");
  assert.match(source, /suspended_at/, "suspended accounts must be rejected before privileged work");
  assert.match(source, /status: 401/, "anonymous callers must get 401");
  assert.match(source, /status: 403/, "deleted or suspended accounts must get 403");
});

test("user-initiated payment routes pass through the active-user gate", () => {
  // These routes use the service-role client after auth, so RLS does not
  // protect them — requireActiveUser is the only gate.
  for (const path of [
    "src/app/api/stripe/payment-method/route.ts",
    "src/app/api/stripe/setup-intent/route.ts",
    "src/app/api/stripe/connect/onboard/route.ts",
    "src/app/api/stripe/connect/dashboard/route.ts",
    "src/app/api/proposals/accept/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /requireActiveUser\(\)/, `${path} must gate on an active user`);
    assert.match(source, /if \(!active\.ok\) return active\.response/, `${path} must return the gate's error response`);
  }
});

test("account deletion and export authenticate the real user, not an impersonator", () => {
  for (const path of [
    "src/app/api/account/delete/route.ts",
    "src/app/api/account/export/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /createClient\(\{ bypassImpersonation: true \}\)/, `${path} must not act on behalf of an admin impersonation session`);
    assert.match(source, /supabase\.auth\.getUser\(\)/, `${path} must verify the session user`);
  }
});
