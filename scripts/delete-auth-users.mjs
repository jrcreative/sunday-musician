// Deletes Supabase Auth users through the Admin API.
//
// Dry run:
//   npm run auth:delete-users
//
// Execute:
//   CONFIRM_DELETE_AUTH_USERS=delete-auth-users npm run auth:delete-users -- --execute
//
// Delete specific users when the Auth list endpoint is failing:
//   CONFIRM_DELETE_AUTH_USERS=delete-auth-users npm run auth:delete-users -- --execute --id <uuid>

try { process.loadEnvFile(".env.local"); } catch { /* env already in shell */ }

const CONFIRMATION = "delete-auth-users";
const execute = process.argv.includes("--execute");
const ids = process.argv
  .flatMap((arg, index, args) => {
    if (arg === "--id") return args[index + 1] ? [args[index + 1]] : [];
    if (arg.startsWith("--id=")) return [arg.slice("--id=".length)];
    return [];
  })
  .filter(Boolean);
const confirmed = process.env.CONFIRM_DELETE_AUTH_USERS === CONFIRMATION;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (execute && !confirmed) {
  console.error(`Refusing to delete users. Set CONFIRM_DELETE_AUTH_USERS=${CONFIRMATION} to continue.`);
  process.exit(1);
}

const authAdminUrl = `${url.replace(/\/$/, "")}/auth/v1/admin/users`;
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
};

async function authFetch(path = "", init = {}) {
  const response = await fetch(`${authAdminUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? text;
    throw new Error(`Supabase Auth API returned ${response.status}: ${message || response.statusText}`);
  }

  return body;
}

async function listFirstPage() {
  const data = await authFetch("?page=1&per_page=1");
  return data.users ?? [];
}

async function main() {
  let deleted = 0;

  if (ids.length > 0) {
    if (!execute) {
      console.log(`Dry run: would delete ${ids.length} Auth user(s) by id.`);
      console.log(`Run CONFIRM_DELETE_AUTH_USERS=${CONFIRMATION} npm run auth:delete-users -- --execute ${ids.map(id => `--id ${id}`).join(" ")} to delete them.`);
      return;
    }

    for (const id of ids) {
      await authFetch(`/${id}`, { method: "DELETE" });
      deleted += 1;
      console.log(`Deleted ${id}`);
    }

    console.log(`Deleted ${deleted} Auth user(s).`);
    return;
  }

  while (true) {
    let users;
    try {
      users = await listFirstPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      console.error("If this happens after some deletions, check for remaining users in the Supabase SQL editor:");
      console.error("  select id, email, created_at from auth.users order by created_at;");
      console.error("Then delete any remaining rows with:");
      console.error(`  CONFIRM_DELETE_AUTH_USERS=${CONFIRMATION} npm run auth:delete-users -- --execute --id <uuid>`);
      process.exit(1);
    }

    if (users.length === 0) break;

    if (!execute) {
      console.log("Dry run: found at least 1 Auth user.");
      console.log(`Run CONFIRM_DELETE_AUTH_USERS=${CONFIRMATION} npm run auth:delete-users -- --execute to delete them.`);
      return;
    }

    for (const user of users) {
      await authFetch(`/${user.id}`, { method: "DELETE" });
      deleted += 1;
      console.log(`Deleted ${user.email ?? user.id}`);
    }
  }

  if (execute) console.log(`Deleted ${deleted} Auth user(s).`);
  else console.log("Dry run: no Auth users found.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
