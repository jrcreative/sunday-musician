import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const authDir = new URL("../../src/app/auth/", import.meta.url);

// The Supabase calls that let an anonymous caller create an account or make us
// send mail. Bots hit these directly — the browser talks to Supabase, so no
// Vercel-side rule sits in the path and the captcha token is the only control.
const GUARDED_CALLS = ["signUp", "signInWithPassword", "resetPasswordForEmail"];

// Discovered rather than listed, so a new auth page added without a captcha
// fails here instead of shipping an open endpoint.
function authPagesCallingSupabase() {
  return readdirSync(authDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({ name: entry.name, path: `src/app/auth/${entry.name}/page.tsx` }))
    .map(page => {
      let source;
      try { source = read(page.path); } catch { return null; }
      const calls = GUARDED_CALLS.filter(call => source.includes(`auth.${call}(`));
      return calls.length ? { ...page, source, calls } : null;
    })
    .filter(Boolean);
}

test("every anonymous auth entry point sends a captcha token", () => {
  const pages = authPagesCallingSupabase();
  assert.ok(pages.length >= 3, "should find signup, login and forgot-password");

  for (const page of pages) {
    // Match the wiring that actually reaches Supabase, not merely the word
    // "captchaToken" — the state declarations contain that either way.
    assert.match(page.source, /captchaToken: captchaToken \?\? undefined/,
      `${page.name} calls ${page.calls.join("/")} and must pass the token into the Supabase call`);
    assert.match(page.source, /from "@\/components\/Turnstile"/,
      `${page.name} must render the Turnstile widget that produces the token`);
  }
});

// Turnstile tokens are single-use. A form that does not reset the widget after a
// rejected submit strands the user: every retry replays a spent token.
test("a rejected submit resets the captcha so retries work", () => {
  for (const page of authPagesCallingSupabase()) {
    assert.match(page.source, /setCaptchaKey\(k => k \+ 1\)/,
      `${page.name} must bump resetKey on error to mint a fresh token`);
    assert.match(page.source, /setCaptchaToken\(null\)/,
      `${page.name} must clear the spent token on error`);
  }
});

// A missing site key must hide the widget rather than block submission —
// enforcement lives in Supabase, so degrading open here keeps dev usable
// without weakening production.
test("the widget no-ops when the site key is unset", () => {
  const source = read("src/components/Turnstile.tsx");
  assert.match(source, /if \(!TURNSTILE_SITE_KEY\) return null/,
    "Turnstile must render nothing without a site key");

  for (const page of authPagesCallingSupabase()) {
    assert.match(page.source, /!!TURNSTILE_SITE_KEY && !captchaToken/,
      `${page.name} must only gate its submit button when a site key is configured`);
  }
});
