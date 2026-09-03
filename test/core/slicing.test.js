import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import { sliceRangeForDay, sliceTimedEventForDay, toZonedDateTime } from "../../src/core/slicing.js";

const ZONE = "Europe/Brussels";
const SLOT = { timeZone: ZONE, slotMin: 480, slotMax: 1080 };

test("same-day range passes through unclipped", () => {
  assert.deepEqual(
    sliceRangeForDay({
      start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      date: "2026-09-03",
      ...SLOT,
    }),
    { start: 540, end: 600 },
  );
});

test("overnight event is sliced and clipped per day", () => {
  const event = {
    start: "2026-09-07T17:00:00+02:00[Europe/Brussels]",
    end: "2026-09-08T09:00:00+02:00[Europe/Brussels]",
  };
  assert.deepEqual(sliceTimedEventForDay(event, "2026-09-07", SLOT), { start: 1020, end: 1080 });
  assert.deepEqual(sliceTimedEventForDay(event, "2026-09-08", SLOT), { start: 480, end: 540 });
  assert.equal(sliceTimedEventForDay(event, "2026-09-09", SLOT), null);
});

test("event fully outside the slot range returns null", () => {
  const event = {
    start: "2026-09-07T22:00:00+02:00[Europe/Brussels]",
    end: "2026-09-08T02:00:00+02:00[Europe/Brussels]",
  };
  assert.equal(sliceTimedEventForDay(event, "2026-09-07", SLOT), null);
  assert.equal(sliceTimedEventForDay(event, "2026-09-08", SLOT), null);
});

test("range outside the slot range returns null", () => {
  assert.equal(
    sliceRangeForDay({
      start: "2026-09-03T05:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T06:00:00+02:00[Europe/Brussels]",
      date: "2026-09-03",
      ...SLOT,
    }),
    null,
  );
});

test("partial overlap is clipped to the slot", () => {
  assert.deepEqual(
    sliceRangeForDay({
      start: "2026-09-03T06:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
      date: "2026-09-03",
      ...SLOT,
    }),
    { start: 480, end: 540 },
  );
});

test("empty or inverted ranges return null", () => {
  assert.equal(
    sliceRangeForDay({
      start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
      date: "2026-09-03",
      ...SLOT,
    }),
    null,
  );
});

test("spring-forward weekend keeps wall-clock geometry", () => {
  // 2026-03-29: 02:00 -> 03:00 skip in Europe/Brussels. Saturday is still
  // +01:00, Sunday after the switch is +02:00.
  const event = {
    start: "2026-03-28T22:00:00+01:00[Europe/Brussels]",
    end: "2026-03-29T10:00:00+02:00[Europe/Brussels]",
  };
  assert.deepEqual(sliceTimedEventForDay(event, "2026-03-29", SLOT), { start: 480, end: 600 });
  assert.deepEqual(
    sliceRangeForDay({
      start: "2026-03-29T08:00:00+02:00[Europe/Brussels]",
      end: "2026-03-29T10:00:00+02:00[Europe/Brussels]",
      date: "2026-03-29",
      ...SLOT,
    }),
    { start: 480, end: 600 },
  );
});

test("fall-back weekend keeps wall-clock geometry", () => {
  // 2026-10-25: 03:00 -> 02:00 repeat in Europe/Brussels.
  const event = {
    start: "2026-10-24T22:00:00+02:00[Europe/Brussels]",
    end: "2026-10-25T10:00:00+01:00[Europe/Brussels]",
  };
  assert.deepEqual(sliceTimedEventForDay(event, "2026-10-25", SLOT), { start: 480, end: 600 });
  assert.deepEqual(
    sliceRangeForDay({
      start: "2026-10-25T08:00:00+01:00[Europe/Brussels]",
      end: "2026-10-25T10:00:00+01:00[Europe/Brussels]",
      date: "2026-10-25",
      ...SLOT,
    }),
    { start: 480, end: 600 },
  );
});

test("ambiguous fall-back hour resolves via offset", () => {
  const first = toZonedDateTime("2026-10-25T02:30:00+02:00[Europe/Brussels]", ZONE);
  const second = toZonedDateTime("2026-10-25T02:30:00+01:00[Europe/Brussels]", ZONE);
  assert.notEqual(first.epochMilliseconds, second.epochMilliseconds);
  assert.equal(first.toPlainTime().toString().slice(0, 5), "02:30");
  assert.equal(second.toPlainTime().toString().slice(0, 5), "02:30");
});

test("ZonedDateTime instances are projected into the calendar zone", () => {
  const start = Temporal.ZonedDateTime.from("2026-09-03T09:00:00+02:00[Europe/Brussels]");
  const slice = sliceRangeForDay({ start, end: start.add({ hours: 1 }), date: "2026-09-03", ...SLOT });
  assert.deepEqual(slice, { start: 540, end: 600 });
});
