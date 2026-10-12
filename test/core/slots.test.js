import assert from "node:assert/strict";
import test from "node:test";
import { minutesFromMidnight, resolveSlotBounds, zonedDateTimeAt } from "../../src/core/dates.js";

const DEFAULTS = { slotMin: "08:00", slotMax: "18:00" };

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

test("zonedDateTimeAt rolls the exclusive end of day into the next midnight", () => {
  /** @param {unknown} value */
  const iso = (value) => String(value);
  assert.equal(iso(zonedDateTimeAt("2026-09-03", 1425, "UTC")), "2026-09-03T23:45:00+00:00[UTC]");
  // 1440 (`24:00`) must not be constrained to 23:00 on the same day.
  assert.equal(iso(zonedDateTimeAt("2026-09-03", 1440, "UTC")), "2026-09-04T00:00:00+00:00[UTC]");
  assert.equal(iso(zonedDateTimeAt("2026-09-03", 2880, "UTC")), "2026-09-05T00:00:00+00:00[UTC]");
  assert.equal(iso(zonedDateTimeAt("2026-09-03", 0, "UTC")), "2026-09-03T00:00:00+00:00[UTC]");
});
