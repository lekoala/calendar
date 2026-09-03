import { expect, test } from "@playwright/test";

test("solo demo renders calendar events", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(2);
});

test("resource demo creates resource/date columns", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator(".cv-day")).toHaveCount(6);
});

test("incremental mutation API updates without navigation", async ({ page }) => {
  await page.goto("/demo/realtime.html");
  await expect(page.locator("[data-event-id=live]")).toHaveCount(1);
  await page.click("#move");
  await expect(page.locator("[data-event-id=live]")).toContainText("Updated live event");
  await page.click("#remove");
  await expect(page.locator("[data-event-id=live]")).toHaveCount(0);
});
