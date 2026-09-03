import assert from "node:assert/strict";
import test from "node:test";
import { hitTest } from "../../src/core/hit.js";

const columns = [
  { date: "2026-09-03", resource: null, rect: { left: 56, top: 100, right: 256, bottom: 1180 } },
  { date: "2026-09-04", resource: { id: "room-a" }, rect: { left: 256, top: 100, right: 456, bottom: 1180 } },
];

const base = { columns, slotMin: 480, slotMax: 1080, pxPerMinute: 1.8 };

test("hit inside a column resolves date and minutes", () => {
  const hit = hitTest({ ...base, x: 100, y: 100 + 60 * 1.8 });
  assert(hit);
  assert.equal(hit.column, 0);
  assert.equal(hit.date, "2026-09-03");
  assert.equal(hit.resource, null);
  assert.equal(hit.minutes, 540);
});

test("hit resolves the resource-aware column", () => {
  const hit = hitTest({ ...base, x: 300, y: 200 });
  assert(hit);
  assert.equal(hit.column, 1);
  assert.deepEqual(hit.resource, { id: "room-a" });
});

test("hit outside every column returns null", () => {
  assert.equal(hitTest({ ...base, x: 10, y: 200 }), null);
  assert.equal(hitTest({ ...base, x: 100, y: 50 }), null);
  assert.equal(hitTest({ ...base, x: 100, y: 1200 }), null);
});

test("slot start boundary resolves exactly", () => {
  const edge = hitTest({ ...base, x: 100, y: 100 });
  assert(edge);
  assert.equal(edge.minutes, 480);
});

test("position past the slot end clamps to slot max", () => {
  const tall = {
    ...base,
    columns: [{ date: "2026-09-03", resource: null, rect: { left: 56, top: 100, right: 256, bottom: 3000 } }],
  };
  const hit = hitTest({ ...tall, x: 100, y: 100 + 2000 });
  assert(hit);
  assert.equal(hit.minutes, 1080);
});

test("temporal result is independent of pxPerMinute", () => {
  const loose = hitTest({ ...base, pxPerMinute: 1.8, x: 100, y: 100 + 90 * 1.8 });
  assert(loose);
  const dense = hitTest({ ...base, pxPerMinute: 3.6, x: 100, y: 100 + 90 * 3.6 });
  assert(dense);
  assert.equal(loose.minutes, dense.minutes);
});
