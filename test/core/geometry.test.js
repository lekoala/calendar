import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultSnapThreshold,
  eventGeometry,
  findSnapTarget,
  minutesToPixels,
  pixelsToMinutes,
  snapMinutes,
} from "../../src/core/geometry.js";

test("minutes and pixels are inverse operations", () => {
  assert.equal(minutesToPixels(20, 2.5), 50);
  assert.equal(pixelsToMinutes(50, 2.5), 20);
});

test("snapMinutes supports round/floor/ceil", () => {
  assert.equal(snapMinutes(18, 20), 20);
  assert.equal(snapMinutes(18, 20, "floor"), 0);
  assert.equal(snapMinutes(18, 20, "ceil"), 20);
});

test("snapMinutes tolerates float noise at exact boundaries", () => {
  // Rect/pointer math yields 659.9999999999 for an exact 660 on browsers
  // with fractional layout pixels; the boundary must still hold.
  assert.equal(snapMinutes(659.9999999999, 15, "floor"), 660);
  assert.equal(snapMinutes(660.0000000001, 15, "ceil"), 660);
  // Genuine sub-step values keep their side of the boundary.
  assert.equal(snapMinutes(659.99, 15, "floor"), 645);
  assert.equal(snapMinutes(660.01, 15, "ceil"), 675);
});

test("event geometry maps time to top and height", () => {
  assert.deepEqual(
    eventGeometry({ startMinutes: 540, endMinutes: 560, dayStartMinutes: 480, pxPerMinute: 2.6, gap: 2 }),
    { top: 156, height: 50 },
  );
});

test("defaultSnapThreshold is half a step capped at 5 minutes", () => {
  assert.equal(defaultSnapThreshold(15), 5);
  assert.equal(defaultSnapThreshold(20), 5);
  assert.equal(defaultSnapThreshold(6), 3);
  assert.throws(() => defaultSnapThreshold(0), TypeError);
});

test("findSnapTarget attracts to the nearest edge within threshold", () => {
  // 20-minute slots, predecessor ending at 10:10 (610): pointer at 10:12
  // snaps to 610 instead of flooring to 600.
  assert.equal(findSnapTarget(612, [600, 610], 5), 610);
  assert.equal(findSnapTarget(607, [600, 610], 5), 610);
  // Beyond the threshold the grid snap applies (null = no magnet).
  assert.equal(findSnapTarget(616, [600, 610], 5), null);
  assert.equal(findSnapTarget(612, [], 5), null);
  assert.equal(findSnapTarget(612, [610], 0), null);
  // Nearest edge wins on ties by distance.
  assert.equal(findSnapTarget(605, [600, 610], 5), 600);
});
