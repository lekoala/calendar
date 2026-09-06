import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBackground, normalizeEvent } from "../../src/core/model.js";
import { queryOverlaps, queryRangeContext, rangesOverlap } from "../../src/core/overlaps.js";

const ZONE = "Europe/Brussels";
/** @param {string} clock */
const at = (clock) => `2026-09-03T${clock}:00+02:00[Europe/Brussels]`;
/** @param {import("../../src/core/model.js").EventInput[]} list */
const events = (list) => list.map(normalizeEvent);
/** @param {import("../../src/core/model.js").BackgroundInput[]} list */
const backgrounds = (list) => list.map(normalizeBackground);

test("rangesOverlap is half-open: adjacency is not overlap", () => {
  assert.equal(rangesOverlap(0, 60, 60, 120), false);
  assert.equal(rangesOverlap(0, 61, 60, 120), true);
  assert.equal(rangesOverlap(60, 120, 0, 60), false);
});

test("queryOverlaps requires a range and rejects empty ranges", () => {
  assert.throws(() => queryOverlaps({ events: [], range: /** @type {any} */ (null) }), TypeError);
  assert.deepEqual(
    queryOverlaps({
      events: events([{ id: "a", start: at("09:00"), end: at("10:00") }]),
      range: { start: at("10:00"), end: at("10:00") },
      timeZone: ZONE,
    }),
    [],
  );
  assert.deepEqual(
    queryOverlaps({
      events: events([{ id: "a", start: at("09:00"), end: at("10:00") }]),
      range: { start: at("11:00"), end: at("10:00") },
      timeZone: ZONE,
    }),
    [],
  );
});

test("queryOverlaps finds events by instant, in state order", () => {
  const hits = queryOverlaps({
    events: events([
      { id: "far", start: at("12:00"), end: at("13:00") },
      { id: "a", start: at("09:00"), end: at("10:00") },
      { id: "b", start: at("09:30"), end: at("10:30") },
      { id: "adjacent", start: at("10:30"), end: at("11:00") },
    ]),
    range: { start: at("09:45"), end: at("10:15") },
    timeZone: ZONE,
  });
  assert.deepEqual(
    hits.map((entry) => entry.id),
    ["a", "b"],
  );
});

test("resourceIds scopes events; backgrounds stay global", () => {
  const list = events([
    { id: "a", start: at("09:00"), end: at("10:00"), resourceId: "room-a" },
    { id: "b", start: at("09:00"), end: at("10:00"), resourceId: "room-b" },
    { id: "unassigned", start: at("09:00"), end: at("10:00") },
  ]);
  const ranges = backgrounds([
    { id: "global", start: at("09:00"), end: at("10:00") },
    { id: "scoped", start: at("09:00"), end: at("10:00"), resourceId: "room-b" },
  ]);
  const range = { start: at("09:15"), end: at("09:45") };
  assert.deepEqual(
    queryOverlaps({ events: list, range, timeZone: ZONE, resourceIds: ["room-a"] }).map((entry) => entry.id),
    ["a"],
  );
  assert.deepEqual(
    queryOverlaps({
      events: list,
      backgrounds: ranges,
      range,
      timeZone: ZONE,
      resourceIds: ["room-a"],
      includeBackgrounds: true,
    }).map((entry) => entry.id),
    ["a", "global"],
  );
  assert.deepEqual(
    queryOverlaps({ events: list, backgrounds: ranges, range, timeZone: ZONE, includeBackgrounds: true }).map(
      (entry) => entry.id,
    ),
    ["a", "b", "unassigned", "global", "scoped"],
  );
});

test("filter narrows without reading class arrays", () => {
  const hits = queryOverlaps({
    backgrounds: backgrounds([
      { id: "open", start: at("09:00"), end: at("12:00"), classNames: ["sc-open"] },
      { id: "blocked", start: at("09:00"), end: at("12:00"), classNames: ["sc-blocked"] },
    ]),
    range: { start: at("10:00"), end: at("10:30") },
    timeZone: ZONE,
    includeBackgrounds: true,
    filter: ({ kind, background }) =>
      kind === "background" && (background?.classNames ?? []).includes("sc-blocked"),
  });
  assert.deepEqual(
    hits.map((entry) => entry.id),
    ["blocked"],
  );
});

test("an all-day event conflicts with a timed booking on the same civil day", () => {
  const allDay = normalizeEvent({ id: "ad", allDay: true, start: "2026-09-03", end: "2026-09-04" });
  const hits = queryOverlaps({
    events: [allDay],
    range: { start: at("09:00"), end: at("09:30") },
    timeZone: ZONE,
  });
  assert.deepEqual(
    hits.map((entry) => entry.id),
    ["ad"],
  );
});

test("a timed event ending at midnight does not overlap the next civil day", () => {
  // Wed 23:00 -> Thu 00:00, half-open: Thursday is untouched.
  const timed = normalizeEvent({
    id: "t",
    start: "2026-09-02T23:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T00:00:00+02:00[Europe/Brussels]",
  });
  assert.deepEqual(
    queryOverlaps({ events: [timed], range: { start: "2026-09-03", end: "2026-09-04" }, timeZone: ZONE }),
    [],
  );
  assert.deepEqual(
    queryOverlaps({ events: [timed], range: { start: "2026-09-02", end: "2026-09-03" }, timeZone: ZONE }).map(
      (entry) => entry.id,
    ),
    ["t"],
  );
});

test("a civil query stays the civil day it names, whatever zone runs the calendar", () => {
  const allDay = normalizeEvent({ id: "ad", allDay: true, start: "2026-09-03", end: "2026-09-04" });
  // From the calendar's own zone and from a far-away zone, "2026-09-03" is
  // still the same civil day: both query and event project in `timeZone`.
  for (const timeZone of [ZONE, "America/Los_Angeles"]) {
    assert.deepEqual(
      queryOverlaps({ events: [allDay], range: { start: "2026-09-03", end: "2026-09-04" }, timeZone }).map(
        (entry) => entry.id,
      ),
      ["ad"],
    );
  }
  // An instant that is late Sep 3 in Los Angeles is Sep 4 morning in
  // Brussels: the Brussels all-day event does not cover it.
  assert.deepEqual(
    queryOverlaps({
      events: [allDay],
      range: {
        start: "2026-09-03T20:00:00-07:00[America/Los_Angeles]",
        end: "2026-09-03T21:00:00-07:00[America/Los_Angeles]",
      },
      timeZone: ZONE,
    }),
    [],
  );
});

test("queryRangeContext requires a range and returns empty shapes for empty ranges", () => {
  assert.throws(
    () => queryRangeContext({ events: [], range: /** @type {any} */ (null) }),
    /getRangeContext requires \{ start, end \}/,
  );
  assert.deepEqual(
    queryRangeContext({ events: [], range: { start: at("10:00"), end: at("10:00") }, timeZone: ZONE }),
    {
      events: { overlapping: [] },
      backgrounds: { overlapping: [], covering: [] },
    },
  );
});

test("queryRangeContext separates overlapping from covering backgrounds", () => {
  const ranges = backgrounds([
    { id: "cover", start: at("09:00"), end: at("12:00") },
    { id: "edge", start: at("10:00"), end: at("11:00") },
    { id: "partial", start: at("10:30"), end: at("11:30") },
  ]);
  const context = queryRangeContext({
    backgrounds: ranges,
    range: { start: at("10:00"), end: at("11:00") },
    timeZone: ZONE,
  });
  assert.deepEqual(
    context.backgrounds.overlapping.map((entry) => entry.id),
    ["cover", "edge", "partial"],
  );
  assert.deepEqual(
    context.backgrounds.covering.map((entry) => entry.id),
    ["cover", "edge"],
  );
});

test("a 09:00-12:00 background overlaps but never covers a later partial query", () => {
  const ranges = backgrounds([{ id: "morning", start: at("09:00"), end: at("12:00") }]);
  const context = queryRangeContext({
    backgrounds: ranges,
    range: { start: at("11:30"), end: at("12:30") },
    timeZone: ZONE,
  });
  assert.deepEqual(
    context.backgrounds.overlapping.map((entry) => entry.id),
    ["morning"],
  );
  assert.deepEqual(context.backgrounds.covering, []);
});

test("a timed background never covers a whole civil day query", () => {
  const ranges = backgrounds([{ id: "morning", start: at("09:00"), end: at("12:00") }]);
  const context = queryRangeContext({
    backgrounds: ranges,
    range: { start: "2026-09-03", end: "2026-09-04" },
    timeZone: ZONE,
  });
  assert.deepEqual(
    context.backgrounds.overlapping.map((entry) => entry.id),
    ["morning"],
  );
  assert.deepEqual(context.backgrounds.covering, []);
});

test("queryRangeContext keeps every covering background: the core picks none", () => {
  const ranges = backgrounds([
    { id: "availability", start: at("08:00"), end: at("18:00") },
    { id: "exception", start: at("08:00"), end: at("18:00"), resourceId: "room-a" },
  ]);
  const list = events([{ id: "booking", start: at("10:00"), end: at("11:00"), resourceId: "room-a" }]);
  const context = queryRangeContext({
    events: list,
    backgrounds: ranges,
    range: { start: at("10:00"), end: at("11:00") },
    timeZone: ZONE,
    resourceId: "room-a",
  });
  assert.deepEqual(
    context.events.overlapping.map((entry) => entry.id),
    ["booking"],
  );
  assert.deepEqual(
    context.backgrounds.covering.map((entry) => entry.id),
    ["availability", "exception"],
  );
});

test("queryRangeContext scopes by resource; resourceless backgrounds stay global", () => {
  const list = events([
    { id: "a", start: at("09:00"), end: at("10:00"), resourceId: "room-a" },
    { id: "b", start: at("09:00"), end: at("10:00"), resourceId: "room-b" },
    { id: "unassigned", start: at("09:00"), end: at("10:00") },
  ]);
  const ranges = backgrounds([
    { id: "global", start: at("09:00"), end: at("10:00") },
    { id: "scoped", start: at("09:00"), end: at("10:00"), resourceId: "room-b" },
  ]);
  const range = { start: at("09:15"), end: at("09:45") };
  const scoped = queryRangeContext({
    events: list,
    backgrounds: ranges,
    range,
    timeZone: ZONE,
    resourceId: "room-a",
  });
  assert.deepEqual(
    scoped.events.overlapping.map((entry) => entry.id),
    ["a"],
  );
  assert.deepEqual(
    scoped.backgrounds.overlapping.map((entry) => entry.id),
    ["global"],
  );
  const unscoped = queryRangeContext({ events: list, backgrounds: ranges, range, timeZone: ZONE });
  assert.deepEqual(
    unscoped.events.overlapping.map((entry) => entry.id),
    ["a", "b", "unassigned"],
  );
  assert.deepEqual(
    unscoped.backgrounds.covering.map((entry) => entry.id),
    ["global", "scoped"],
  );
});

test("queryRangeContext projects all-day bounds to local midnights", () => {
  const allDay = normalizeEvent({ id: "ad", allDay: true, start: "2026-09-03", end: "2026-09-04" });
  const context = queryRangeContext({
    events: [allDay],
    range: { start: at("09:00"), end: at("09:30") },
    timeZone: ZONE,
  });
  assert.deepEqual(
    context.events.overlapping.map((entry) => entry.id),
    ["ad"],
  );
});
