import { expect, test } from "@playwright/test";

test("dist classic build registers and renders events", async ({ page }) => {
  await page.goto("/demo/dist.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(3);
});

test("dist minified CSS ships the core tokens", async ({ page }) => {
  const response = await page.request.get("/dist/calendar.min.css");
  expect(response.ok()).toBe(true);
  const css = await response.text();
  expect(css).toContain("--calendar-accent");
});

test("dist minified bundle self-registers the element", async ({ page }) => {
  await page.goto("/demo/dist.html");
  const tag = await page.evaluate(() => customElements.get("calendar-view")?.name ?? null);
  expect(tag).toBe("CalendarViewElement");
});
