import type { Config } from "@netlify/functions";

// Daily at 13:00 UTC (early morning in US time zones). The capture route is
// idempotent — it claims rows before processing.

const handler = async () => {
  const siteUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    return new Response(
      JSON.stringify({ error: "URL or CRON_SECRET not configured" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const res = await fetch(`${siteUrl}/api/cron/capture-payments`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export default handler;

export const config: Config = {
  schedule: "0 13 * * *",
};
