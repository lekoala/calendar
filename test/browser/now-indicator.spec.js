import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import { openDemo, slotPoints } from "./fixture.js";

const clock = Temporal.ZonedDateTime.from("2026-09-03T23:58:00+02:00[Europe/Brussels]");

/** @param {import("@playwright/test").Page} page @param {boolean} resources */
async function seed(page, resources = false) {
  await page.clock.install({ time: clock.epochMilliseconds });
  await openDemo(page, "basic");
  await page.clock.pauseAt(clock.add({ minutes: 1 }).epochMilliseconds);
  await page.evaluate((resourceView) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setAttribute("slot-min", "00:00");
    calendar.setAttribute("slot-max", "24:00");
    calendar.configure({ locale: "en-GB" });
    calendar.resources = [
      { id: "a", title: "Resource A" },
      { id: "b", title: "Resource B" },
    ];
    calendar.setView(resourceView ? "resourceThreeDays" : "threeDays");
    calendar.events = [
      {
        id: "event",
        title: "Event",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
        resourceId: "a",
        editable: false,
      },
    ];
  }, resources);
  await page.clock.runFor(50);
}

for (const resources of [false, true]) {
  test(`clock markers cross midnight without replacing nodes: resources ${resources}`, async ({ page }) => {
    await seed(page, resources);
    const count = resources ? 2 : 1;
    await expect(page.locator('.cv-day[data-date="2026-09-03"] .cv-now')).toHaveCount(count);
    await page.evaluate(() => {
      const state = /** @type {any} */ (window);
      state.eventNode = document.querySelector('[data-event-id="event"]');
      state.eventNode.focus({ preventScroll: true });
      state.renders = 0;
      document.querySelector("calendar-view")?.addEventListener("calendar:render", () => state.renders++);
      const scroller = /** @type {HTMLElement} */ (document.querySelector(".cv-scroller"));
      scroller.scrollTop = 80;
      state.scrollTop = scroller.scrollTop;
    });
    await page.clock.fastForward(120_000);
    await expect(page.locator('.cv-day[data-date="2026-09-03"] .cv-now')).toHaveCount(0);
    await expect(page.locator('.cv-day[data-date="2026-09-04"] .cv-now')).toHaveCount(count);
    const firstTop = await page
      .locator(".cv-now")
      .first()
      .evaluate((node) => /** @type {HTMLElement} */ (node).style.top);
    await page.clock.fastForward(60_000);
    const nextTop = await page
      .locator(".cv-now")
      .first()
      .evaluate((node) => /** @type {HTMLElement} */ (node).style.top);
    expect(Number.parseFloat(nextTop)).toBeGreaterThan(Number.parseFloat(firstTop));
    expect(
      await page.evaluate(() => {
        const state = /** @type {any} */ (window);
        return {
          same: state.eventNode === document.querySelector('[data-event-id="event"]'),
          focused: document.activeElement === state.eventNode,
          renders: state.renders,
          scroll: document.querySelector(".cv-scroller")?.scrollTop === state.scrollTop,
        };
      }),
    ).toEqual({ same: true, focused: true, renders: 0, scroll: true });
    await page.evaluate(() => document.querySelector("calendar-view")?.remove());
    await page.clock.fastForward(120_000);
    expect(
      await page.evaluate(
        () => /** @type {any} */ (window).eventNode.closest(".cv-grid").querySelectorAll(".cv-now").length,
      ),
    ).toBe(0);
  });
}

test("minute update preserves an active pointer selection", async ({ page }) => {
  await seed(page);
  await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).scrollToTime("10:00"),
  );
  await page.clock.runFor(50);
  const [from, to] = await slotPoints(page, [{ time: "11:02" }, { time: "12:12" }]);
  await page.evaluate(() => {
    const state = /** @type {any} */ (window);
    state.selected = null;
    document.querySelector("calendar-view")?.addEventListener("calendar:select", (event) => {
      state.selected = /** @type {CustomEvent} */ (event).detail;
    });
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.clock.runFor(20);
  await expect(page.locator(".cv-select-chip")).toHaveCount(1);
  await page.clock.fastForward(120_000);
  await expect(page.locator(".cv-select-chip")).toHaveCount(1);
  await page.mouse.up();
  expect(
    await page.evaluate(() => {
      const range = /** @type {any} */ (window).selected;
      return [range.start.toPlainTime().toString(), range.end.toPlainTime().toString()];
    }),
  ).toEqual(["11:00:00", "12:15:00"]);
});

test("minute update preserves an active event drag", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.updateEvent({ id: "event", editable: true });
    calendar.scrollToTime("08:00");
  });
  await page.clock.runFor(50);
  const [from, to] = await slotPoints(page, [{ time: "09:15" }, { time: "10:15" }]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.clock.runFor(20);
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(1);
  await page.clock.fastForward(120_000);
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(1);
  await page.mouse.up();
  expect(
    await page.evaluate(() =>
      /** @type {any} */ (document.querySelector("calendar-view"))
        .getEventById("event")
        .start.toPlainTime()
        .toString(),
    ),
  ).toBe("10:00:00");
});

test("clock markers leave a day view at midnight and restart after reconnect", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("day"));
  await page.clock.runFor(50);
  await expect(page.locator(".cv-now")).toHaveCount(1);
  await page.clock.fastForward(120_000);
  await expect(page.locator(".cv-now")).toHaveCount(0);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.today();
  });
  await page.clock.runFor(50);
  await expect(page.locator(".cv-now")).toHaveCount(1);
  await page.evaluate(() => {
    const calendar = /** @type {HTMLElement} */ (document.querySelector("calendar-view"));
    /** @type {any} */ (window).detachedCalendar = calendar;
    calendar.remove();
  });
  await page.clock.fastForward(120_000);
  await page.evaluate(() =>
    document.querySelector("main")?.append(/** @type {any} */ (window).detachedCalendar),
  );
  await page.clock.runFor(50);
  await expect(page.locator(".cv-now")).toHaveCount(1);
  const top = await page.locator(".cv-now").evaluate((node) => /** @type {HTMLElement} */ (node).style.top);
  await page.clock.fastForward(60_000);
  expect(
    await page
      .locator(".cv-now")
      .evaluate((node) => Number.parseFloat(/** @type {HTMLElement} */ (node).style.top)),
  ).toBeGreaterThan(Number.parseFloat(top));
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await page.clock.runFor(50);
  await page.clock.fastForward(60_000);
  await expect(page.locator(".cv-now")).toHaveCount(0);
});
