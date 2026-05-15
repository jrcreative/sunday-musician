import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("musician dashboard stat cards stay in a compact mobile row", () => {
  const page = read("src/app/(app)/dashboard/page.tsx");
  const css = read("src/styles/design-system.css");

  assert.match(page, /sm-dashboard-stat-row/, "dashboard stats should use the compact mobile row class");
  assert.match(page, /sm-dashboard-stat-card/, "dashboard stat cards should use mobile-safe card styling");
  assert.match(css, /\.sm-dashboard-stat-row[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/, "dashboard stats should keep three columns on mobile");
  assert.match(css, /\.sm-dashboard-stat-label[\s\S]*font-size: 8\.5px !important/, "dashboard labels should shrink only in the compact mobile row");
});
