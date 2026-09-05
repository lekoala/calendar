import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import {
  isMovable,
  isResizable,
  normalizeBackground,
  normalizeEvent,
  normalizeRangeBound,
  normalizeResource,
  sameRange,
} from "../../src/core/model.js";

const TIMED = {
  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
};

test("normalizeEvent applies defaults and copies metadata", () => {
  const event = normalizeEvent({ id: "a", ...TIMED });
  assert.equal(event.id, "a");
  assert.equal(event.allDay, false);
  assert.deepEqual(event.classNames, []);
  assert.deepEqual(event.extendedProps, {});
  assert.ok(event.start instanceof Temporal.ZonedDateTime);
});

test("normalizeEvent stringifies ids and clones arrays", () => {
  const classNames = ["hot"];
  const event = normalizeEvent({ id: 7, ...TIMED, classNames, extendedProps: { n: 1 } });
  assert.equal(event.id, "7");
  assert.deepEqual(event.classNames, ["hot"]);
  assert.notEqual(event.classNames, classNames);
});

test("normalizeEvent rejects incomplete payloads", () => {
  assert.throws(() => normalizeEvent({ id: "a", start: "s" }), TypeError);
});

test("normalizeEvent turns all-day boundaries into civil dates", () => {
  const event = normalizeEvent({ id: "a", allDay: true, start: "2026-09-03", end: "2026-09-05" });
  assert.equal(event.allDay, true);
  assert.ok(event.start instanceof Temporal.PlainDate);
  assert.equal(event.start.toString(), "2026-09-03");
  assert.equal(String(event.end), "2026-09-05");
});

test("normalizeRangeBound is strict about which type the flag allows", () => {
  // All-day only takes PlainDate / YYYY-MM-DD strings.
  assert.equal(normalizeRangeBound("2026-09-03", true).toString(), "2026-09-03");
  assert.throws(() => normalizeRangeBound(TIMED.start, true), TypeError);
  // Timed only takes ZonedDateTime / ISO-with-zone strings.
  assert.equal(normalizeRangeBound(TIMED.start, false).toString(), TIMED.start);
  assert.throws(() => normalizeRangeBound("2026-09-03", false), TypeError);
  // A date-only string never silently flips into an instant.
  assert.throws(() => normalizeRangeBound("2026-09-03", false), TypeError);
});

test("normalizeEvent leaves editable undecided so the calendar default applies", () => {
  const event = normalizeEvent({ id: "a", ...TIMED });
  // An injected `editable: true` would outrank `configure({ editable: false })`.
  assert.equal(event.editable, undefined);
  assert.equal(isMovable(event, false), false);
  assert.equal(isResizable(event, false), false);
  assert.equal(isMovable(event, true), true);
  // An explicit event flag still wins over the calendar default.
  assert.equal(isMovable(normalizeEvent({ id: "b", ...TIMED, editable: true }), false), true);
});

test("movable/resizable resolve through editable then calendar default", () => {
  assert.equal(isMovable({ movable: false, editable: true }), false);
  assert.equal(isMovable({ editable: false }), false);
  assert.equal(isMovable({}, false), false);
  assert.equal(isMovable({}, undefined), true);
  assert.equal(isResizable({ resizable: false, editable: true }), false);
  assert.equal(isResizable({ editable: false }), false);
  assert.equal(isResizable({}, true), true);
});

test("sameRange compares the three fields an optimistic commit owns", () => {
  const event = normalizeEvent({ id: "a", ...TIMED, resourceId: "r1" });
  const same = normalizeEvent({ id: "b", ...TIMED, resourceId: "r1" });
  assert.equal(sameRange(event, same), true);
  assert.equal(sameRange(event, { ...same, resourceId: "r2" }), false);
  assert.equal(sameRange(event, { ...same, end: same.start }), false);
  // A missing resourceId reads as null, so both spellings agree.
  const global = normalizeEvent({ id: "c", ...TIMED });
  assert.equal(sameRange(global, { ...global, resourceId: null }), true);
  // Civil and timed bounds never compare equal across types.
  const allDay = normalizeEvent({ id: "d", allDay: true, start: "2026-09-03", end: "2026-09-04" });
  assert.equal(sameRange(allDay, event), false);
  assert.equal(
    sameRange(allDay, normalizeEvent({ id: "e", allDay: true, start: "2026-09-03", end: "2026-09-04" })),
    true,
  );
});

test("normalizeResource applies generic defaults", () => {
  const resource = normalizeResource({ id: "room-a" });
  assert.equal(resource.id, "room-a");
  assert.equal(resource.title, "room-a");
  assert.equal(resource.selectable, true);
  assert.equal(resource.droppable, true);
  assert.deepEqual(resource.classNames, []);
});

test("normalizeResource preserves explicit permissions", () => {
  const resource = normalizeResource({ id: "room-a", selectable: false, title: "Room A" });
  assert.equal(resource.selectable, false);
  assert.equal(resource.droppable, true);
  assert.equal(resource.title, "Room A");
});

test("normalizeBackground requires id/start/end and defaults metadata", () => {
  const background = normalizeBackground({ id: "bg", ...TIMED, resourceId: "room-a" });
  assert.equal(background.resourceId, "room-a");
  assert.equal(background.allDay, false);
  assert.deepEqual(background.classNames, []);
  assert.throws(() => normalizeBackground({ id: "bg", start: "s" }), TypeError);
});

test("normalizeBackground shares the civil contract", () => {
  const background = normalizeBackground({
    id: "bg",
    allDay: true,
    start: "2026-09-03",
    end: "2026-09-04",
  });
  assert.equal(background.allDay, true);
  assert.ok(background.start instanceof Temporal.PlainDate);
});
