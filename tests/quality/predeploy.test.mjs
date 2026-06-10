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
  assert.match(prebuild, /npm run test:unit/, "prebuild must run unit tests before production builds");
  assert.match(predeploy, /npm run build/, "predeploy must run the production build");
});

test("Node version is pinned consistently for deploys", () => {
  const nvmrc = read(".nvmrc").trim();
  const pkg = JSON.parse(read("package.json"));

  assert.equal(nvmrc, "20.19.0", ".nvmrc should pin the Node version for install-time selection");
  assert.equal(pkg.engines?.node, "20.19.0", "package engines should document the deploy Node version");
});
