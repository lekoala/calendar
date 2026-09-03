import assert from "node:assert/strict";
import test from "node:test";
import { layoutEvents } from "../../src/core/layout.js";

function lay(ranges) {
  return layoutEvents(ranges.map(([start, end]) => ({ event: { id: `${start}-${end}` }, start, end })));
}

test("single event fills the column", () => {
  const [item] = lay([[540, 600]]);
  assert.deepEqual([item.column, item.columns, item.left, item.width], [0, 1, 0, 1]);
});

test("adjacent events do not overlap", () => {
  const [first, second] = lay([
    [540, 600],
    [600, 660],
  ]);
  assert.equal(first.columns, 1);
  assert.equal(second.columns, 1);
  assert.equal(second.column, 0);
});

test("two overlapping events share the width", () => {
  const [first, second] = lay([
    [540, 600],
    [570, 630],
  ]);
  assert.deepEqual([first.column, first.columns], [0, 2]);
  assert.deepEqual([second.column, second.columns], [1, 2]);
  assert.equal(first.width, 0.5);
});

test("three overlapping events split in thirds", () => {
  const items = lay([
    [540, 600],
    [550, 610],
    [560, 620],
  ]);
  assert.deepEqual(
    items.map((item) => item.column),
    [0, 1, 2],
  );
  for (const item of items) assert.equal(item.columns, 3);
});

test("nested event joins its container group", () => {
  const [outer, inner] = lay([
    [540, 660],
    [570, 600],
  ]);
  assert.equal(outer.columns, 2);
  assert.equal(inner.columns, 2);
  assert.notEqual(outer.column, inner.column);
});

test("chained overlaps form one transitive group", () => {
  const [a, b, c] = lay([
    [540, 600],
    [570, 630],
    [600, 660],
  ]);
  // a meets b, b meets c: one group of two columns even though a never meets c.
  assert.deepEqual([a.columns, b.columns, c.columns], [2, 2, 2]);
  assert.equal(c.column, 0);
});

test("event spanning a group shares the group width", () => {
  const [span, left, right] = lay([
    [540, 660],
    [540, 570],
    [600, 630],
  ]);
  assert.deepEqual([span.columns, left.columns, right.columns], [2, 2, 2]);
});

test("placement is deterministic after input reorder", () => {
  const forward = lay([
    [540, 600],
    [550, 570],
    [580, 640],
  ]);
  const reversed = lay([
    [580, 640],
    [550, 570],
    [540, 600],
  ]);
  const byId = (items) =>
    [...new Map(items.map((item) => [item.event.id, item.column]))].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  assert.deepEqual(byId(forward), byId(reversed));
});

test("same start and end ties split deterministically", () => {
  const [first, second] = lay([
    [540, 600],
    [540, 600],
  ]);
  assert.deepEqual([first.column, second.column], [0, 1]);
  assert.equal(first.columns, 2);
});
