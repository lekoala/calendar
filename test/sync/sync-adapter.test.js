import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRemoteUpdate,
  buildPatch,
  decideOnConflict,
  shouldIgnoreEcho,
} from "../../demo/sync-adapter.js";

const DRAG = {
  start: "2026-09-03T10:15:00+02:00[Europe/Brussels]",
  end: "2026-09-03T10:45:00+02:00[Europe/Brussels]",
  resourceId: "room-a",
};

test("buildPatch carries the committed state with sync metadata", () => {
  const patch = buildPatch({
    event: { id: "event-1", extendedProps: { revision: 42 } },
    current: DRAG,
    origin: "drag",
    clientId: "client-a",
    mutationId: "mutation-1",
  });
  assert.deepEqual(patch, {
    id: "event-1",
    start: DRAG.start,
    end: DRAG.end,
    resourceId: "room-a",
    revision: 42,
    mutationId: "mutation-1",
    clientId: "client-a",
    origin: "drag",
  });
});

test("buildPatch defaults a missing revision to zero and nulls the resource", () => {
  const patch = buildPatch({
    event: { id: "event-1", extendedProps: {} },
    current: { start: DRAG.start, end: DRAG.end, resourceId: null },
    origin: "edit",
    clientId: "client-a",
    mutationId: "mutation-2",
  });
  assert.equal(patch.revision, 0);
  assert.equal(patch.resourceId, null);
});

test("buildPatch honors an explicit base revision override", () => {
  const patch = buildPatch({
    event: { id: "event-1", extendedProps: { revision: 7 } },
    current: DRAG,
    origin: "resize",
    clientId: "client-a",
    mutationId: "mutation-3",
    baseRevision: 9,
  });
  assert.equal(patch.revision, 9);
});

test("shouldIgnoreEcho drops the sender's own echo only", () => {
  const recent = new Set(["mutation-1", "mutation-2"]);
  assert.equal(shouldIgnoreEcho({ mutationId: "mutation-1", revision: 43 }, recent), true);
  assert.equal(shouldIgnoreEcho({ mutationId: "mutation-9", revision: 44 }, recent), false);
  assert.equal(shouldIgnoreEcho({ revision: 44 }, recent), false);
});

test("decideOnConflict reloads silently when both sides converged", () => {
  const decision = decideOnConflict({ local: DRAG, remote: { ...DRAG, revision: 44 } });
  assert.equal(decision.action, "reload");
  assert.deepEqual(decision.remote, {
    start: DRAG.start,
    end: DRAG.end,
    resourceId: "room-a",
  });
});

test("decideOnConflict offers reload and reapply on a real divergence", () => {
  const remote = {
    start: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T11:30:00+02:00[Europe/Brussels]",
    resourceId: "room-b",
    revision: 43,
  };
  const decision = decideOnConflict({ local: DRAG, remote });
  assert.equal(decision.action, "choose");
  assert.deepEqual(decision.reload, {
    start: remote.start,
    end: remote.end,
    resourceId: "room-b",
  });
  assert.deepEqual(decision.reapply, {
    start: DRAG.start,
    end: DRAG.end,
    resourceId: "room-a",
  });
});

/**
 * Minimal calendar double: records calls, applies nothing.
 *
 * @returns {{ calls: string[], batch: (fn: () => void) => void, addEvent: () => void, updateEvent: () => void, removeEvent: () => void }}
 */
function fakeCalendar() {
  const calls = [];
  return {
    calls,
    batch(callback) {
      calls.push("batch");
      callback();
    },
    addEvent() {
      calls.push("addEvent");
    },
    updateEvent() {
      calls.push("updateEvent");
    },
    removeEvent() {
      calls.push("removeEvent");
    },
  };
}

test("applyRemoteUpdate routes created, updated and deleted", () => {
  const calendar = fakeCalendar();
  const event = { id: "event-1", ...DRAG };
  assert.equal(applyRemoteUpdate(calendar, { type: "created", event }), true);
  assert.equal(applyRemoteUpdate(calendar, { type: "updated", event }), true);
  assert.equal(applyRemoteUpdate(calendar, { type: "deleted", id: "event-1" }), true);
  assert.deepEqual(calendar.calls, ["batch", "addEvent", "batch", "updateEvent", "batch", "removeEvent"]);
});

test("applyRemoteUpdate rejects unknown types without touching the calendar", () => {
  const calendar = fakeCalendar();
  assert.equal(applyRemoteUpdate(calendar, { type: "renamed", event: { id: "event-1" } }), false);
  assert.equal(applyRemoteUpdate(calendar, { type: "updated" }), false);
  assert.deepEqual(calendar.calls, []);
});
