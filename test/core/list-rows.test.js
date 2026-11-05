import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import { listDayRows, listedBackgrounds } from "../../src/core/list-rows.js";
import { normalizeBackground, normalizeEvent } from "../../src/core/model.js";

const ZONE = "Europe/Brussels";
const day = Temporal.PlainDate.from("2026-09-03");
/** @param {string} date @param {string} time */
const at = (date, time) => `${date}T${time}:00+02:00[${ZONE}]`;
/** @param {string} id @param {string} start @param {string} end @param {object} [extra] */
const event = (id, start, end, extra = {}) => normalizeEvent({ id, title: id, start, end, ...extra });
/** @param {string} id @param {string} start @param {string} end @param {object} [extra] */
const background = (id, start, end, extra = {}) => normalizeBackground({ id, start, end, ...extra });
/** @param {import("../../src/core/list-rows.js").ListRow[]} rows */
const ids = (rows) => rows.map((row) => `${row.kind}:${row.item.id}`);

test("all-day rows come first, then timed rows by start", () => {
  const rows = listDayRows({
    date: day,
    events: [
      event("late", at("2026-09-03", "15:00"), at("2026-09-03", "16:00")),
      event("early", at("2026-09-03", "08:00"), at("2026-09-03", "09:00")),
      event("allday", "2026-09-03", "2026-09-04", { allDay: true }),
    ],
    backgrounds: [background("lunch", at("2026-09-03", "12:00"), at("2026-09-03", "13:00"))],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["event:allday", "event:early", "background:lunch", "event:late"]);
});

test("a range from the previous day sorts at midnight, not at its original start", () => {
  const rows = listDayRows({
    date: day,
    events: [
      event("morning", at("2026-09-03", "07:00"), at("2026-09-03", "08:00")),
      event("overnight", at("2026-09-02", "22:00"), at("2026-09-03", "02:00")),
      event("allday", "2026-09-03", "2026-09-04", { allDay: true }),
    ],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["event:allday", "event:overnight", "event:morning"]);
  const overnight = rows[1];
  assert.equal(overnight.start?.toPlainTime().toString(), "00:00:00");
  assert.equal(overnight.end?.toPlainTime().toString(), "02:00:00");
  assert.equal(overnight.coversDay, false);
});

test("a timed range filling the whole day is flagged coversDay and clipped to the next midnight", () => {
  const [row] = listDayRows({
    date: day,
    events: [],
    backgrounds: [background("closure", at("2026-09-02", "18:00"), at("2026-09-04", "08:00"))],
    timeZone: ZONE,
  });
  assert.equal(row.coversDay, true);
  assert.equal(row.allDay, false);
  assert.equal(row.end?.toPlainDate().toString(), "2026-09-04");
  assert.equal(row.end?.toPlainTime().toString(), "00:00:00");
});

test("a range ending exactly at midnight does not appear on the next day", () => {
  const rows = listDayRows({
    date: day.add({ days: 1 }),
    events: [],
    backgrounds: [background("evening", at("2026-09-03", "20:00"), at("2026-09-04", "00:00"))],
    timeZone: ZONE,
  });
  assert.equal(rows.length, 0);
});

test("on an equal start, backgrounds precede events and ties keep input order", () => {
  const rows = listDayRows({
    date: day,
    events: [
      event("b", at("2026-09-03", "09:00"), at("2026-09-03", "10:00")),
      event("a", at("2026-09-03", "09:00"), at("2026-09-03", "09:30")),
    ],
    backgrounds: [
      background("block-2", at("2026-09-03", "09:00"), at("2026-09-03", "11:00")),
      background("block-1", at("2026-09-03", "09:00"), at("2026-09-03", "10:00")),
    ],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["background:block-2", "background:block-1", "event:b", "event:a"]);
});

test("all-day backgrounds and events share the leading group", () => {
  const rows = listDayRows({
    date: day,
    events: [event("holiday", "2026-09-03", "2026-09-04", { allDay: true })],
    backgrounds: [background("closed", "2026-09-01", "2026-09-05", { allDay: true })],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["background:closed", "event:holiday"]);
  assert.ok(rows.every((row) => row.allDay && row.start === null));
});

test("resource-scoped backgrounds are not filtered: list shows what it is given", () => {
  const rows = listDayRows({
    date: day,
    events: [],
    backgrounds: [
      background("global", at("2026-09-03", "08:00"), at("2026-09-03", "09:00")),
      background("room-a", at("2026-09-03", "10:00"), at("2026-09-03", "11:00"), {
        resourceId: "resource-a",
      }),
    ],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["background:global", "background:room-a"]);
});

test("without backgrounds only events are returned", () => {
  const rows = listDayRows({
    date: day,
    events: [event("only", at("2026-09-03", "08:00"), at("2026-09-03", "09:00"))],
    timeZone: ZONE,
  });
  assert.deepEqual(ids(rows), ["event:only"]);
});

test("listedBackgrounds: off by default, true lists all, a predicate chooses", () => {
  const all = [
    background("keep", at("2026-09-03", "08:00"), at("2026-09-03", "09:00"), { classNames: ["keep"] }),
    background("drop", at("2026-09-03", "10:00"), at("2026-09-03", "11:00")),
  ];
  assert.equal(listedBackgrounds(all, undefined), undefined);
  assert.equal(listedBackgrounds(all, false), undefined);
  assert.equal(listedBackgrounds(all, "yes"), undefined);
  assert.deepEqual(
    listedBackgrounds(all, true)?.map((item) => item.id),
    ["keep", "drop"],
  );
  assert.deepEqual(
    listedBackgrounds(all, (/** @type {import("../../src/core/model.js").NormalizedBackground} */ item) =>
      item.classNames.includes("keep"),
    )?.map((item) => item.id),
    ["keep"],
  );
  // Only a strict `true` keeps a range: a truthy object is not a decision.
  assert.deepEqual(
    listedBackgrounds(all, () => 1),
    [],
  );
});

test("repeated-hour display matches grid projection while clipped instants stay canonical", () => {
  for (const [endTime, endMinute] of [
    ["02:15", 195],
    ["02:30", 210],
  ]) {
    const [row] = listDayRows({
      date: Temporal.PlainDate.from("2026-10-25"),
      events: [],
      backgrounds: [
        background(
          "repeat",
          "2026-10-25T02:30:00+02:00[Europe/Brussels]",
          `2026-10-25T${endTime}:00+01:00[Europe/Brussels]`,
        ),
      ],
      timeZone: ZONE,
    });
    assert.deepEqual(row.span, { start: 150, end: endMinute });
    assert.equal(row.start?.offset, "+02:00");
    assert.equal(row.end?.offset, "+01:00");
    assert.ok(row.start && row.end && Temporal.ZonedDateTime.compare(row.start, row.end) < 0);
  }
});

test("ranges ending at a skipped midnight do not create a zero-duration row", () => {
  const range = background(
    "evening",
    "2026-09-05T22:00:00-04:00[America/Santiago]",
    "2026-09-06T01:00:00-03:00[America/Santiago]",
  );
  const input = { events: [], backgrounds: [range], timeZone: "America/Santiago" };
  const [previous] = listDayRows({ ...input, date: Temporal.PlainDate.from("2026-09-05") });
  assert.deepEqual(previous.span, { start: 1320, end: 1440 });
  assert.deepEqual(listDayRows({ ...input, date: Temporal.PlainDate.from("2026-09-06") }), []);
});
