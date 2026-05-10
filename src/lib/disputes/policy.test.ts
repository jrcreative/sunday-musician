import assert from "node:assert/strict";
import test from "node:test";
import { cancellationPolicyFor, cancellationPolicyLine, daysUntilService } from "./policy";

const cancelledAt = new Date("2026-05-01T18:00:00.000Z");

test("daysUntilService compares calendar dates", () => {
  assert.equal(daysUntilService("2026-05-15", cancelledAt), 14);
  assert.equal(daysUntilService("2026-05-01", cancelledAt), 0);
});

test("flexible cancellation has no fee or review expectation", () => {
  const policy = cancellationPolicyFor({ cancelledBy: "church", serviceDate: "2026-05-15", cancelledAt });

  assert.equal(policy.window, "flexible");
  assert.equal(policy.label, "Flexible cancellation");
  assert.equal(policy.feeMayApply, false);
  assert.equal(policy.adminReviewMayApply, false);
});

test("short-notice and late cancellations are reviewable", () => {
  const shortNotice = cancellationPolicyFor({ cancelledBy: "musician", serviceDate: "2026-05-10", cancelledAt });
  const late = cancellationPolicyFor({ cancelledBy: "church", serviceDate: "2026-05-06", cancelledAt });

  assert.equal(shortNotice.window, "short_notice");
  assert.equal(late.window, "late");
  assert.equal(shortNotice.feeMayApply, true);
  assert.equal(late.adminReviewMayApply, true);
});

test("policy line gives user-facing status copy", () => {
  const policy = cancellationPolicyFor({ cancelledBy: "church", serviceDate: "2026-05-01", cancelledAt });

  assert.equal(
    cancellationPolicyLine(policy),
    "Late cancellation (on the service date); fee/admin review may apply.",
  );
});
