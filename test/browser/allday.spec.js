import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

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
  await openDemo(page, "basic");
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
  await openDemo(page, "basic");
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
  await openDemo(page, "basic");
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
  await openDemo(page, "resources");
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

test("all-day resize handles appear only on visible true edges", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event .cv-resize-w")).toHaveCount(1);
  await expect(page.locator(".cv-allday-event .cv-resize-e")).toHaveCount(1);

  // Both real edges are outside the visible 3-day window.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-02", end: "2026-09-07" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);
  await expect(page.locator(".cv-allday-event .cv-resize-handle")).toHaveCount(0);

  // Only the end edge is visible; movement stays available.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-02", end: "2026-09-06" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event .cv-resize-w")).toHaveCount(0);
  await expect(page.locator(".cv-allday-event .cv-resize-e")).toHaveCount(1);
});

test("all-day pointer resize moves the visible start and the exclusive end", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-04", end: "2026-09-05" },
    ];
  });
  await flushRender(page);

  // Move the start edge from Friday back to Thursday.
  let bar = page.locator('.cv-allday-event[data-event-id="ad"]');
  const startHandle = page.locator('.cv-allday-event[data-event-id="ad"] .cv-resize-w');
  const firstDay = await page.locator(".cv-day").first().boundingBox();
  const barBox = await bar.boundingBox();
  const startBox = await startHandle.boundingBox();
  if (!firstDay || !barBox || !startBox) throw new Error("expected all-day resize geometry");
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstDay.x + firstDay.width / 2, barBox.y + barBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await flushRender(page);
  let range = await page.evaluate(() => {
    const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad");
    return [String(event.start), String(event.end)];
  });
  expect(range).toEqual(["2026-09-03", "2026-09-05"]);

  // Move the end edge over Saturday; the stored end stays exclusive (Sunday).
  bar = page.locator('.cv-allday-event[data-event-id="ad"]');
  const endHandle = page.locator('.cv-allday-event[data-event-id="ad"] .cv-resize-e');
  const thirdDay = await page.locator(".cv-day").nth(2).boundingBox();
  const endBox = await endHandle.boundingBox();
  const barBox2 = await bar.boundingBox();
  if (!thirdDay || !endBox || !barBox2) throw new Error("expected all-day resize geometry");
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdDay.x + thirdDay.width / 2, barBox2.y + barBox2.height / 2, { steps: 5 });
  await page.mouse.up();
  await flushRender(page);
  range = await page.evaluate(() => {
    const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad");
    return [String(event.start), String(event.end)];
  });
  expect(range).toEqual(["2026-09-03", "2026-09-06"]);

  // With Sunday hidden, resizing through Saturday still stores Sunday as the exclusive end.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ hiddenDays: [7] });
    calendar.setView("week");
    calendar.events = [{ id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-05" }];
  });
  await flushRender(page);
  const saturdayColumn = page.locator('.cv-day[data-date="2026-09-05"]');
  // The week overflows on narrow screens. Scroll before measuring the
  // gesture so both the end handle and its target are inside the scroller.
  await saturdayColumn.evaluate((column) => {
    const scroller = column.closest(".cv-scroller");
    if (!scroller) throw new Error("expected calendar scroller");
    const overflow = column.getBoundingClientRect().right - scroller.getBoundingClientRect().right;
    if (overflow > 0) scroller.scrollLeft += overflow;
  });
  const saturday = await saturdayColumn.boundingBox();
  const hiddenEndHandle = page.locator('.cv-allday-event[data-event-id="ad"] .cv-resize-e');
  await expect(hiddenEndHandle).toBeInViewport();
  const hiddenBarBox = await page.locator('.cv-allday-event[data-event-id="ad"]').boundingBox();
  const hiddenEndBox = await hiddenEndHandle.boundingBox();
  if (!saturday || !hiddenBarBox || !hiddenEndBox) throw new Error("expected hidden-day resize geometry");
  await page.mouse.move(hiddenEndBox.x + hiddenEndBox.width / 2, hiddenEndBox.y + hiddenEndBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(saturday.x + saturday.width / 2, hiddenBarBox.y + hiddenBarBox.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await flushRender(page);
  expect(
    await page.evaluate(() =>
      String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad").end),
    ),
  ).toBe("2026-09-06");
});

test("all-day pointer resize clamps at one day and keeps the resource", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-04", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  const startHandle = page.locator('.cv-allday-event[data-event-id="ad"] .cv-resize-w');
  const thirdDay = await page.locator(".cv-day").nth(2).boundingBox();
  const barBox = await page.locator('.cv-allday-event[data-event-id="ad"]').boundingBox();
  const startBox = await startHandle.boundingBox();
  if (!thirdDay || !barBox || !startBox) throw new Error("expected resize geometry");
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdDay.x + thirdDay.width / 2, barBox.y + barBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await flushRender(page);
  expect(
    await page.evaluate(() => {
      const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad");
      return [String(event.start), String(event.end)];
    }),
  ).toEqual(["2026-09-04", "2026-09-05"]);

  await openDemo(page, "resources");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "room-ad",
        title: "Room closure",
        allDay: true,
        start: "2026-09-03",
        end: "2026-09-05",
        resourceId: "room-a",
      },
    ];
  });
  await flushRender(page);
  const roomBar = page.locator('.cv-allday-event[data-event-id="room-ad"]');
  const roomEndHandle = page.locator('.cv-allday-event[data-event-id="room-ad"] .cv-resize-e');
  const roomDay = await page
    .locator('.cv-day[data-date="2026-09-05"][data-resource-id="room-a"]')
    .boundingBox();
  const roomBarBox = await roomBar.boundingBox();
  const roomEndBox = await roomEndHandle.boundingBox();
  if (!roomDay || !roomBarBox || !roomEndBox) throw new Error("expected resource resize geometry");
  await page.mouse.move(roomEndBox.x + roomEndBox.width / 2, roomEndBox.y + roomEndBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(roomDay.x + roomDay.width / 2, roomBarBox.y + roomBarBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await flushRender(page);
  expect(
    await page.evaluate(() => {
      const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("room-ad");
      return [String(event.start), String(event.end), event.resourceId];
    }),
  ).toEqual(["2026-09-03", "2026-09-06", "room-a"]);
});

test("all-day keyboard resize keeps at least one day and obeys policy", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-03", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  const bar = page.locator('.cv-allday-event[data-event-id="ad"]');
  await bar.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await flushRender(page);
  await page.locator('.cv-allday-event[data-event-id="ad"]').focus();
  await page.keyboard.press("Alt+ArrowUp");
  await flushRender(page);
  await page.locator('.cv-allday-event[data-event-id="ad"]').focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await flushRender(page);
  await page.locator('.cv-allday-event[data-event-id="ad"]').focus();
  await page.keyboard.press("Alt+ArrowDown");
  await flushRender(page);
  const range = await page.evaluate(() => {
    const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad");
    return [String(event.start), String(event.end)];
  });
  expect(range).toEqual(["2026-09-03", "2026-09-05"]);

  // A one-day event cannot be shrunk by either keyboard edge.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      { id: "ad", title: "Offsite", allDay: true, start: "2026-09-04", end: "2026-09-05" },
    ];
  });
  await flushRender(page);
  await page.locator('.cv-allday-event[data-event-id="ad"]').focus();
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Alt+ArrowLeft");
  expect(
    await page.evaluate(() => {
      const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad");
      return [String(event.start), String(event.end)];
    }),
  ).toEqual(["2026-09-04", "2026-09-05"]);

  // A refusing policy removes handles and blocks keyboard resize.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      interactionPolicy: (/** @type {any} */ { action }) => action !== "resize",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event .cv-resize-handle")).toHaveCount(0);
  await page.locator('.cv-allday-event[data-event-id="ad"]').focus();
  await page.keyboard.press("Alt+ArrowRight");
  expect(
    await page.evaluate(() =>
      String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("ad").end),
    ),
  ).toBe("2026-09-05");
});

test("an all-day bar clicks and moves by day, pointer and keyboard alike", async ({ page }) => {
  await openDemo(page, "basic");
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
  // Grab inside the first date; grabbing the continuation preserves its offset.
  await page.mouse.move((box?.x ?? 0) + (second?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
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
