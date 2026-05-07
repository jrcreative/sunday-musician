import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical pulls in rrule-temporal + @js-temporal/polyfill which break
  // when Turbopack bundles them — keep them external so Node loads them at runtime.
  serverExternalPackages: ["node-ical", "rrule-temporal", "@js-temporal/polyfill"],
};

export default nextConfig;
