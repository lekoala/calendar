import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import { openDemo } from "./fixture.js";

const ZONE = "Europe/Brussels";

/**
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Timed ISO strings relative to the real clock, so the run never depends on
 * the fixture date.
 * @param {number} startOffsetMinutes
 * @param {number} endOffsetMinutes
 */
function relativeRange(startOffsetMinutes, endOffsetMinutes) {
  const now = Temporal.Now.zonedDateTimeISO(ZONE);
  return {
    start: now.add({ minutes: startOffsetMinutes }).toString(),
    end: now.add({ minutes: endOffsetMinutes }).toString(),
  };
}

/**
 * Drive the demo calendar to today with full-day slots and now-relative events.
 * @param {import("@playwright/test").Page} page
 * @param {Array<{ id: string, title: string, start: string, end: string }>} input
 */
async function seedRelativeEvents(page, input) {
  await page.evaluate((events) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setAttribute("slot-min", "00:00");
    calendar.setAttribute("slot-max", "23:59");
    calendar.setView("day");
    calendar.today();
    calendar.events = events;
  }, input);
  await flushRender(page);
  await flushRender(page);
}

test("event nodes carry data-temporal-state and hooks receive it", async ({ page }) => {
  await openDemo(page, "basic");
  const past = relativeRange(-180, -120);
  const current = relativeRange(-30, 30);
  const future = relativeRange(60, 120);
  await seedRelativeEvents(page, [
    { id: "past", title: "Past", ...past },
    { id: "current", title: "Current", ...current },
    { id: "future", title: "Future", ...future },
  ]);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    /** @type {any} */ (window).seenStates = {};
    calendar.configure({
      eventContent: (/** @type {any} */ info) => {
        /** @type {any} */ (window).seenStates[info.event.id] = info.temporalState;
        return info.event.title;
      },
    });
  });
  // Relative ranges can land on the neighbouring civil day near midnight (a
  // +60/+120 event at 23:30 lives entirely tomorrow), so each event is
  // asserted on the civil date holding its own start. The states stay
  // relative to the real clock; only the visible date moves.
  for (const [id, state] of [
    ["past", "past"],
    ["current", "current"],
    ["future", "future"],
  ]) {
    await page.evaluate((eventId) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      return calendar.gotoDate(calendar.getEventById(eventId).start.toPlainDate().toString());
    }, id);
    await flushRender(page);
    await flushRender(page);
    await expect(page.locator(`[data-event-id="${id}"]`)).toHaveAttribute("data-temporal-state", state);
  }

  const seen = await page.evaluate(() => /** @type {any} */ (window).seenStates);
  expect(seen).toEqual({ past: "past", current: "current", future: "future" });
});

test("temporal state ages live without refetch", async ({ page }) => {
  await openDemo(page, "basic");
  // Ends ~1.5s in the future: currently current, past once the one-shot
  // timer fires the next render.
  const now = Temporal.Now.zonedDateTimeISO(ZONE);
  const ending = {
    id: "aging",
    title: "Aging",
    start: now.subtract({ minutes: 30 }).toString(),
    end: now.add({ milliseconds: 1500 }).toString(),
  };
  await seedRelativeEvents(page, [ending]);
  await expect(page.locator('[data-event-id="aging"]')).toHaveAttribute("data-temporal-state", "current");
  const dateBefore = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).getAttribute("date"),
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            /** @type {any} */ (document.querySelector('[data-event-id="aging"]'))?.dataset?.temporalState,
        ),
      { timeout: 10000 },
    )
    .toBe("past");
  const dateAfter = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).getAttribute("date"),
  );
  expect(dateAfter).toBe(dateBefore);
});

test("month and list nodes carry data-temporal-state", async ({ page }) => {
  await openDemo(page, "basic");
  const past = relativeRange(-180, -120);
  const future = relativeRange(60, 120);
  await seedRelativeEvents(page, [
    { id: "past", title: "Past", ...past },
    { id: "future", title: "Future", ...future },
  ]);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("month");
  });
  await flushRender(page);
  // An event straddling midnight renders one chip per civil day, so the
  // same data-event-id resolves twice when the run crosses a day boundary.
  await expect(page.locator('.cv-month-event[data-event-id="past"]').first()).toHaveAttribute(
    "data-temporal-state",
    "past",
  );
  await expect(page.locator('.cv-month-event[data-event-id="future"]').first()).toHaveAttribute(
    "data-temporal-state",
    "future",
  );
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await expect(page.locator('.cv-list-event[data-event-id="past"]').first()).toHaveAttribute(
    "data-temporal-state",
    "past",
  );
  await expect(page.locator('.cv-list-event[data-event-id="future"]').first()).toHaveAttribute(
    "data-temporal-state",
    "future",
  );
});

test("disconnect cancels the aging timer without errors", async ({ page }) => {
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openDemo(page, "basic");
  const now = Temporal.Now.zonedDateTimeISO(ZONE);
  await seedRelativeEvents(page, [
    {
      id: "aging",
      title: "Aging",
      start: now.subtract({ minutes: 30 }).toString(),
      end: now.add({ seconds: 1 }).toString(),
    },
  ]);
  await expect(page.locator('[data-event-id="aging"]')).toHaveAttribute("data-temporal-state", "current");
  await page.evaluate(() => document.querySelector("calendar-view")?.remove());
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
});
