import type { Config } from "@netlify/functions";

// Daily at 03:00 UTC — pings the archive-threads cron route to clean up
// past-service and stale conversations.

export default async () => {
  const siteUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    return new Response(
      JSON.stringify({ error: "URL or CRON_SECRET not configured" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const res = await fetch(`${siteUrl}/api/cron/archive-threads`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "0 3 * * *",
};
