import assert from "node:assert/strict";
import test from "node:test";
import { eventGeometry, minutesToPixels, pixelsToMinutes, snapMinutes } from "../../src/core/geometry.js";

test("minutes and pixels are inverse operations", () => {
  assert.equal(minutesToPixels(20, 2.5), 50);
  assert.equal(pixelsToMinutes(50, 2.5), 20);
});

test("snapMinutes supports round/floor/ceil", () => {
  assert.equal(snapMinutes(18, 20), 20);
  assert.equal(snapMinutes(18, 20, "floor"), 0);
  assert.equal(snapMinutes(18, 20, "ceil"), 20);
});

test("event geometry maps time to top and height", () => {
  assert.deepEqual(
    eventGeometry({ startMinutes: 540, endMinutes: 560, dayStartMinutes: 480, pxPerMinute: 2.6, gap: 2 }),
    { top: 156, height: 50 },
  );
});
