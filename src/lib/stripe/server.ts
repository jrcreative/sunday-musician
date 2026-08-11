import Stripe from "stripe";
import { configuredBaseUrl } from "@/lib/app-url";

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
  const url = configuredBaseUrl();
  if (!url) throw new Error("SITE_URL not configured");
  return url;
}
