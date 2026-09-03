import assert from "node:assert/strict";
import test from "node:test";
import {
  isMovable,
  isResizable,
  normalizeBackground,
  normalizeEvent,
  normalizeResource,
} from "../../src/core/model.js";

test("normalizeEvent applies defaults and copies metadata", () => {
  const event = normalizeEvent({ id: "a", start: "s", end: "e" });
  assert.equal(event.id, "a");
  assert.equal(event.editable, true);
  assert.deepEqual(event.classNames, []);
  assert.deepEqual(event.extendedProps, {});
});

test("normalizeEvent stringifies ids and clones arrays", () => {
  const classNames = ["hot"];
  const event = normalizeEvent({ id: 7, start: "s", end: "e", classNames, extendedProps: { n: 1 } });
  assert.equal(event.id, "7");
  assert.deepEqual(event.classNames, ["hot"]);
  assert.notEqual(event.classNames, classNames);
});

test("normalizeEvent rejects incomplete payloads", () => {
  assert.throws(() => normalizeEvent({ id: "a", start: "s" }), TypeError);
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
  const background = normalizeBackground({ id: "bg", start: "s", end: "e", resourceId: "room-a" });
  assert.equal(background.resourceId, "room-a");
  assert.deepEqual(background.classNames, []);
  assert.throws(() => normalizeBackground({ id: "bg", start: "s" }), TypeError);
});
