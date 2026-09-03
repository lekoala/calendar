import { expect, test } from "@playwright/test";

/**
 * M6 month + list: summary grid and chronological list over shared state,
 * alternate representations without resource matrices.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * @param {import("@playwright/test").Page} page
 */
function gotoMonth(page) {
  return page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("month");
  });
}

test("month renders full Monday weeks with outside days dimmed", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await gotoMonth(page);
  await flushRender(page);
  await expect(page.locator(".cv-month-day")).toHaveCount(35);
  await expect(page.locator(".cv-month-weekday")).toHaveCount(7);
  const first = page.locator(".cv-month-day").first();
  await expect(first).toHaveAttribute("data-date", "2026-08-31");
  await expect(first).toHaveAttribute("data-outside", "true");
  await expect(page.locator('[data-date="2026-09-01"]')).not.toHaveAttribute("data-outside", "true");
});

test("multi-day events repeat per overlapped day, midnight excluded", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "night",
        title: "Night shift",
        start: "2026-09-03T17:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "evening",
        title: "Evening",
        start: "2026-09-03T20:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T00:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await gotoMonth(page);
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-03"] [data-event-id="night"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-04"] [data-event-id="night"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-03"] [data-event-id="evening"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-04"] [data-event-id="evening"]')).toHaveCount(0);
});

test("crowded days collapse behind +n more, honoring monthEventLimit", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = Array.from({ length: 5 }, (_, index) => {
      const hour = String(8 + index).padStart(2, "0");
      return {
        id: `busy-${index}`,
        title: `Busy ${index}`,
        start: `2026-09-03T${hour}:00:00+02:00[Europe/Brussels]`,
        end: `2026-09-03T${hour}:30:00+02:00[Europe/Brussels]`,
      };
    });
  });
  await gotoMonth(page);
  await flushRender(page);
  const cell = page.locator('[data-date="2026-09-03"]');
  await expect(cell.locator(".cv-month-event")).toHaveCount(3);
  await expect(cell.locator(".cv-month-more")).toContainText("+2 more");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ monthEventLimit: 5 });
  });
  await flushRender(page);
  await expect(cell.locator(".cv-month-event")).toHaveCount(5);
  await expect(cell.locator(".cv-month-more")).toHaveCount(0);
});

test("month chips activate like events", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await gotoMonth(page);
  await flushRender(page);
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
  });
  await page.locator('[data-date="2026-09-03"] [data-event-id="a"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["a"]);
  await page.locator('[data-date="2026-09-04"] [data-event-id="b"]').focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["a", "b"]);
});

test("empty month day click selects the civil day", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__select = null;
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:select",
      (/** @type {Event} */ event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        hooks.__select = {
          start: String(detail.start),
          end: String(detail.end),
          resourceId: detail.resourceId,
        };
      },
    );
  });
  await gotoMonth(page);
  await flushRender(page);
  await page.locator('[data-date="2026-09-05"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__select)).not.toBeNull();
  const selection = await page.evaluate(() => /** @type {any} */ (window).__select);
  expect(selection.start).toContain("2026-09-05T00:00:00+02:00");
  expect(selection.end).toContain("2026-09-06T00:00:00+02:00");
  expect(selection.resourceId).toBeNull();
});

test("prev and next step whole months", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await gotoMonth(page);
  await flushRender(page);
  const dates = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.gotoDate("2026-09-15");
    calendar.next();
    const afterNext = calendar.getAttribute("date");
    calendar.prev();
    const afterPrev = calendar.getAttribute("date");
    return { afterNext, afterPrev };
  });
  expect(dates.afterNext).toBe("2026-10-15");
  expect(dates.afterPrev).toBe("2026-09-15");
});

test("month sources receive the week-aligned range", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__range = null;
    /** @type {any} */ (document.querySelector("calendar-view")).configure({
      eventSource: (/** @type {{ start: object, end: object }} */ { start, end }) => {
        hooks.__range = { start: String(start), end: String(end) };
        return Promise.resolve([]);
      },
    });
  });
  await gotoMonth(page);
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__range)).not.toBeNull();
  const range = await page.evaluate(() => /** @type {any} */ (window).__range);
  expect(range.start).toContain("2026-08-31");
  expect(range.end).toContain("2026-10-05");
});

test("list renders chronological day groups with empty states", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await expect(page.locator(".cv-list-day")).toHaveCount(7);
  await expect(page.locator('[data-date="2026-09-03"] .cv-list-event')).toHaveCount(2);
  const first = await page
    .locator('[data-date="2026-09-03"] .cv-list-event')
    .first()
    .getAttribute("data-event-id");
  expect(first).toBe("a");
  await expect(page.locator('[data-date="2026-09-05"] .cv-list-empty')).toContainText("No events");
  await expect(page.locator('[data-date="2026-09-03"] .cv-list-event').first()).toContainText("09:00");
});

test("list events activate and switching preserves the anchor date", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await page.locator('[data-date="2026-09-04"] [data-event-id="b"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["b"]);
  const state = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("month");
    calendar.setView("week");
    return { date: calendar.getAttribute("date"), view: calendar.view };
  });
  expect(state).toEqual({ date: "2026-09-03", view: "week" });
});
