import type { Config } from "@netlify/functions";

// Hourly pinger: hits our internal cron endpoint with the bearer secret.
// All sync logic lives in src/app/api/cron/sync-calendars/route.ts so we have
// one source of truth that's also testable via curl.

export default async () => {
  const siteUrl = process.env.URL;          // set automatically by Netlify
  const secret = process.env.CRON_SECRET;   // set in Netlify env vars

  if (!siteUrl || !secret) {
    return new Response(
      JSON.stringify({ error: "URL or CRON_SECRET not configured" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const res = await fetch(`${siteUrl}/api/cron/sync-calendars`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "@hourly",
};
