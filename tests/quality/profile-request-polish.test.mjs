import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("musician profile sidebar carries traditions and omits generic availability", () => {
  const source = read("src/app/(app)/musicians/[id]/page.tsx");
  const asideStart = source.indexOf("{/* Aside */}");
  const aside = source.slice(asideStart);
  const main = source.slice(0, asideStart);

  assert.ok(asideStart > 0, "musician profile should have an aside section");
  assert.match(aside, /Denominations \/ traditions/, "denomination tags should appear in the sidebar");
  assert.doesNotMatch(main, /Denominations \/ traditions/, "denomination tags should not remain in the main content area");
  assert.doesNotMatch(aside, />Availability<\/dt>/, "generic availability row should be removed from the sidebar");
  assert.doesNotMatch(aside, /Currently available|Not available/, "generic availability copy should be removed");
});

test("request detail page presents rehearsal details as a styled schedule card", () => {
  const source = read("src/app/(app)/requests/[id]/page.tsx");

  assert.match(source, /Rehearsal schedule/, "request detail should label rehearsal timing clearly");
  assert.match(source, /color-mix\(in srgb, var\(--sm-accent\) 5%, var\(--sm-bg-1\)\)/, "rehearsal schedule should have a warm highlighted card style");
  assert.match(source, /whiteSpace: "pre-line"/, "rehearsal text should preserve line breaks");
  assert.match(source, /\{request\.rehearsals\}/, "rehearsal card should render the request rehearsal details");
});

test("request detail page has mobile-safe detail grid and person cards", () => {
  const page = read("src/app/(app)/requests/[id]/page.tsx");
  const css = read("src/styles/design-system.css");

  assert.match(page, /sm-request-detail-grid/, "request detail facts should use the mobile 2x2 grid class");
  assert.match(page, /sm-request-person-card/, "musician cards should use mobile-safe card layout");
  assert.match(page, /sm-request-card-actions/, "musician card actions should stack out of the content row on mobile");
  assert.match(css, /\.sm-request-detail-grid[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/, "request detail facts should stay 2x2 on mobile");
  assert.match(css, /\.sm-request-person-card[\s\S]*display: grid !important/, "musician cards should become a grid on mobile");
  assert.match(css, /\.sm-request-card-actions[\s\S]*grid-column: 1 \/ -1/, "mobile card actions should span the full card width");
});
