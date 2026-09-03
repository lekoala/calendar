import { expect, test } from "@playwright/test";

/**
 * Showcase shell: generic room-booking application around the core, in a
 * full-viewport Actual CSS layout (sidebar with mini-month and filters,
 * agenda toolbar, live strip, app-owned dialogs, activity dock).
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("showcase renders seeded team events with kind cards", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const count = await page.locator(".cv-event").count();
  expect(count).toBeGreaterThan(5);
  await expect(page.locator('.cv-event[data-kind="review"]').first()).toBeVisible();
  await expect(page.locator(".sc-card strong").first()).not.toBeEmpty();
});

test("the shell fills the viewport and only the calendar scrolls", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const box = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    shellHeight: document.getElementById("shell")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
    scroller: document.querySelector(".cv-scroller")?.clientHeight ?? 0,
  }));
  expect(box.documentOverflow).toBe(0);
  expect(Math.round(box.shellHeight)).toBe(box.viewport);
  // The core's own 70vh cap is replaced by the frame, so the grid keeps a
  // real share of the viewport.
  expect(box.scroller).toBeGreaterThan(box.viewport * 0.4);
});

test("view switching preserves the anchor date and marks the active view", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator('.join [data-view="resourceThreeDays"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('.join [data-view="month"]');
  await flushRender(page);
  await expect(page.locator(".cv-month-day").first()).toBeVisible();
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-03");
  await expect(page.locator('.join [data-view="month"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.join [data-view="resourceThreeDays"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.click('.join [data-view="list"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-03");
});

test("clicking an event opens the app-owned detail sheet", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await page.locator(".cv-event").first().click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-title")).not.toBeEmpty();
  await expect(page.locator("#event-log li").first()).toContainText("eventclick");
});

test("tools search reveals a loaded event on its date", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await page.click("#tools-toggle");
  await page.fill("#tools-search", "live sync");
  await expect(page.locator('#tools-results button:has-text("Live sync")')).toBeVisible();
  await page.locator('#tools-results button:has-text("Live sync")').click();
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-04");
});

test("the mini month navigates the anchor date", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText("3");
  await page.click('.sc-mini-day[data-date="2026-09-10"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-10");
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText("10");
});

test("room and kind filters change what the core is given", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator(".cv-resource-header")).toHaveCount(3);

  await page.locator("#room-list input").nth(2).uncheck();
  await flushRender(page);
  await expect(page.locator(".cv-resource-header")).toHaveCount(2);
  await expect(page.locator("#room-summary")).toHaveText("2/3");

  const before = await page.locator(".cv-event").count();
  await page.click('#kind-legend button[data-kind="maintenance"]');
  await flushRender(page);
  await expect(page.locator('#kind-legend button[data-kind="maintenance"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator('.cv-event[data-kind="maintenance"]')).toHaveCount(0);
  expect(await page.locator(".cv-event").count()).toBeLessThan(before);
});

test("the live strip reports the visible range", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const shown = await page.locator(".cv-event").count();
  await expect(page.locator("#cockpit")).toContainText(`${shown} bookings in view`);
  await expect(page.locator("#cockpit")).toContainText("3/3 rooms shown");
});

test("realtime stand-in adds an event without navigation", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const before = await page.locator(".cv-event").count();
  await page.click("#rt-add");
  await flushRender(page);
  await expect(page.locator(".cv-event")).toHaveCount(before + 1);
  await expect(page.locator("#event-log li").first()).toContainText("realtime add");
});
