import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const cronDir = new URL("../../src/app/api/cron/", import.meta.url);

// Discovers cron routes dynamically so a new cron added without auth fails
// this test instead of shipping an open endpoint.
test("every cron route requires the bearer secret", () => {
  const jobs = readdirSync(cronDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  assert.ok(jobs.length >= 5, "cron route discovery should find the known jobs");

  for (const job of jobs) {
    const source = read(`src/app/api/cron/${job}/route.ts`);

    assert.match(source, /process\.env\.CRON_SECRET/, `${job} must read CRON_SECRET`);
    assert.match(source, /CRON_SECRET not configured/, `${job} must fail closed when the secret is missing`);
    assert.match(source, /Bearer \$\{secret\}/, `${job} must compare the full bearer token`);
    assert.match(source, /status: 401/, `${job} must reject unauthorized callers`);
    assert.match(source, /dynamic = "force-dynamic"/, `${job} must opt out of static rendering`);
    assert.match(source, /export async function GET/, `${job} must export GET — Vercel cron invokes with GET`);
  }
});

// Crons only run if vercel.json schedules them. A cron route that exists but
// isn't scheduled silently never runs in production.
test("every cron route is scheduled in vercel.json", () => {
  const jobs = readdirSync(cronDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  const config = JSON.parse(read("vercel.json"));
  const scheduledPaths = new Set((config.crons ?? []).map(c => c.path));

  for (const job of jobs) {
    assert.ok(
      scheduledPaths.has(`/api/cron/${job}`),
      `vercel.json must schedule /api/cron/${job} or it never runs in production`,
    );
  }

  for (const cron of config.crons ?? []) {
    assert.match(cron.schedule ?? "", /^(\S+\s+){4}\S+$/, `${cron.path} must have a five-field cron schedule`);
  }
});
