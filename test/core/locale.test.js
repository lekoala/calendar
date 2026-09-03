import assert from "node:assert/strict";
import test from "node:test";
import {
  firstDayFromLocale,
  formatDayHeader,
  formatSlotLabel,
  getVisibleDates,
  resolveLocale,
} from "../../src/core/dates.js";

test("resolveLocale trims and treats blanks as absent", () => {
  assert.equal(resolveLocale("fr"), "fr");
  assert.equal(resolveLocale("  fr-BE  "), "fr-BE");
  assert.equal(resolveLocale(""), undefined);
  assert.equal(resolveLocale("   "), undefined);
  assert.equal(resolveLocale(undefined), undefined);
  assert.equal(resolveLocale(null), undefined);
  assert.equal(resolveLocale(42), undefined);
});

test("firstDayFromLocale suggests the week start without throwing", () => {
  assert.equal(firstDayFromLocale("fr"), 1);
  assert.equal(firstDayFromLocale("en-US"), 7);
  assert.equal(firstDayFromLocale("not-a-locale!!"), null);
});

test("locale suggests firstDay but an explicit firstDay wins", () => {
  // 2026-09-03 is a Thursday: en-US weeks start Sunday, fr weeks Monday.
  const american = getVisibleDates("2026-09-03", "week", { locale: "en-US" });
  assert.equal(american[0].toString(), "2026-08-30");
  const french = getVisibleDates("2026-09-03", "week", { locale: "fr" });
  assert.equal(french[0].toString(), "2026-08-31");
  const explicit = getVisibleDates("2026-09-03", "week", { firstDay: 1, locale: "en-US" });
  assert.equal(explicit[0].toString(), "2026-08-31");
});

test("locale-aware header and slot defaults", () => {
  assert.equal(formatDayHeader("2026-09-03", "en"), "Thu, 9/3");
  assert.equal(formatSlotLabel(480, "en"), "8:00 AM");
  // Out-of-PlainTime edges keep the legacy 24h rendering.
  assert.equal(formatSlotLabel(1440, "en"), "24:00");
  // Runtime default stays a non-empty string without an explicit locale.
  assert.match(formatDayHeader("2026-09-03", undefined), /\S/);
  assert.match(formatSlotLabel(480, undefined), /\S/);
});
