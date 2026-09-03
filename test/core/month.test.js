import assert from "node:assert/strict";
import test from "node:test";
import {
  getMonthRange,
  getMonthWeeks,
  getViewRange,
  getVisibleDates,
  isMonthView,
} from "../../src/core/dates.js";

test("September 2026 starts Monday August 31 in 5 weeks", () => {
  const weeks = getMonthWeeks("2026-09-03");
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].toString(), "2026-08-31");
  assert.equal(weeks[0][0].dayOfWeek, 1);
  assert.equal(weeks[4][6].toString(), "2026-10-04");
  for (const week of weeks) assert.equal(week.length, 7);
});

test("March 2026 needs 6 weeks", () => {
  // March 1st 2026 is a Sunday with 31 days.
  const weeks = getMonthWeeks("2026-03-15");
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][0].toString(), "2026-02-23");
  assert.equal(weeks[5][6].toString(), "2026-04-05");
});

test("February 2026 fits 5 weeks starting late January", () => {
  const weeks = getMonthWeeks("2026-02-10");
  assert.equal(weeks[0][0].toString(), "2026-01-26");
  assert.equal(weeks[weeks.length - 1][6].toString(), "2026-03-01");
});

test("leap February 2024 stays covered", () => {
  const weeks = getMonthWeeks("2024-02-29");
  const flat = weeks.flat().map((day) => day.toString());
  assert.ok(flat.includes("2024-02-29"));
  assert.equal(weeks[0][0].dayOfWeek, 1);
});

test("month range is week-aligned with an exclusive end", () => {
  assert.deepEqual(
    {
      start: getMonthRange("2026-09-03").start.toString(),
      end: getMonthRange("2026-09-03").end.toString(),
    },
    { start: "2026-08-31", end: "2026-10-05" },
  );
});

test("view range and visible dates branch on month", () => {
  const range = getViewRange("2026-09-03", "month");
  assert.equal(range.start.toString(), "2026-08-31");
  assert.equal(range.end.toString(), "2026-10-05");
  assert.equal(getVisibleDates("2026-09-03", "month").length, 35);
  assert.equal(getVisibleDates("2026-09-03", "list").length, 7);
  assert.equal(isMonthView("month"), true);
  assert.equal(isMonthView("week"), false);
});
