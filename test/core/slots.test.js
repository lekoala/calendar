import assert from "node:assert/strict";
import test from "node:test";
import { minutesFromMidnight, resolveSlotBounds, zonedDateTimeAt } from "../../src/core/dates.js";

const DEFAULTS = { slotMin: "08:00", slotMax: "18:00" };

test("wall-minute boundaries reach the next civil midnight across DST", () => {
  for (const [date, next, hours] of [
    ["2026-09-03", "2026-09-04", 24],
    ["2026-03-29", "2026-03-30", 23],
    ["2026-10-25", "2026-10-26", 25],
  ]) {
    const start = zonedDateTimeAt(String(date), 0, "Europe/Brussels");
    const end = zonedDateTimeAt(String(date), 1440, "Europe/Brussels");
    assert.equal(end.toPlainDate().toString(), next);
    assert.equal(end.toPlainTime().toString(), "00:00:00");
    assert.equal((end.epochMilliseconds - start.epochMilliseconds) / 3600000, hours);
  }
});

test("wall-minute projection preserves fractional minutes", () => {
  assert.equal(zonedDateTimeAt("2026-09-03", 540.5, "UTC").toPlainTime().toString(), "09:00:30");
});

test("minutesFromMidnight treats 24:00 as the exclusive day end", () => {
  assert.equal(minutesFromMidnight("00:00"), 0);
  assert.equal(minutesFromMidnight("08:30"), 510);
  assert.equal(minutesFromMidnight("24:00"), 1440);
  assert.equal(minutesFromMidnight("24:00:00"), 1440);
});

test("minutesFromMidnight still rejects a real invalid time", () => {
  assert.throws(() => minutesFromMidnight("25:00"));
  assert.throws(() => minutesFromMidnight("nope"));
});

test("resolveSlotBounds accepts a full 00:00-24:00 grid", () => {
  assert.deepEqual(resolveSlotBounds("00:00", "24:00", DEFAULTS), {
    slotMin: "00:00",
    slotMax: "24:00",
  });
});

test("resolveSlotBounds falls back per bound on malformed input", () => {
  assert.deepEqual(resolveSlotBounds("nope", "18:00", DEFAULTS), {
    slotMin: DEFAULTS.slotMin,
    slotMax: "18:00",
  });
  assert.deepEqual(resolveSlotBounds("", "", DEFAULTS), DEFAULTS);
});

test("resolveSlotBounds resets both bounds when the span is inverted", () => {
  assert.deepEqual(resolveSlotBounds("18:00", "08:00", DEFAULTS), DEFAULTS);
  assert.deepEqual(resolveSlotBounds("12:00", "12:00", DEFAULTS), DEFAULTS);
});
