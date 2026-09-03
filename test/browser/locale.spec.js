import { expect, test } from "@playwright/test";

/**
 * Locale and labels: `configure({ locale })` (or the `lang` attribute)
 * localizes default headers/axis text and suggests `firstDay`, while
 * `configure({ labels })` overrides the fixed English strings. Content
 * hooks stay authoritative throughout.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("locale localizes month weekdays and day headers", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ locale: "fr" });
    calendar.setView("month");
  });
  await flushRender(page);
  await expect(page.locator(".cv-month-weekday").first()).toHaveText("lun.");
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("week"));
  await flushRender(page);
  await expect(page.locator(".cv-day-header").first()).toContainText("31/08");
  await expect(page.locator(".cv-day-header").nth(3)).toContainText("03/09");
});

test("lang attribute localizes without configure", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setAttribute("lang", "fr");
    calendar.setView("month");
  });
  await flushRender(page);
  await expect(page.locator(".cv-month-weekday").first()).toHaveText("lun.");
});

test("explicit firstDay beats the locale suggestion", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ locale: "en-US" });
    calendar.setView("week");
  });
  await flushRender(page);
  // en-US weeks start Sunday; the anchor Thursday keeps its `date`.
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-08-30");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ locale: "en-US", firstDay: 1 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-08-31");
});

test("labels override the English fixed strings", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = Array.from({ length: 6 }, (_, index) => ({
      id: `busy-${index}`,
      title: `Busy ${index}`,
      start: `2026-09-03T${String(8 + index).padStart(2, "0")}:00:00+02:00[Europe/Brussels]`,
      end: `2026-09-03T${String(8 + index).padStart(2, "0")}:30:00+02:00[Europe/Brussels]`,
    }));
    calendar.setView("month");
  });
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-03"] .cv-month-more')).toHaveText("+3 more");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({
      labels: { more: "+{hidden} en plus", noEvents: "Aucun évènement" },
    });
  });
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-03"] .cv-month-more')).toHaveText("+3 en plus");
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("list"));
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-05"] .cv-list-empty')).toHaveText("Aucun évènement");
});
