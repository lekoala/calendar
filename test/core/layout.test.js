import assert from "node:assert/strict";
import test from "node:test";
import { layoutDaySegments, layoutEvents } from "../../src/core/layout.js";

/**
 * @param {Array<[number, number]>} ranges
 */
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
  /**
   * @param {Array<{ event: { id: string }, column: number }>} items
   */
  const byId = (items) =>
    [
      ...new Map(
        items.map(
          /** @param {{ event: { id: string }, column: number }} item */ (item) => [
            item.event.id,
            item.column,
          ],
        ),
      ),
    ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
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

/**
 * @param {Array<{ startDay: number, endDay: number, resourceId?: string | null }>} segs
 */
function lane(segs) {
  return layoutDaySegments(
    segs.map((segment) => ({
      event: { id: `${segment.startDay}-${segment.endDay}-${segment.resourceId ?? "solo"}` },
      resourceId: segment.resourceId ?? null,
      startDay: segment.startDay,
      endDay: segment.endDay,
    })),
  );
}

test("single all-day segment lands on row zero", () => {
  const [segment] = lane([{ startDay: 0, endDay: 1 }]);
  assert.equal(segment.row, 0);
});

test("same-room overlapping days stack, adjacent days share a row", () => {
  const [span, inside, next] = lane([
    { startDay: 0, endDay: 3, resourceId: "a" },
    { startDay: 1, endDay: 2, resourceId: "a" },
    { startDay: 3, endDay: 4, resourceId: "a" },
  ]);
  assert.deepEqual([span.row, inside.row], [0, 1]);
  // `[0,3)` ends where `[3,4)` starts: half-open, no row conflict.
  assert.equal(next.row, 0);
});

test("different resources never fight for a row", () => {
  const [a, b] = lane([
    { startDay: 0, endDay: 5, resourceId: "a" },
    { startDay: 0, endDay: 5, resourceId: "b" },
  ]);
  assert.equal(a.row, 0);
  assert.equal(b.row, 0);
});

test("unassigned bars stack against the other unassigned bars only", () => {
  const [one, two, other] = lane([
    { startDay: 0, endDay: 2, resourceId: null },
    { startDay: 1, endDay: 3, resourceId: null },
    { startDay: 0, endDay: 2, resourceId: "b" },
  ]);
  assert.deepEqual([one.row, two.row], [0, 1]);
  // A different room ignores the unassigned rows entirely.
  assert.equal(other.row, 0);
});

test("all-day row packing stays deterministic after reorder", () => {
  const forward = lane([
    { startDay: 0, endDay: 2, resourceId: "a" },
    { startDay: 1, endDay: 3, resourceId: "a" },
    { startDay: 0, endDay: 4, resourceId: "b" },
  ]);
  const reversed = lane([
    { startDay: 0, endDay: 4, resourceId: "b" },
    { startDay: 1, endDay: 3, resourceId: "a" },
    { startDay: 0, endDay: 2, resourceId: "a" },
  ]);
  /**
   * @param {Array<{ event: { id: string }, row: number }>} items
   * @returns {Array<[string, number]>}
   */
  const rowsById = (items) =>
    [...new Map(items.map((item) => [String(item.event.id), item.row]))].sort((a, b) =>
      a[0] < b[0] ? -1 : 1,
    );
  assert.deepEqual(rowsById(forward), rowsById(reversed));
});
