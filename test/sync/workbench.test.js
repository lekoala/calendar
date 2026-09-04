import assert from "node:assert/strict";
import test from "node:test";
import { MoveWorkbench } from "../../demo/workbench.js";

/** @param {string} id */
const evt = (id) => ({ id, title: id, start: "t", end: "t" });

test("a fresh workbench is empty and disarmed", () => {
  const workbench = new MoveWorkbench();
  assert.equal(workbench.size, 0);
  assert.equal(workbench.activeId, null);
  assert.deepEqual(workbench.items, []);
});

test("add queues an event once and emits a single change", () => {
  const workbench = new MoveWorkbench();
  let changes = 0;
  workbench.addEventListener("change", () => {
    changes += 1;
  });
  assert.equal(workbench.add(evt("a")), true);
  assert.equal(workbench.add(evt("a")), false);
  assert.equal(workbench.has("a"), true);
  assert.equal(workbench.size, 1);
  assert.equal(workbench.items[0].eventId, "a");
  assert.equal(workbench.items[0].status, "pending");
  assert.equal(changes, 1);
});

test("addMany sizes a batch in one change beat", () => {
  const workbench = new MoveWorkbench();
  let changes = 0;
  workbench.addEventListener("change", () => {
    changes += 1;
  });
  const added = workbench.addMany(["a", "b", "c", "a"].map(evt));
  assert.equal(added, 3);
  assert.equal(workbench.size, 3);
  assert.equal(changes, 1);
});

test("activate arms the active item and rejects unknown ids", () => {
  const workbench = new MoveWorkbench();
  workbench.addMany(["a", "b"].map(evt));
  workbench.activate("b");
  assert.equal(workbench.activeId, "b");
  assert.equal(workbench.active?.eventId, "b");
  workbench.activate("missing");
  assert.equal(workbench.activeId, "b");
  workbench.activate(null);
  assert.equal(workbench.activeId, null);
});

test("remove drops the item and disarms it when it was active", () => {
  const workbench = new MoveWorkbench();
  workbench.addMany(["a", "b"].map(evt));
  workbench.activate("a");
  assert.equal(workbench.remove("a"), true);
  assert.equal(workbench.has("a"), false);
  assert.equal(workbench.activeId, null);
  assert.equal(workbench.remove("missing"), false);
});

test("clear empties the workbench and disarms everything", () => {
  const workbench = new MoveWorkbench();
  workbench.addMany(["a", "b"].map(evt));
  workbench.activate("a");
  workbench.clear();
  assert.equal(workbench.size, 0);
  assert.equal(workbench.activeId, null);
  assert.deepEqual(workbench.items, []);
});

test("complete removes a placed item and arms the next pending one", () => {
  const workbench = new MoveWorkbench();
  workbench.addMany(["a", "b", "c"].map(evt));
  workbench.activate("a");
  assert.equal(workbench.complete("a"), true);
  assert.equal(workbench.has("a"), false);
  assert.equal(workbench.activeId, "b");
  // Removing the last one disarms rather than wrapping around.
  assert.equal(workbench.complete("b"), true);
  assert.equal(workbench.activeId, "c");
  assert.equal(workbench.complete("c"), true);
  assert.equal(workbench.activeId, null);
});

test("items returns copies, so callers cannot mutate state through it", () => {
  const workbench = new MoveWorkbench();
  workbench.add(evt("a"));
  const items = workbench.items;
  items[0].eventId = "hacked";
  assert.equal(workbench.has("a"), true);
  assert.equal(workbench.has("hacked"), false);
});
