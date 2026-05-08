import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root so it doesn't infer a stray ancestor dir
  // when other lockfiles exist on the machine. Without this, PostCSS plugins
  // (e.g. @tailwindcss/postcss → tailwindcss) fail to resolve.
  turbopack: { root: path.resolve(__dirname) },
  // node-ical pulls in rrule-temporal + @js-temporal/polyfill which break
  // when Turbopack bundles them — keep them external so Node loads them at runtime.
  serverExternalPackages: ["node-ical", "rrule-temporal", "@js-temporal/polyfill"],
};

export default nextConfig;
