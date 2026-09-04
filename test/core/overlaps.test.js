import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBackground, normalizeEvent } from "../../src/core/model.js";
import { queryOverlaps, rangesOverlap } from "../../src/core/overlaps.js";

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
