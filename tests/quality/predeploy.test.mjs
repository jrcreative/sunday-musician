import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("predeploy runs lint, quality tests, and production build", () => {
  const pkg = JSON.parse(read("package.json"));
  const prebuild = pkg.scripts?.prebuild ?? "";
  const predeploy = pkg.scripts?.predeploy ?? "";

  assert.match(prebuild, /npm run lint/, "prebuild must run lint before production builds");
  assert.match(prebuild, /npm run test:quality/, "prebuild must run quality tests before production builds");
  assert.match(predeploy, /npm run build/, "predeploy must run the production build");
});

test("Netlify deploys through the predeploy quality gate", () => {
  const config = read("netlify.toml");
  const pkg = JSON.parse(read("package.json"));

  assert.match(config, /command\s*=\s*"npm run build"/, "Netlify should use the standard Next build command");
  assert.match(pkg.scripts?.prebuild ?? "", /npm run test:quality/, "npm prebuild must keep Netlify behind the quality gate");
});

test("Netlify pins a Node version compatible with Next and Supabase", () => {
  const config = read("netlify.toml");

  assert.match(config, /\[build\.environment\]/, "Netlify should declare build environment settings");
  assert.match(config, /NODE_VERSION\s*=\s*"20\.19\.0"/, "Netlify must use a Node version compatible with the dependency tree");
});
