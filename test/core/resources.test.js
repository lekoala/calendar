import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import {
  backgroundAppliesToColumn,
  eventBelongsToColumn,
  getResourceColumns,
  getTimeGridColumns,
  groupResources,
} from "../../src/core/resources.js";

const dates = [Temporal.PlainDate.from("2026-09-03"), Temporal.PlainDate.from("2026-09-04")];
const resources = [
  { id: "room-a", title: "Room A" },
  { id: "room-b", title: "Room B" },
];

test("solo columns carry no resource", () => {
  assert.deepEqual(getTimeGridColumns(dates), [
    { date: dates[0], resource: null },
    { date: dates[1], resource: null },
  ]);
});

test("resource columns follow resource -> dates order", () => {
  const columns = getResourceColumns(resources, dates);
  assert.equal(columns.length, 4);
  assert.deepEqual(
    columns.map((column) => `${column.resource?.id}@${column.date.toString()}`),
    ["room-a@2026-09-03", "room-a@2026-09-04", "room-b@2026-09-03", "room-b@2026-09-04"],
  );
});

test("empty resources yield zero columns, never a solo fallback", () => {
  assert.deepEqual(getResourceColumns([], dates), []);
});

test("events belong to exactly one resource column", () => {
  const [columnA, columnB] = getResourceColumns(resources, [dates[0]]);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, columnA), true);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, columnB), false);
  assert.equal(eventBelongsToColumn({}, columnA), false);
  assert.equal(eventBelongsToColumn({ resourceId: null }, columnB), false);
});

test("solo columns accept events with or without resource", () => {
  const [solo] = getTimeGridColumns([dates[0]]);
  assert.equal(eventBelongsToColumn({ resourceId: "room-a" }, solo), true);
  assert.equal(eventBelongsToColumn({}, solo), true);
});

test("backgrounds without resource are global", () => {
  const [columnA, columnB] = getResourceColumns(resources, [dates[0]]);
  assert.equal(backgroundAppliesToColumn({}, columnA), true);
  assert.equal(backgroundAppliesToColumn({}, columnB), true);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, columnA), true);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, columnB), false);
  const [solo] = getTimeGridColumns([dates[0]]);
  assert.equal(backgroundAppliesToColumn({ resourceId: "room-a" }, solo), true);
});

test("groupResources orders sections by declared group order", () => {
  const grouped = [
    { id: "shift-a", title: "Shift A" },
    { id: "shift-b", title: "Shift B" },
  ];
  const pool = [
    { id: "r1", groupId: "shift-b" },
    { id: "r2", groupId: "shift-a" },
    { id: "r3", groupId: "shift-a" },
    { id: "r4", groupId: "shift-b" },
  ];
  const sections = groupResources(pool, grouped);
  assert.deepEqual(
    sections.map((section) => ({
      group: section.group?.id ?? null,
      resources: section.resources.map((resource) => resource.id),
    })),
    [
      { group: "shift-a", resources: ["r2", "r3"] },
      { group: "shift-b", resources: ["r1", "r4"] },
    ],
  );
});

test("groupResources keeps resources array order within a group", () => {
  const pool = [
    { id: "r1", groupId: "a" },
    { id: "r2", groupId: "a" },
    { id: "r3", groupId: "a" },
  ];
  const [section] = groupResources(pool, [{ id: "a" }]);
  assert.deepEqual(
    section.resources.map((resource) => resource.id),
    ["r1", "r2", "r3"],
  );
});

test("groupResources first duplicate group id wins, later ones are ignored", () => {
  const pool = [
    { id: "r1", groupId: "cardio" },
    { id: "r2", groupId: "cardio" },
  ];
  const sections = groupResources(pool, [
    { id: "cardio", title: "First" },
    { id: "cardio", title: "Second" },
  ]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].group?.title, "First");
  assert.deepEqual(
    sections[0].resources.map((resource) => resource.id),
    ["r1", "r2"],
  );
});

test("groupResources renders each resource exactly once across duplicate ids", () => {
  const pool = [
    { id: "r1", groupId: "cardio" },
    { id: "r2", groupId: "cardio" },
  ];
  const sections = groupResources(pool, [{ id: "cardio" }, { id: "cardio" }]);
  const ids = sections.flatMap((section) => section.resources.map((resource) => resource.id));
  assert.deepEqual(ids, ["r1", "r2"]);
});

test("groupResources skips declared groups without members", () => {
  const pool = [{ id: "r1", groupId: "a" }];
  const sections = groupResources(pool, [{ id: "a" }, { id: "empty" }]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].group?.id, "a");
});

test("groupResources trails resources with missing or unknown group ids", () => {
  const pool = [{ id: "r1", groupId: "a" }, { id: "r2" }, { id: "r3", groupId: "ghost" }];
  const sections = groupResources(pool, [{ id: "a" }]);
  assert.deepEqual(
    sections.map((section) => ({
      group: section.group?.id ?? null,
      resources: section.resources.map((resource) => resource.id),
    })),
    [
      { group: "a", resources: ["r1"] },
      { group: null, resources: ["r2", "r3"] },
    ],
  );
});

test("groupResources with no groups passes every resource through trailing", () => {
  const sections = groupResources([{ id: "r1" }, { id: "r2", groupId: "anything" }], []);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].group, null);
  assert.deepEqual(
    sections[0].resources.map((resource) => resource.id),
    ["r1", "r2"],
  );
});

test("groupResources ignores hierarchy-shaped fields entirely", () => {
  const pool = [/** @type {any} */ ({ id: "r1", groupId: "a", parentId: "somewhere", reportsTo: "someone" })];
  const sections = groupResources(pool, [/** @type {any} */ ({ id: "a", parentId: "somewhere" })]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].group?.id, "a");
  assert.deepEqual(
    sections[0].resources.map((resource) => resource.id),
    ["r1"],
  );
});

test("groupResources with no resources or pools yields no sections", () => {
  assert.deepEqual(groupResources([], [{ id: "a" }]), []);
  assert.deepEqual(groupResources([], []), []);
});
