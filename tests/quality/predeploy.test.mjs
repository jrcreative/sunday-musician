import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("predeploy runs lint, quality tests, and production build", () => {
  const pkg = JSON.parse(read("package.json"));
  const predeploy = pkg.scripts?.predeploy ?? "";

  assert.match(predeploy, /npm run lint/, "predeploy must run lint");
  assert.match(predeploy, /npm run test:quality/, "predeploy must run quality tests");
  assert.match(predeploy, /npm run build/, "predeploy must run the production build");
});

test("Netlify deploys through the predeploy quality gate", () => {
  const config = read("netlify.toml");

  assert.match(config, /command\s*=\s*"npm run predeploy"/, "Netlify build command must use the quality gate");
});
