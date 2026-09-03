import assert from "node:assert/strict";
import test from "node:test";
import {
  getMonthRange,
  getMonthWeeks,
  getViewRange,
  getVisibleDates,
  isWeekAnchoredView,
  startOfWeek,
  stepAnchor,
} from "../../src/core/dates.js";

/**
 * M8 date derivation: week anchoring, `firstDay` and `hiddenDays`.
 * 2026-09-03 is a Thursday.
 *
 * @param {Array<{ toString(): string }>} dates
 * @returns {string[]}
 */
const iso = (dates) => dates.map((date) => date.toString());

test("week is anchored on the civil week containing the date", () => {
  assert.equal(isWeekAnchoredView("week"), true);
  assert.equal(isWeekAnchoredView("threeDays"), false);
  assert.equal(isWeekAnchoredView("list"), false);

  const dates = getVisibleDates("2026-09-03", "week");
  assert.equal(dates.length, 7);
  assert.equal(dates[0].toString(), "2026-08-31");
  assert.equal(dates[0].dayOfWeek, 1);
  assert.equal(dates[6].toString(), "2026-09-06");

  const range = getViewRange("2026-09-03", "week");
  assert.equal(range.start.toString(), "2026-08-31");
  assert.equal(range.end.toString(), "2026-09-07");
});

test("firstDay moves the week start, and 0 is an alias for Sunday", () => {
  assert.equal(startOfWeek("2026-09-03").toString(), "2026-08-31");
  assert.equal(startOfWeek("2026-09-03", 7).toString(), "2026-08-30");
  assert.equal(startOfWeek("2026-09-03", 0).toString(), "2026-08-30");
  assert.equal(startOfWeek("2026-09-03", 4).toString(), "2026-09-03");

  const sunday = getVisibleDates("2026-09-03", "week", { firstDay: 7 });
  assert.equal(sunday[0].toString(), "2026-08-30");
  assert.equal(sunday[6].toString(), "2026-09-05");
  assert.deepEqual(iso(getVisibleDates("2026-09-03", "week", { firstDay: 0 })), iso(sunday));
});

test("rolling views still start at the anchor date", () => {
  assert.deepEqual(iso(getVisibleDates("2026-09-03", "threeDays")), [
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ]);
  assert.equal(getVisibleDates("2026-09-03", "day")[0].toString(), "2026-09-03");
  assert.equal(getVisibleDates("2026-09-03", "list")[0].toString(), "2026-09-03");
  assert.equal(getVisibleDates("2026-09-03", "list").length, 7);
});

test("hidden days shrink a week but never shorten a rolling count", () => {
  const week = getVisibleDates("2026-09-03", "week", { hiddenDays: [7] });
  assert.equal(week.length, 6);
  assert.deepEqual(iso(week).at(-1), "2026-09-05");

  const workWeek = getVisibleDates("2026-09-03", "week", { hiddenDays: [6, 7] });
  assert.equal(workWeek.length, 5);
  assert.equal(workWeek.at(-1)?.toString(), "2026-09-04");

  // Friday + weekend hidden: three usable days, spanning five calendar days.
  const rolling = getVisibleDates("2026-09-04", "threeDays", { hiddenDays: [6, 7] });
  assert.deepEqual(iso(rolling), ["2026-09-04", "2026-09-07", "2026-09-08"]);
  const range = getViewRange("2026-09-04", "threeDays", { hiddenDays: [6, 7] });
  assert.equal(range.start.toString(), "2026-09-04");
  assert.equal(range.end.toString(), "2026-09-09");
});

test("an anchor on a hidden day rolls forward to the next visible one", () => {
  // 2026-09-06 is a Sunday.
  assert.deepEqual(iso(getVisibleDates("2026-09-06", "day", { hiddenDays: [7] })), ["2026-09-07"]);
});

test("hiding every weekday is ignored rather than rendering nothing", () => {
  const dates = getVisibleDates("2026-09-03", "threeDays", { hiddenDays: [1, 2, 3, 4, 5, 6, 7] });
  assert.deepEqual(iso(dates), ["2026-09-03", "2026-09-04", "2026-09-05"]);
  assert.equal(getVisibleDates("2026-09-03", "week", { hiddenDays: [0, 1, 2, 3, 4, 5, 6] }).length, 7);
});

test("out-of-range weekday values are ignored", () => {
  assert.equal(getVisibleDates("2026-09-03", "week", { hiddenDays: [9, -1, 1.5] }).length, 7);
  assert.equal(startOfWeek("2026-09-03", 99).toString(), "2026-08-31");
});

test("month weeks follow firstDay and drop hidden days, the range does not", () => {
  const sunday = getMonthWeeks("2026-09-03", { firstDay: 7 });
  assert.equal(sunday[0][0].toString(), "2026-08-30");
  assert.equal(sunday[0][0].dayOfWeek, 7);
  assert.equal(getMonthRange("2026-09-03", { firstDay: 7 }).start.toString(), "2026-08-30");
  assert.equal(getMonthRange("2026-09-03", { firstDay: 7 }).end.toString(), "2026-10-04");

  const weeks = getMonthWeeks("2026-09-03", { hiddenDays: [7] });
  assert.equal(weeks.length, 5);
  for (const week of weeks) assert.equal(week.length, 6);
  assert.equal(getVisibleDates("2026-09-03", "month", { hiddenDays: [7] }).length, 30);

  // Sources still receive whole weeks: rendering less must not fetch less.
  const range = getMonthRange("2026-09-03", { hiddenDays: [7] });
  assert.equal(range.start.toString(), "2026-08-31");
  assert.equal(range.end.toString(), "2026-10-05");
});

test("stepAnchor keeps the weekday for month and week", () => {
  assert.equal(stepAnchor("2026-09-03", "month", 1).toString(), "2026-10-03");
  assert.equal(stepAnchor("2026-09-03", "month", -1).toString(), "2026-08-03");
  assert.equal(stepAnchor("2026-09-03", "week", 1).toString(), "2026-09-10");
  assert.equal(stepAnchor("2026-09-03", "week", -1).toString(), "2026-08-27");
  assert.equal(getVisibleDates(stepAnchor("2026-09-03", "week", 1), "week")[0].toString(), "2026-09-07");
});

test("stepAnchor on rolling views is unchanged without hidden days", () => {
  assert.equal(stepAnchor("2026-09-03", "threeDays", 1).toString(), "2026-09-06");
  assert.equal(stepAnchor("2026-09-03", "threeDays", -1).toString(), "2026-08-31");
  assert.equal(stepAnchor("2026-09-03", "day", 1).toString(), "2026-09-04");
  assert.equal(stepAnchor("2026-09-03", "day", -1).toString(), "2026-09-02");
  assert.equal(stepAnchor("2026-09-03", "list", 1).toString(), "2026-09-10");
});

test("stepAnchor with hidden days neither overlaps nor skips a visible day", () => {
  const options = { hiddenDays: [6, 7] };
  const shown = iso(getVisibleDates("2026-09-04", "threeDays", options));
  assert.deepEqual(shown, ["2026-09-04", "2026-09-07", "2026-09-08"]);

  const forward = stepAnchor("2026-09-04", "threeDays", 1, options);
  assert.equal(forward.toString(), "2026-09-09");
  assert.deepEqual(iso(getVisibleDates(forward, "threeDays", options)), [
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
  ]);

  const backward = stepAnchor("2026-09-04", "threeDays", -1, options);
  assert.equal(backward.toString(), "2026-09-01");
  assert.deepEqual(iso(getVisibleDates(backward, "threeDays", options)), [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
  ]);
});

test("stepAnchor never lands on a hidden day", () => {
  // Friday, one day view, weekend hidden: the next anchor is Monday.
  const next = stepAnchor("2026-09-04", "day", 1, { hiddenDays: [6, 7] });
  assert.equal(next.toString(), "2026-09-07");
  assert.equal(next.dayOfWeek, 1);
});
