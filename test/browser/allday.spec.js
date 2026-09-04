import { expect, test } from "@playwright/test";

/**
 * All-day lane over the shared time-grid columns: civil events and
 * backgrounds in their own row, multi-day bars spanning their civil days,
 * resource blocks never crossing. Solo (basic.html) and resource
 * (resources.html) floors are both exercised.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** @param {import("@playwright/test").Page} page */
async function seedOneAllDay(page) {
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      ...calendar.events,
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);
}

test("all-day events render as bars spanning their civil days, above the timed grid", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  // No all-day data yet: the lane stays absent.
  await expect(page.locator(".cv-allday")).toHaveCount(0);

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      .../** @type {any} */ (document.querySelector("calendar-view")).events,
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  // Thu + Fri covered by [09-03, 09-05): the bar spans the first two columns.
  await expect(page.locator(".cv-allday")).toBeVisible();
  await expect(page.locator(".cv-allday-event")).toHaveAttribute("data-event-id", "ad");
  await expect(page.locator(".cv-allday-event")).toHaveAttribute(
    "aria-label",
    "Offsite, 2026-09-03 to 2026-09-04, all day",
  );
  await expect(page.locator(".cv-allday-event")).toHaveCSS("grid-column-start", "2");
  await expect(page.locator(".cv-allday-event")).toHaveCSS("grid-row-start", "1");
  // Timed events stay in the day bodies, never in the lane.
  await expect(page.locator(".cv-day-body .cv-event")).toHaveCount(3);
  await expect(page.locator(".cv-allday .cv-event")).toHaveCount(0);
});

test("an all-day background paints a full-height lane tint", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.backgrounds = [
      ...calendar.backgrounds,
      { id: "closure", allDay: true, start: "2026-09-04", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-background")).toHaveCount(1);
  await expect(page.locator(".cv-allday-background")).toHaveCSS("grid-column-start", "3");
  await expect(page.locator(".cv-allday-background")).toHaveCSS("grid-row-start", "1");
});

test("allDaySlot false hides the lane without hiding the event elsewhere", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      ...calendar.events,
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-06" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ allDaySlot: false });
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday")).toHaveCount(0);
  await expect(page.locator(".cv-day-body .cv-event")).toHaveCount(3);

  // Month and list stay date-driven: the all-day event keeps appearing there.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("month");
  });
  await flushRender(page);
  await expect(page.locator('.cv-month-event[data-event-id="ad"]')).toHaveCount(3);
});

test("resource views keep each room's bars inside its own block", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator(".cv-day").first()).toBeVisible();
  const cols = await page.locator(".cv-day").count();
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      ...calendar.events,
      {
        id: "ad-a",
        title: "Room A all-day",
        allDay: true,
        start: "2026-09-03",
        end: "2026-09-05",
        resourceId: "room-a",
      },
      {
        id: "ad-b",
        title: "Room B all-day",
        allDay: true,
        start: "2026-09-04",
        end: "2026-09-05",
        resourceId: "room-b",
      },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event")).toHaveCount(2);
  // Different rooms share a row instead of stacking; each bar stays within
  // its own room's date columns (the first block is the first N/2 columns).
  const half = cols / 2;
  const spans = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-allday-event")].map((raw) => {
      const node = /** @type {HTMLElement} */ (raw);
      return {
        start: getComputedStyle(node).gridColumnStart,
        end: getComputedStyle(node).gridColumnEnd,
        row: getComputedStyle(node).gridRowStart,
        id: node.dataset.eventId,
      };
    }),
  );
  const a = spans.find((item) => item.id === "ad-a");
  const b = spans.find((item) => item.id === "ad-b");
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect(Number(a?.start)).toBeGreaterThanOrEqual(2);
  expect(Number(a?.end)).toBeLessThanOrEqual(half + 2);
  expect(Number(b?.start)).toBeGreaterThanOrEqual(half + 2);
  expect(Number(b?.end)).toBeLessThanOrEqual(cols + 2);
  expect(a?.row).toBe("1");
  expect(b?.row).toBe("1");
});

test("an all-day bar clicks and moves by day, pointer and keyboard alike", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await seedOneAllDay(page);

  // Click fires calendar:eventclick against the bar, like any event.
  const clicked = page.evaluate(
    () =>
      new Promise((resolve) => {
        const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
        calendar.addEventListener(
          "calendar:eventclick",
          (/** @type {any} */ event) => resolve(String(event.detail.event.id)),
          { once: true },
        );
      }),
  );
  await page.locator(".cv-allday-event").click();
  expect(await clicked).toBe("ad");

  // Pointer drag one column to the right: the whole span shifts one civil day.
  const bar = page.locator(".cv-allday-event");
  const box = await bar.boundingBox();
  expect(box).not.toBeNull();
  const second = await page.locator(".cv-day").nth(1).boundingBox();
  expect(second).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move((second?.x ?? 0) + (second?.width ?? 0) / 2, (box?.y ?? 0) + 4, { steps: 5 });
  await page.mouse.up();
  await flushRender(page);
  const afterDrag = await page.evaluate(() =>
    String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad").start),
  );
  expect(afterDrag).toBe("2026-09-04");

  // Shift + arrows use the same commit: one more day and the event announces.
  await page.locator(".cv-allday-event").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await flushRender(page);
  const afterKey = await page.evaluate(() =>
    String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad").start),
  );
  expect(afterKey).toBe("2026-09-05");
  // The whole span travelled, so the exclusive end moved too.
  const end = await page.evaluate(() =>
    String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad").end),
  );
  expect(end).toBe("2026-09-07");
});
