import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("availability calendars can be color-coded and applied to calendar dates", () => {
  const client = read("src/app/(app)/availability/AvailabilityClient.tsx");
  const actions = read("src/app/(app)/availability/actions.ts");
  const page = read("src/app/(app)/availability/page.tsx");

  assert.match(client, /SUNDAY_MUSICIAN_CALENDAR_COLOR/, "Sunday Musician calendar needs a brand color");
  assert.match(client, /IMPORTED_CALENDAR_COLORS = \[[\s\S]*?\] as const/, "imported calendars need a fixed selectable palette");
  assert.match(client, /connectionColor/, "calendar cards should derive their selected color from connection metadata");
  assert.match(client, /handleColorChange/, "calendar cards should update color selection in place");
  assert.match(client, /dayMarkers/, "calendar dates should apply colors from their blocking calendar source");
  assert.match(client, /connection_id/, "synced blocks need their source connection for color lookup");
  assert.match(actions, /updateCalendarColor/, "color choices should persist through a server action");
  assert.match(actions, /meta: \{ \.\.\.meta, color \}/, "color choices should be stored in calendar connection metadata");
  assert.match(page, /select\("id, start_date, end_date, source, note, connection_id"\)/, "availability page must fetch block connection ids");
  assert.match(page, /select\("id, kind, label, ical_url, meta, last_synced_at, last_error"\)/, "availability page must fetch calendar color metadata");
});
