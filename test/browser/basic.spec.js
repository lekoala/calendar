import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";

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

test("prev/next shift the anchor date by view length", async ({ page }) => {
  await page.goto("/demo/");
  const dates = await page.evaluate(() => {
    const calendar = document.querySelector("calendar-view");
    const before = calendar.getAttribute("date");
    calendar.next();
    const afterNext = calendar.getAttribute("date");
    calendar.prev();
    const afterPrev = calendar.getAttribute("date");
    return { before, afterNext, afterPrev };
  });
  expect(dates.before).toBe("2026-09-03");
  expect(dates.afterNext).toBe("2026-09-06");
  expect(dates.afterPrev).toBe("2026-09-03");
});

test("today returns to the current date and shows the time indicator", async ({ page }) => {
  await page.goto("/demo/");
  const today = Temporal.Now.plainDateISO("Europe/Brussels").toString();
  const date = await page.evaluate(() => {
    document.querySelector("calendar-view").today();
    return document.querySelector("calendar-view").getAttribute("date");
  });
  expect(date).toBe(today);
  await expect(page.locator(".cv-now")).toHaveCount(1);
});

test("scrollToTime moves the scroller to the requested hour", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator(".cv-scroller")).toBeAttached();
  const top = await page.evaluate(() => {
    const calendar = document.querySelector("calendar-view");
    const value = calendar.scrollToTime("10:00");
    return { value, scrollTop: calendar.querySelector(".cv-scroller").scrollTop };
  });
  expect(top.value).toBe(2 * 60 * 1.8);
  expect(top.scrollTop).toBe(2 * 60 * 1.8);
});

test("pointer click dispatches calendar:eventclick", async ({ page }) => {
  await page.goto("/demo/");
  await page.evaluate(() => {
    window.__seen = [];
    document
      .querySelector("calendar-view")
      .addEventListener("calendar:eventclick", (event) => window.__seen.push(event.detail.event.id));
    document.querySelector(".cv-event").click();
  });
  await expect.poll(() => page.evaluate(() => window.__seen)).toEqual(["a"]);
});

test("keyboard Enter on a focused event dispatches calendar:eventclick", async ({ page }) => {
  await page.goto("/demo/");
  await page.evaluate(() => {
    window.__seen = [];
    document
      .querySelector("calendar-view")
      .addEventListener("calendar:eventclick", (event) => window.__seen.push(event.detail.event.id));
    document.querySelectorAll(".cv-event")[1].focus();
  });
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__seen)).toEqual(["b"]);
});
