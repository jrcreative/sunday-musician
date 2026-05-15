import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("find page uses a compact mobile filter sheet", () => {
  const page = read("src/app/(app)/find/FindMusiciansClient.tsx");
  const css = read("src/styles/design-system.css");

  assert.match(page, /const \[filtersOpen, setFiltersOpen\]/, "find filters need mobile sheet state");
  assert.match(page, /sm-find-mobile-bar/, "find page should show a compact mobile filter bar");
  assert.match(page, /sm-find-filter-pill/, "mobile filters should open from a pill control");
  assert.match(page, /sm-find-filters--open/, "filter rail should become an open sheet on mobile");
  assert.match(page, /Show \{filtered\.length\}/, "mobile sheet should close with a result-count action");
  assert.match(css, /\.sm-find-filters[\s\S]*position: fixed !important/, "mobile filters should be a fixed bottom sheet");
  assert.match(css, /border-radius: 18px 18px 0 0 !important/, "mobile filter sheet should feel like a polished drawer");
  assert.match(css, /\.sm-find-filter-backdrop/, "mobile filter sheet should have a dismiss backdrop");
});
