// Verifies that launch-reset app tables are empty through PostgREST.
//
//   npm run data:check-clear

try { process.loadEnvFile(".env.local"); } catch { /* env already in shell */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
const storageUrl = `${url.replace(/\/$/, "")}/storage/v1`;
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  prefer: "count=exact",
};

const tables = [
  "admin_actions",
  "email_deliveries",
  "booking_disputes",
  "payments",
  "reviews",
  "review_periods",
  "bookings",
  "request_match_dismissals",
  "applications",
  "messages",
  "threads",
  "service_requests",
  "stripe_accounts",
  "stripe_customers",
  "calendar_connections",
  "unavailability_blocks",
  "notification_preferences",
  "musician_profiles",
  "church_profiles",
  "profiles",
];

async function countRows(table) {
  const response = await fetch(`${restUrl}/${table}?select=*&limit=1`, {
    headers,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${text || response.statusText}`);
  }

  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  if (!Number.isFinite(total)) {
    throw new Error(`${table}: could not parse count from content-range "${range}"`);
  }

  return total;
}

async function listAvatarObjects(prefix = "") {
  const response = await fetch(`${storageUrl}/object/list/avatars`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`avatars: ${response.status} ${text || response.statusText}`);
  }

  const entries = text ? JSON.parse(text) : [];
  const paths = [];

  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) paths.push(path);
    else paths.push(...await listAvatarObjects(path));
  }

  return paths;
}

async function main() {
  let totalRows = 0;

  for (const table of tables) {
    const count = await countRows(table);
    totalRows += count;
    console.log(`${table}: ${count}`);
  }

  const avatarObjects = await listAvatarObjects();
  totalRows += avatarObjects.length;
  console.log(`avatars storage objects: ${avatarObjects.length}`);

  if (totalRows > 0) {
    console.error(`Found ${totalRows} app data item(s) remaining.`);
    process.exit(1);
  }

  console.log("App data is clear.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
