import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import {
  backgroundAppliesToColumn,
  eventBelongsToColumn,
  getResourceColumns,
  getTimeGridColumns,
} from "../../src/core/resources.js";

const dates = [Temporal.PlainDate.from("2026-09-03"), Temporal.PlainDate.from("2026-09-04")];
const resources = [
  { id: "room-a", title: "Room A" },
  { id: "room-b", title: "Room B" },
];

test("solo columns carry no resource", () => {
  assert.deepEqual(getTimeGridColumns(dates), [
    { date: dates[0], resource: null },
    { date: dates[1], resource: null },
  ]);
});

test("resource columns follow resource -> dates order", () => {
  const columns = getResourceColumns(resources, dates);
  assert.equal(columns.length, 4);
  assert.deepEqual(
    columns.map((column) => `${column.resource?.id}@${column.date.toString()}`),
    ["room-a@2026-09-03", "room-a@2026-09-04", "room-b@2026-09-03", "room-b@2026-09-04"],
  );
});

test("empty resources yield zero columns, never a solo fallback", () => {
  assert.deepEqual(getResourceColumns([], dates), []);
});

test("events belong to exactly one resource column", () => {
  const [columnA, columnB] = getResourceColumns(resources, [dates[0]]);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, columnA), true);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, columnB), false);
  assert.equal(eventBelongsToColumn({}, columnA), false);
  assert.equal(eventBelongsToColumn({ resourceId: null }, columnB), false);
});

test("solo columns accept events with or without resource", () => {
  const [solo] = getTimeGridColumns([dates[0]]);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, solo), true);
  assert.equal(eventBelongsToColumn({}, solo), true);
});

test("backgrounds without resource are global", () => {
  const [columnA, columnB] = getResourceColumns(resources, [dates[0]]);
  assert.equal(backgroundAppliesToColumn({}, columnA), true);
  assert.equal(backgroundAppliesToColumn({}, columnB), true);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, columnA), true);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, columnB), false);
  const [solo] = getTimeGridColumns([dates[0]]);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, solo), true);
});
