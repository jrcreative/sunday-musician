import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("transactional email delivery is deduplicated and preference-gated", () => {
  const source = read("src/lib/email/delivery.ts");

  assert.match(source, /dedupe_key: input\.dedupeKey/, "every delivery row must carry its dedupe key");
  assert.match(source, /23505/, "unique-violation on the dedupe key must be treated as an intentional skip, not an error");
  assert.match(source, /category === "critical" \|\| !recipientProfileId/, "critical emails must bypass user preferences");
  assert.match(source, /notification_preferences/, "non-critical emails must honor user notification preferences");
  assert.match(source, /missing_recipient/, "blank recipients must be skipped, not sent to the provider");
  assert.match(source, /status: "sending"/, "the delivery row must be claimed before calling the provider so retries dedupe");

  const migration = read("supabase/migrations/20260515_transactional_email_deliveries.sql");
  assert.match(migration, /dedupe_key text not null unique/, "dedupe must be enforced by a database unique constraint");
});
