import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("accepting a proposal directly ensures confirmed booking lifecycle rows", () => {
  const source = read("src/app/api/proposals/accept/route.ts");

  assert.match(source, /ensureBookingForAcceptedProposal/, "accept route must not rely only on database triggers");
  assert.match(source, /alreadyAccepted = msg\.proposal_status === "accepted"/, "accepted proposals must still pass through repair");
  assert.match(source, /\.from\("bookings"\)[\s\S]*\.insert\(/, "accept route must create the booking row");
  assert.match(source, /\.from\("review_periods"\)[\s\S]*\.insert\(/, "accept route must create the review period");
  assert.match(source, /\.from\("unavailability_blocks"\)[\s\S]*\.insert\(/, "accept route must block the booked date");
  assert.match(source, /\.from\("service_requests"\)[\s\S]*\.update\(\{ status: "filled" \}\)/, "accept route must mark the request filled");
  assert.doesNotMatch(source, /proposal_status === "accepted"[\s\S]{0,120}return NextResponse\.json\(\{ ok: true, alreadyAccepted: true \}\)/, "already accepted proposals must not return before repair");
});

test("database migrations repair accepted proposals missing booking rows", () => {
  const source = read("supabase/migrations/20260522_repair_accepted_booking_lifecycle.sql");

  assert.match(source, /create or replace function handle_proposal_accepted/, "migration must keep the trigger path repaired");
  assert.match(source, /insert into bookings/, "migration must backfill missing bookings");
  assert.match(source, /m\.proposal_status = 'accepted'/, "backfill must target accepted proposals");
  assert.match(source, /insert into review_periods/, "backfill must repair review periods");
  assert.match(source, /insert into unavailability_blocks/, "backfill must repair booking calendar blocks");
  assert.match(source, /set status = 'filled'/, "backfill must repair request status");
});

test("musician dashboard keeps conversations, open requests, and bookings distinct", () => {
  const source = read("src/app/(app)/dashboard/page.tsx");

  assert.match(source, /conversationRequestIds/, "open request recommendations must know which requests already have threads");
  assert.match(source, /!conversationRequestIds\.has\(r\.id\)/, "open requests for you must exclude started conversations");
  assert.match(source, /scoreServiceReadiness/, "open requests for you should be ranked as recommendations");
  assert.match(source, /latestProposalByThreadId/, "conversation state should use the latest proposal status");
  assert.match(source, /resolvedProposalStatuses/, "accepted or declined proposal threads should not stay in progress");
  assert.match(source, /liveBookingStats/, "booking stats should be computed separately from the preview rows");
  assert.match(source, /\.from\("bookings"\)[\s\S]*?\.is\("cancelled_at", null\)[\s\S]*?\.gte\("service_date", todayForBookings\)[\s\S]*?\.limit\(5\)/, "dashboard preview should query only upcoming, non-cancelled bookings");
  assert.doesNotMatch(source, /dashboardBookings[\s\S]{0,500}\.slice\(0,\s*4\)/, "my bookings must not be capped to four rows");
});

test("musician dashboard suggested requests show fit context and sort by date before fit", () => {
  const source = read("src/app/(app)/dashboard/page.tsx");
  const dateRank = source.indexOf("a.service_date.localeCompare(b.service_date)");
  const fitRank = source.indexOf("b.readiness.percent - a.readiness.percent");

  assert.ok(dateRank >= 0, "suggested requests should rank service date first");
  assert.ok(fitRank > dateRank, "request fit should break ties after service date");
  assert.match(source, /% request fit/, "suggested request cards should label the fit percentage");
  assert.match(source, /r\.readiness\.explanation/, "suggested request cards should explain why the request fits");
});

test("server-rendered musician booking lists query by verified profile id", () => {
  for (const path of [
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/requests/page.tsx",
  ]) {
    const source = read(path);

    assert.match(source, /createAdminClient/, `${path} should not depend on browser RLS to render bookings`);
    assert.match(source, /\.eq\("musician_profile_id", mp\.id\)/, `${path} must scope admin booking reads to the active musician profile`);
  }
});
