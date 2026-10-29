import assert from "node:assert/strict";
import test from "node:test";
import { orderMonthEvents } from "../../src/core/event-order.js";
import { normalizeEvent } from "../../src/core/model.js";

const events = [
  normalizeEvent({
    id: "late",
    start: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T13:00:00+02:00[Europe/Brussels]",
  }),
  normalizeEvent({
    id: "early",
    start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
  }),
  normalizeEvent({ id: "all", allDay: true, start: "2026-09-03", end: "2026-09-04" }),
];

test("month order defaults and comparator ties use zoned start instants without mutation", () => {
  assert.deepEqual(
    orderMonthEvents(events, "Europe/Brussels").map((event) => event.id),
    ["all", "early", "late"],
  );
  assert.deepEqual(
    orderMonthEvents(events, "Europe/Brussels", () => 0).map((event) => event.id),
    ["all", "early", "late"],
  );
  assert.deepEqual(
    events.map((event) => event.id),
    ["late", "early", "all"],
  );
});

test("custom month comparator overrides time and stable ties preserve source order", () => {
  assert.deepEqual(
    orderMonthEvents(events, "Europe/Brussels", (a, b) => b.id.localeCompare(a.id)).map((event) => event.id),
    ["late", "early", "all"],
  );
  const same = normalizeEvent({ ...events[1], id: "same" });
  assert.deepEqual(
    orderMonthEvents([events[1], same], "UTC").map((event) => event.id),
    ["early", "same"],
  );
});
