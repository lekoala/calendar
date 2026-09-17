import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

/**
 * `dayCount`: custom rolling windows without new view names. The option
 * overrides the rolling presets, counts visible days through `hiddenDays`,
 * pages navigation by the effective count, and is ignored by `week`.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("day + dayCount renders a custom rolling window", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("day");
    calendar.configure({ dayCount: 4 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(4);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-03");
  await expect(page.locator(".cv-day").last()).toHaveAttribute("data-date", "2026-09-06");
});

test("dayCount overrides the threeDays preset", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("threeDays");
    calendar.configure({ dayCount: 2 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(2);
  await expect(page.locator(".cv-day").last()).toHaveAttribute("data-date", "2026-09-04");
});

test("week ignores dayCount: a week stays a civil week", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("week");
    calendar.configure({ dayCount: 4 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(7);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-08-31");
});

test("resourceDay + dayCount multiplies resources by visible days", async ({ page }) => {
  await openDemo(page, "resources");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("resourceDay");
    calendar.configure({ dayCount: 3 });
  });
  await flushRender(page);
  // Default fixture: 2 rooms, so 2 resources × 3 visible days.
  await expect(page.locator(".cv-resource-header")).toHaveCount(2);
  await expect(page.locator(".cv-day")).toHaveCount(6);
});

test("next/prev page by the effective visible count", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("day");
    calendar.configure({ dayCount: 4 });
    calendar.next();
  });
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-07");
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).prev());
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-03");
});

test("hidden days stretch the civil window but never shorten the count", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("day");
    calendar.configure({ dayCount: 5, hiddenDays: [7] });
    calendar.gotoDate("2026-09-05");
  });
  await flushRender(page);
  // Saturday anchor, Sunday hidden: five usable days over six civil days.
  await expect(page.locator(".cv-day")).toHaveCount(5);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-05");
  await expect(page.locator(".cv-day").last()).toHaveAttribute("data-date", "2026-09-10");
});

test("sources receive the enveloping civil range, not anchor + dayCount", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("day");
    calendar.gotoDate("2026-09-05");
    calendar.configure({
      dayCount: 5,
      hiddenDays: [7],
      eventSource: (/** @type {{ start: object, end: object }} */ { start, end }) => {
        hooks.__seen.push({ start: start.toString(), end: end.toString() });
        return Promise.resolve([]);
      },
    });
    calendar.refetchEvents();
  });
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen.length)).toBeGreaterThan(0);
  const last = await page.evaluate(() => /** @type {any} */ (window).__seen.at(-1));
  assertRange(last);
});

/**
 * @param {{ start: string, end: string }} range
 */
function assertRange(range) {
  if (range.start !== "2026-09-05" || range.end !== "2026-09-11") {
    throw new Error(`expected the enveloping civil range, got ${range.start} → ${range.end}`);
  }
}

test("demo duration buttons drive dayCount, view buttons reset it", async ({ page }) => {
  await openDemo(page, "basic");
  await page.click('#durations [data-days="4"]');
  await expect(page.locator(".cv-day")).toHaveCount(4);
  await page.click('#durations [data-days="5"][data-hiddendays="7"]');
  await expect(page.locator(".cv-day")).toHaveCount(5);
  await expect(page.locator(".cv-day").last()).toHaveAttribute("data-date", "2026-09-08");
  // Leaving a custom duration restores the preset.
  await page.click('#views [data-view="threeDays"]');
  await expect(page.locator(".cv-day")).toHaveCount(3);
});

test("demo resource fixtures compose grouping with custom durations", async ({ page }) => {
  await openDemo(page, "resources");
  await page.click('[data-fixture="2x5"]');
  await expect(page.locator(".cv-resource-header")).toHaveCount(2);
  await expect(page.locator(".cv-day")).toHaveCount(10);
  await page.click('[data-fixture="6x5"]');
  await expect(page.locator(".cv-day")).toHaveCount(30);
  // Fixtures never leak a custom duration into each other.
  await page.click('[data-fixture="6x1"]');
  await expect(page.locator(".cv-day")).toHaveCount(6);
});
