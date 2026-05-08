import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  _stripe = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: { name: "Sunday Musician", version: "0.1.0" },
  });
  return _stripe;
}

export function siteUrl(): string {
  const url = process.env.SITE_URL ?? process.env.URL;
  if (!url) throw new Error("SITE_URL/URL not configured");
  return url.replace(/\/$/, "");
}
