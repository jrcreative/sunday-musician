// SITE_URL is the source of truth. VERCEL_PROJECT_PRODUCTION_URL is the host-provided
// fallback so a missing SITE_URL degrades to the real domain instead of localhost — it
// has no scheme, hence the prefix. (process.env.URL was the Netlify equivalent and is
// dead now that we deploy to Vercel.)
export function configuredBaseUrl(): string | null {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = process.env.SITE_URL ?? (vercel ? `https://${vercel}` : null);
  return base ? base.replace(/\/$/, "") : null;
}

export function appBaseUrl() {
  return configuredBaseUrl() ?? "http://localhost:3000";
}

export function appUrl(path: string) {
  return `${appBaseUrl()}${path}`;
}
