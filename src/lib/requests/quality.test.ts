import test from "node:test";
import assert from "node:assert/strict";
import { scoreRequestQuality } from "./quality";

test("scores a complete request as excellent", () => {
  const score = scoreRequestQuality({
    title: "Sunday morning pianist needed",
    serviceDate: "2026-06-14",
    serviceTime: "10:00",
    useChurchLocation: true,
    churchLocationVerified: true,
    instrumentsNeeded: ["Piano"],
    rehearsals: "1 (Saturday evening)",
    setlistUrl: "https://example.com/setlist",
    techSetup: ["In-ear monitors", "Charts provided"],
    offeredFee: 250,
    notes: "Contemporary service with charts provided, easy parking, and a short soundcheck.",
  });

  assert.equal(score.percent, 100);
  assert.equal(score.grade, "Excellent");
  assert.equal(score.improvements.length, 0);
});

test("returns actionable gaps for an incomplete request", () => {
  const score = scoreRequestQuality({
    title: "Need help",
    serviceDate: "2026-06-14",
    useChurchLocation: true,
    churchLocationVerified: false,
    instrumentsNeeded: [],
    rehearsals: "",
    techSetup: [],
    offeredFee: null,
    notes: "",
  });

  assert.equal(score.grade, "Needs work");
  assert.ok(score.percent < 60);
  assert.ok(score.improvements.some(item => item.includes("Verify")));
  assert.ok(score.improvements.some(item => item.includes("date and start time")));
  assert.ok(score.improvements.some(item => item.includes("instruments")));
});

test("gives partial credit for one tech item and short notes", () => {
  const score = scoreRequestQuality({
    title: "Wednesday service drummer needed",
    serviceDate: "2026-06-17",
    serviceTime: "18:30",
    useChurchLocation: false,
    locationVerified: true,
    instrumentsNeeded: ["Drums"],
    rehearsals: "None",
    setlistUrl: "",
    techSetup: ["House drum kit"],
    offeredFee: "175",
    notes: "Small room.",
  });

  assert.equal(score.grade, "Strong");
  assert.ok(score.percent >= 75);
  assert.ok(score.improvements.some(item => item.includes("setlist")));
  assert.ok(score.improvements.some(item => item.includes("short note")));
});
