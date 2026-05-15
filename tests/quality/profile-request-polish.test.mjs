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
