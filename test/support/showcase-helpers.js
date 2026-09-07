import { Temporal } from "temporal-polyfill";

/**
 * Helpers shared by the two showcase suites - the core-contract one in
 * `test/browser` and the application-chrome one in `test/shell`. They live here
 * rather than in either file so the two cannot drift apart on what "the
 * anchor" or "an opening day" means.
 */

/**
 * Two frames: the element renders on the next one, and content hooks run
 * inside it.
 *
 * @param {import("@playwright/test").Page} page
 */
export function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * The shell anchors on today, so every date here is derived, never pinned:
 * a literal calendar day would silently rot the moment the suite is run on
 * another date. The anchor is the element's own `date` attribute.
 *
 * @param {import("@playwright/test").Page} page
 */
export async function anchorDate(page) {
  const iso = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).getAttribute("date"),
  );
  return Temporal.PlainDate.from(/** @type {string} */ (iso));
}

/**
 * First day at or after `date` the desk opens on, mirroring the fixture's own
 * rule: Saturday is staffed for viewing only (`closedWeekdays`) and Sunday is
 * never rendered (`hiddenDays`). The shell places its fixtures the same way,
 * so this is where the seeded content actually lands.
 *
 * @param {Temporal.PlainDate} date
 * @returns {Temporal.PlainDate}
 */
export function openDayFrom(date) {
  let cursor = date;
  while (cursor.dayOfWeek > 5) cursor = cursor.add({ days: 1 });
  return cursor;
}

/**
 * First day at or after `date` whose ISO weekday is `weekday`. Weekly policy
 * fixtures (a Thursday late desk, a Wednesday maintenance window) only exist
 * on their own weekday, so tests navigate to it instead of hoping the opening
 * range happens to contain it.
 *
 * @param {Temporal.PlainDate} date
 * @param {number} weekday ISO 1-7
 * @returns {Temporal.PlainDate}
 */
export function weekdayFrom(date, weekday) {
  return date.add({ days: (weekday - date.dayOfWeek + 7) % 7 });
}

/**
 * Put the grid back at a known scroll offset. Navigation deliberately keeps
 * `scrollTop`, so a point derived from an axis label would otherwise depend
 * on wherever the previous interaction scrolled to.
 *
 * @param {import("@playwright/test").Page} page
 */
export async function scrollToMorning(page) {
  await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).scrollToTime("08:00"),
  );
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {Temporal.PlainDate | string} date
 */
export async function gotoDate(page, date) {
  await page.evaluate(
    (iso) => /** @type {any} */ (document.querySelector("calendar-view")).gotoDate(iso),
    String(date),
  );
  await flushRender(page);
}

/**
 * Under 64rem the side panel is a popover. Tests that drive it open it the
 * way a user would instead of assuming the desktop layout, and close it
 * again so it stops covering the toolbar.
 *
 * @param {import("@playwright/test").Page} page
 */
export async function openPanel(page) {
  const toggle = page.locator("#sidebar-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

/** @param {import("@playwright/test").Page} page */
export async function closePanel(page) {
  if (await page.evaluate(() => document.getElementById("sidebar")?.matches(":popover-open"))) {
    await page.keyboard.press("Escape");
  }
}

/**
 * View switching goes through the view menu now. Driving it by keyboard
 * digit keeps the test independent of the menu's own geometry.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} view
 */
export async function setView(page, view) {
  await page.evaluate((name) => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView(name);
  }, view);
  await flushRender(page);
}

/**
 * First opening day at or after `date` that carries no booking at all.
 *
 * The fixture's density varies with distance from the anchor, so a test that
 * needs a free target has to find one rather than name a day the seeding
 * happens not to reach: that assumption breaks the moment the horizon moves.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Temporal.PlainDate} date
 * @returns {Promise<Temporal.PlainDate>}
 */
export async function emptyDayFrom(page, date) {
  const busy = new Set(
    await page.evaluate(() => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      return (calendar.events ?? []).map((/** @type {any} */ event) => String(event.start).slice(0, 10));
    }),
  );
  let cursor = openDayFrom(date);
  for (let guard = 0; guard < 400; guard += 1) {
    if (!busy.has(cursor.toString())) return cursor;
    cursor = openDayFrom(cursor.add({ days: 1 }));
  }
  throw new Error("no empty opening day in the seeded range");
}

/**
 * The mini month is a `<date-calendar>` driven as a navigator: the component
 * owns the grid and this shell owns one marker node per day. A test therefore
 * asks the cell for a date and the marker for a verdict, and reaches
 * cell-level state through `:has()` - which is the only hook a consumer gets,
 * since `.dp-*` class names are explicitly not date-picker's styling API.
 */
export const mini = {
  /** @param {Temporal.PlainDate | string} date */
  day: (date) => `#mini td[data-date="${date}"]`,
  /** @param {Temporal.PlainDate | string} date */
  marker: (date) => `#mini td[data-date="${date}"] .sc-mini-marker`,
  days: "#mini td[data-date]",
  /** @param {string} verdict `free`, `soon`, `full`, `closed` or `neutral` */
  verdict: (verdict) => `#mini td:has(.sc-mini-marker[data-state="${verdict}"])`,
  anchor: "#mini td:has(.sc-mini-marker[data-anchor])",
  /** The anchor's own row: its marker sits in it, so no week math is needed. */
  activeWeek: "#mini tbody tr:has(.sc-mini-marker[data-anchor])",
  /** Week numbers are row headers, so the structure names them, not a class. */
  weekNumbers: "#mini tbody th",
  monthSelect: "#mini select",
  yearField: '#mini input[type="number"]',
  previous: '#mini button[data-calendar-action="previous"]',
  next: '#mini button[data-calendar-action="next"]',
};

/**
 * The mini month's year is an editable field rather than a windowed list, so
 * it commits the way a native number input does: on `change`.
 *
 * @param {import("@playwright/test").Page} page
 * @param {number} year
 */
export async function setMiniYear(page, year) {
  const field = page.locator(mini.yearField);
  await field.fill(String(year));
  // `fill` only raises `input`; the field commits on `change`, like a native
  // number input, so the blur is part of the interaction and not a wait.
  await field.blur();
}

/**
 * The one verdict the shell put on a mini-month day: `""` when it put none,
 * and `null` when the day is not rendered at all - which fails louder than a
 * selector that silently matches nothing.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Temporal.PlainDate | string} date
 * @returns {Promise<string | null>}
 */
export function miniVerdict(page, date) {
  return page.evaluate((iso) => {
    const cell = document.querySelector(`#mini td[data-date="${iso}"]`);
    if (!cell) return null;
    const marker = /** @type {HTMLElement | null} */ (cell.querySelector(".sc-mini-marker"));
    return marker ? (marker.dataset.state ?? "") : "";
  }, String(date));
}
