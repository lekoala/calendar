import { expect, test } from "@playwright/test";

/**
 * Showcase shell: generic room-booking app around the core (Actual CSS skin,
 * rich eventContent cards, app-owned dialogs, local tools search).
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

test("view switching preserves the anchor date and marks the active view", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator('.join [data-view="resourceThreeDays"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('.join [data-view="month"]');
  await flushRender(page);
  await expect(page.locator(".cv-month-day").first()).toBeVisible();
  await expect(page.locator("#anchor-label")).toContainText("2026-09-03");
  await expect(page.locator('.join [data-view="month"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.join [data-view="resourceThreeDays"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.click('.join [data-view="list"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toContainText("2026-09-03");
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
  await expect(page.locator("#anchor-label")).toContainText("2026-09-04");
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
