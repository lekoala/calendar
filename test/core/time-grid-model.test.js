import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import { normalizeBackground, normalizeEvent, normalizeResource } from "../../src/core/model.js";
import { deriveTimedColumn } from "../../src/core/time-grid-model.js";

test("timed column models clip ranges and lay out only the events applicable to the column", () => {
  const date = Temporal.PlainDate.from("2026-09-03");
  const options = { timeZone: "UTC", slotMin: 540, slotMax: 720, pxPerMinute: 2 };
  const start = "2026-09-03T08:30:00Z[UTC]";
  const end = "2026-09-03T10:00:00Z[UTC]";
  const events = [
    normalizeEvent({ id: "a", resourceId: "a", start, end }),
    normalizeEvent({ id: "b", resourceId: "b", start, end }),
    normalizeEvent({ id: "all-day", allDay: true, start: "2026-09-03", end: "2026-09-04" }),
  ];
  const backgrounds = [
    normalizeBackground({ id: "global", start, end }),
    normalizeBackground({ id: "only-b", resourceId: "b", start, end }),
  ];
  const solo = deriveTimedColumn({ date, resource: null }, events, backgrounds, options);
  assert.deepEqual(
    solo.events.map(({ event, width }) => [event.id, width]),
    [
      ["a", 0.5],
      ["b", 0.5],
    ],
  );
  const column = deriveTimedColumn(
    { date, resource: normalizeResource({ id: "a" }) },
    events,
    backgrounds,
    options,
  );
  assert.deepEqual(
    column.events.map(({ event, start, end, width }) => [event.id, start, end, width]),
    [["a", 540, 600, 1]],
  );
  assert.deepEqual(
    column.backgrounds.map(({ background, geometry }) => [background.id, geometry]),
    [["global", { top: 0, height: 120 }]],
  );
});
