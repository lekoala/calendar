import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import { normalizeEvent } from "../../src/core/model.js";
import { nextStateChangeMs, temporalState } from "../../src/core/temporal.js";

const ZONE = "Europe/Brussels";
/** @param {string} clock */
const at = (clock) => `2026-09-03T${clock}:00+02:00[Europe/Brussels]`;
/** @param {string} clock */
const nowAt = (clock) => Temporal.ZonedDateTime.from(`2026-09-03T${clock}:00+02:00[Europe/Brussels]`);
/** @param {import("../../src/core/model.js").EventInput[]} list */
const events = (list) => list.map(normalizeEvent);

test("temporalState classifies past, current and future", () => {
  const now = nowAt("10:00");
  assert.equal(
    temporalState(
      Temporal.ZonedDateTime.from(at("08:00")),
      Temporal.ZonedDateTime.from(at("09:00")),
      now,
      ZONE,
    ),
    "past",
  );
  assert.equal(
    temporalState(
      Temporal.ZonedDateTime.from(at("09:00")),
      Temporal.ZonedDateTime.from(at("11:00")),
      now,
      ZONE,
    ),
    "current",
  );
  assert.equal(
    temporalState(
      Temporal.ZonedDateTime.from(at("11:00")),
      Temporal.ZonedDateTime.from(at("12:00")),
      now,
      ZONE,
    ),
    "future",
  );
});

test("temporalState boundaries are half-open: end === now is past, start === now is current", () => {
  const now = nowAt("10:00");
  assert.equal(
    temporalState(
      Temporal.ZonedDateTime.from(at("09:00")),
      Temporal.ZonedDateTime.from(at("10:00")),
      now,
      ZONE,
    ),
    "past",
  );
  assert.equal(
    temporalState(
      Temporal.ZonedDateTime.from(at("10:00")),
      Temporal.ZonedDateTime.from(at("11:00")),
      now,
      ZONE,
    ),
    "current",
  );
});

test("temporalState projects all-day bounds to local midnights", () => {
  const noon = nowAt("12:00");
  assert.equal(
    temporalState(Temporal.PlainDate.from("2026-09-03"), Temporal.PlainDate.from("2026-09-04"), noon, ZONE),
    "current",
  );
  assert.equal(
    temporalState(Temporal.PlainDate.from("2026-09-02"), Temporal.PlainDate.from("2026-09-03"), noon, ZONE),
    "past",
  );
  assert.equal(
    temporalState(Temporal.PlainDate.from("2026-09-04"), Temporal.PlainDate.from("2026-09-05"), noon, ZONE),
    "future",
  );
});

test("temporalState spans the 23-hour DST day by consecutive civil midnights", () => {
  // Europe/Brussels springs forward on 2026-03-29: a civil day that is only
  // 23 real hours long, still exactly [midnight, next midnight).
  const before = Temporal.ZonedDateTime.from("2026-03-29T00:30:00+01:00[Europe/Brussels]");
  const after = Temporal.ZonedDateTime.from("2026-03-30T00:30:00+02:00[Europe/Brussels]");
  const day = [Temporal.PlainDate.from("2026-03-29"), Temporal.PlainDate.from("2026-03-30")];
  assert.equal(temporalState(day[0], day[1], before, ZONE), "current");
  assert.equal(temporalState(day[0], day[1], after, ZONE), "past");
});

test("nextStateChangeMs returns the nearest future start/end boundary", () => {
  const list = events([
    { id: "a", start: at("09:00"), end: at("09:30") },
    { id: "b", start: at("10:30"), end: at("12:00") },
  ]);
  const nowMs = nowAt("10:00").epochMilliseconds;
  assert.equal(
    nextStateChangeMs(list, nowMs, ZONE),
    Temporal.ZonedDateTime.from(at("10:30")).epochMilliseconds,
  );
});

test("nextStateChangeMs ignores past boundaries and returns null when nothing ages", () => {
  const list = events([{ id: "a", start: at("08:00"), end: at("09:00") }]);
  assert.equal(nextStateChangeMs(list, nowAt("10:00").epochMilliseconds, ZONE), null);
  assert.equal(nextStateChangeMs([], nowAt("10:00").epochMilliseconds, ZONE), null);
});

test("nextStateChangeMs scopes to the visible range", () => {
  const list = events([
    {
      id: "offscreen",
      start: "2026-09-10T09:00:00+02:00[Europe/Brussels]",
      end: "2026-09-10T10:00:00+02:00[Europe/Brussels]",
    },
    { id: "visible", start: at("11:00"), end: at("12:00") },
  ]);
  const visible = { start: "2026-09-03", end: "2026-09-04" };
  assert.equal(
    nextStateChangeMs(list, nowAt("10:00").epochMilliseconds, ZONE, visible),
    Temporal.ZonedDateTime.from(at("11:00")).epochMilliseconds,
  );
  assert.equal(nextStateChangeMs(list, nowAt("13:00").epochMilliseconds, ZONE, visible), null);
});
