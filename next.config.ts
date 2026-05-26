import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  // Prevent the app from being embedded in iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer to origin only when crossing to a different origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser APIs we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root so it doesn't infer a stray ancestor dir
  // when other lockfiles exist on the machine.
  turbopack: { root: path.resolve(__dirname) },
  // node-ical pulls in rrule-temporal + @js-temporal/polyfill which break
  // when Turbopack bundles them — keep them external so Node loads them at runtime.
  serverExternalPackages: ["node-ical", "rrule-temporal", "@js-temporal/polyfill"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
