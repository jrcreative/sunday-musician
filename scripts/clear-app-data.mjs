// Deletes launch-reset app table data through PostgREST.
//
// Dry run:
//   npm run data:clear-app
//
// Execute:
//   CONFIRM_CLEAR_APP_DATA=clear-app-data npm run data:clear-app -- --execute
//
// Auth users are intentionally separate:
//   CONFIRM_DELETE_AUTH_USERS=delete-auth-users npm run auth:delete-users -- --execute

try { process.loadEnvFile(".env.local"); } catch { /* env already in shell */ }

const CONFIRMATION = "clear-app-data";
const execute = process.argv.includes("--execute");
const confirmed = process.env.CONFIRM_CLEAR_APP_DATA === CONFIRMATION;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (execute && !confirmed) {
  console.error(`Refusing to clear app data. Set CONFIRM_CLEAR_APP_DATA=${CONFIRMATION} to continue.`);
  process.exit(1);
}

const restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
const storageUrl = `${url.replace(/\/$/, "")}/storage/v1`;
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
};

const tables = [
  ["admin_actions", "id"],
  ["email_deliveries", "id"],
  ["booking_disputes", "id"],
  ["payments", "id"],
  ["reviews", "id"],
  ["review_periods", "id"],
  ["bookings", "id"],
  ["request_match_dismissals", "id"],
  ["applications", "id"],
  ["messages", "id"],
  ["threads", "id"],
  ["service_requests", "id"],
  ["stripe_accounts", "id"],
  ["stripe_customers", "id"],
  ["calendar_connections", "id"],
  ["unavailability_blocks", "id"],
  ["notification_preferences", "profile_id"],
  ["musician_profiles", "id"],
  ["church_profiles", "id"],
  ["profiles", "id"],
];

async function countRows(table) {
  const response = await fetch(`${restUrl}/${table}?select=*&limit=1`, {
    headers: {
      ...headers,
      prefer: "count=exact",
    },
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

async function deleteRows(table, key) {
  const response = await fetch(`${restUrl}/${table}?${key}=not.is.null`, {
    method: "DELETE",
    headers: {
      ...headers,
      prefer: "return=minimal",
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${text || response.statusText}`);
  }
}

async function listAvatarObjects(prefix = "") {
  const response = await fetch(`${storageUrl}/object/list/avatars`, {
    method: "POST",
    headers: {
      ...headers,
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

async function deleteAvatarObjects(paths) {
  if (paths.length === 0) return;

  const response = await fetch(`${storageUrl}/object/avatars`, {
    method: "DELETE",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`avatars: ${response.status} ${text || response.statusText}`);
  }
}

async function main() {
  let totalRows = 0;

  for (const [table] of tables) {
    const count = await countRows(table);
    totalRows += count;
    console.log(`${table}: ${count}`);
  }

  const avatarObjects = await listAvatarObjects();
  totalRows += avatarObjects.length;
  console.log(`avatars storage objects: ${avatarObjects.length}`);

  if (!execute) {
    console.log(`Dry run: found ${totalRows} app data item(s).`);
    console.log(`Run CONFIRM_CLEAR_APP_DATA=${CONFIRMATION} npm run data:clear-app -- --execute to delete them.`);
    return;
  }

  for (const [table, key] of tables) {
    await deleteRows(table, key);
    console.log(`Cleared ${table}`);
  }

  await deleteAvatarObjects(avatarObjects);
  console.log("Cleared avatars storage objects");

  console.log("App data cleanup complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
