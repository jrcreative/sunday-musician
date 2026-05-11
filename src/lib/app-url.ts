export function appUrl(path: string) {
  const base = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
