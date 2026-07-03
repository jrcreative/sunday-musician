import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("imported musicians can claim accounts through password reset", () => {
  const login = read("src/app/auth/login/page.tsx");
  const forgot = read("src/app/auth/forgot-password/page.tsx");
  const reset = read("src/app/auth/reset-password/page.tsx");
  const callback = read("src/app/auth/callback/route.ts");

  assert.match(login, /href="\/auth\/forgot-password"/, "login page must expose the recovery flow");
  assert.match(forgot, /resetPasswordForEmail/, "forgot-password page must request a Supabase recovery email");
  assert.match(forgot, /\/auth\/callback\?next=\/auth\/reset-password/, "recovery links must land in the reset page after session exchange");
  assert.match(reset, /updateUser\(\{ password/, "reset-password page must set the authenticated user's password");
  assert.match(reset, /auth\/login/, "successful password resets should return users to sign in");
  assert.match(callback, /next !== "\/auth\/reset-password"/, "password recovery callbacks must not trigger onboarding emails");
});
