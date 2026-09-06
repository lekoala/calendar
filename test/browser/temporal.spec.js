import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";

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
  await page.goto("/demo/basic.html");
  const past = relativeRange(-180, -120);
  const current = relativeRange(-30, 30);
  const future = relativeRange(60, 120);
  await seedRelativeEvents(page, [
    { id: "past", title: "Past", ...past },
    { id: "current", title: "Current", ...current },
    { id: "future", title: "Future", ...future },
  ]);
  await expect(page.locator('[data-event-id="past"]')).toHaveAttribute("data-temporal-state", "past");
  await expect(page.locator('[data-event-id="current"]')).toHaveAttribute("data-temporal-state", "current");
  await expect(page.locator('[data-event-id="future"]')).toHaveAttribute("data-temporal-state", "future");

  const seen = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    /** @type {Record<string, string>} */
    const states = {};
    calendar.configure({
      eventContent: (/** @type {any} */ info) => {
        states[info.event.id] = info.temporalState;
        return info.event.title;
      },
    });
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(states))),
    );
  });
  expect(seen).toEqual({ past: "past", current: "current", future: "future" });
});

test("temporal state ages live without refetch", async ({ page }) => {
  await page.goto("/demo/basic.html");
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
  await page.goto("/demo/basic.html");
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
  await expect(page.locator('.cv-month-event[data-event-id="past"]')).toHaveAttribute(
    "data-temporal-state",
    "past",
  );
  await expect(page.locator('.cv-month-event[data-event-id="future"]')).toHaveAttribute(
    "data-temporal-state",
    "future",
  );
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await expect(page.locator('.cv-list-event[data-event-id="past"]')).toHaveAttribute(
    "data-temporal-state",
    "past",
  );
  await expect(page.locator('.cv-list-event[data-event-id="future"]')).toHaveAttribute(
    "data-temporal-state",
    "future",
  );
});

test("disconnect cancels the aging timer without errors", async ({ page }) => {
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/demo/basic.html");
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
