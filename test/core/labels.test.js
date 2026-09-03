import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LABELS, formatLabel, resolveLabels } from "../../src/core/labels.js";

test("resolveLabels returns the English defaults without input", () => {
  assert.deepEqual(resolveLabels(), DEFAULT_LABELS);
  assert.deepEqual(resolveLabels(null), DEFAULT_LABELS);
  assert.equal(resolveLabels().noEvents, "No events");
  assert.equal(resolveLabels().more, "+{hidden} more");
});

test("resolveLabels merges an instance override over the defaults", () => {
  const labels = resolveLabels({ noEvents: "Aucun évènement", more: "+{hidden} en plus" });
  assert.equal(labels.noEvents, "Aucun évènement");
  assert.equal(labels.more, "+{hidden} en plus");
  assert.equal(labels.calendarRegion, "Calendar");
});

test("formatLabel fills placeholders and drops unknown ones", () => {
  assert.equal(formatLabel("+{hidden} more", { hidden: 2 }), "+2 more");
  assert.equal(formatLabel("Page {page} of {pages}", { page: 1, pages: 4 }), "Page 1 of 4");
  assert.equal(formatLabel("{known} {missing}", { known: "x" }), "x ");
  assert.equal(formatLabel("No events", { hidden: 1 }), "No events");
});
