import assert from "node:assert/strict";
import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";

test("solo demo renders calendar events", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(3);
});

test("overlapping events share the column width", async ({ page }) => {
  await page.goto("/demo/");
  const widths = await page.evaluate(() =>
    ["a", "c"].map(
      (id) => /** @type {any} */ (document.querySelector(`[data-event-id="${id}"]`)).style.width,
    ),
  );
  expect(widths).toEqual(["50%", "50%"]);
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
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
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
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.today();
    return calendar.getAttribute("date");
  });
  expect(date).toBe(today);
  await expect(page.locator(".cv-now")).toHaveCount(1);
});

test("scrollToTime moves the scroller to the requested hour", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator(".cv-scroller")).toBeAttached();
  const top = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const value = calendar.scrollToTime("10:00");
    return { value, scrollTop: calendar.querySelector(".cv-scroller").scrollTop };
  });
  expect(top.value).toBe(2 * 60 * 1.8);
  expect(top.scrollTop).toBe(2 * 60 * 1.8);
});

test("pointer click dispatches calendar:eventclick", async ({ page }) => {
  await page.goto("/demo/");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
    /** @type {any} */ (document.querySelector(".cv-event")).click();
  });
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["a"]);
});

test("keyboard Enter on a focused event dispatches calendar:eventclick", async ({ page }) => {
  await page.goto("/demo/");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
    /** @type {any} */ (document.querySelector('[data-event-id="b"]')).focus();
  });
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["b"]);
});

/**
 * @param {import("@playwright/test").Page} page
 */
async function firstBodyBox(page) {
  const body = page.locator(".cv-day-body").first();
  await body.scrollIntoViewIfNeeded();
  const box = await body.boundingBox();
  assert(box, "expected the first day body to have a bounding box");
  return box;
}

/**
 * @param {import("@playwright/test").Page} page
 */
function trackSelections(page) {
  return page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__select = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:select",
      (/** @type {Event} */ event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        hooks.__select.push({
          start: detail.start.toString(),
          end: detail.end.toString(),
          resourceId: detail.resourceId,
          cancelable: event.cancelable,
        });
      },
    );
  });
}

/**
 * @param {import("@playwright/test").Page} page
 */
async function readSelections(page) {
  return /** @type {any[]} */ (await page.evaluate(() => /** @type {any} */ (window).__select));
}

/**
 * @param {import("@playwright/test").Page} page
 */
async function selectionCount(page) {
  return page.evaluate(() => /** @type {any} */ (window).__select.length);
}

test("hovering an empty slot shows a duration preview", async ({ page }) => {
  await page.goto("/demo/");
  const box = await firstBodyBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + 180 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeVisible();
  await expect(page.locator(".cv-hover-chip").first()).toContainText("+ 11:00");
});

test("hovering an event shows no slot preview", async ({ page }) => {
  await page.goto("/demo/");
  const box = await firstBodyBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + 180 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeVisible();
  await page.mouse.move(box.x + box.width * 0.25, box.y + 75 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeHidden();
});

test("clicking an empty slot selects a snapped default-duration range", async ({ page }) => {
  await page.goto("/demo/");
  await trackSelections(page);
  const box = await firstBodyBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + 187 * 1.8);
  await expect.poll(() => selectionCount(page)).toBe(1);
  const [selection] = await readSelections(page);
  expect(selection.start).toContain("T11:00:00+02:00");
  expect(selection.end).toContain("T11:30:00+02:00");
  expect(selection.resourceId).toBeNull();
  expect(selection.cancelable).toBe(true);
});

test("dragging selects a snapped range without a residual click selection", async ({ page }) => {
  await page.goto("/demo/");
  await trackSelections(page);
  const box = await firstBodyBox(page);
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 180 * 1.8);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 250 * 1.8, { steps: 5 });
  await expect(page.locator(".cv-select-chip").first()).toContainText("11:00 - 12:15");
  await page.mouse.up();
  await expect.poll(() => selectionCount(page)).toBe(1);
  await page.waitForTimeout(200);
  await expect.poll(() => selectionCount(page)).toBe(1);
  const [selection] = await readSelections(page);
  expect(selection.start).toContain("T11:00:00+02:00");
  expect(selection.end).toContain("T12:15:00+02:00");
});

test("range selection in a resource column returns the resource id", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await trackSelections(page);
  const box = await firstBodyBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + 187 * 1.8);
  await expect.poll(() => selectionCount(page)).toBe(1);
  const [selection] = await readSelections(page);
  expect(selection.resourceId).toBe("room-a");
  expect(selection.start).toContain("T11:00:00+02:00");
});
