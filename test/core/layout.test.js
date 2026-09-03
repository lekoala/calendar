import assert from "node:assert/strict";
import test from "node:test";
import { layoutEvents } from "../../src/core/layout.js";

test("prototype layout keeps events full width until overlap engine lands", () => {
  const [item] = layoutEvents([{ id: "a" }]);
  assert.equal(item.left, 0);
  assert.equal(item.width, 1);
  assert.equal(item.columns, 1);
});
