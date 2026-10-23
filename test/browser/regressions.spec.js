import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

/** @param {import("@playwright/test").Page} page */
function flush(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

for (const scenario of ["resource", "hidden", "continuation"]) {
  test(`all-day drag uses civil displacement: ${scenario}`, async ({ page }) => {
    await openDemo(page, "basic");
    await page.evaluate((kind) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.resources = [{ id: "a" }, { id: "b" }];
      calendar.configure({
        dayCount: kind === "hidden" ? 2 : 3,
        hiddenDays: kind === "hidden" ? [6, 7] : [],
      });
      calendar.setView(kind === "resource" ? "resourceThreeDays" : "threeDays");
      calendar.date = kind === "hidden" ? "2026-09-04" : "2026-09-03";
      calendar.events = [
        {
          id: "ad",
          allDay: true,
          resourceId: "a",
          start: kind === "hidden" ? "2026-09-04" : "2026-09-03",
          end: kind === "continuation" ? "2026-09-06" : kind === "hidden" ? "2026-09-05" : "2026-09-04",
        },
      ];
      calendar.backgrounds = [];
    }, scenario);
    await flush(page);
    const points = await page.evaluate((kind) => {
      const bar = /** @type {HTMLElement} */ (
        document.querySelector(".cv-allday-event")
      ).getBoundingClientRect();
      const bodies = [...document.querySelectorAll(".cv-day-body")];
      const source = bodies[kind === "continuation" ? 1 : 0].getBoundingClientRect();
      const target =
        bodies[kind === "resource" ? 3 : kind === "continuation" ? 2 : 1].getBoundingClientRect();
      return {
        x: source.x + source.width / 2,
        y: bar.y + bar.height / 2,
        target: target.x + target.width / 2,
      };
    }, scenario);
    await page.mouse.move(points.x, points.y);
    await page.mouse.down();
    await page.mouse.move(points.target, points.y, { steps: 6 });
    await page.mouse.up();
    const result = await page.evaluate(() => {
      const event = /** @type {any} */ (document.querySelector("calendar-view")).events[0];
      return { start: String(event.start), resourceId: event.resourceId };
    });
    expect(result).toEqual({
      start: scenario === "hidden" ? "2026-09-07" : scenario === "continuation" ? "2026-09-04" : "2026-09-03",
      resourceId: scenario === "resource" ? "b" : "a",
    });
  });
}

for (const resourceView of [false, true]) {
  test(`all-day applicability and collision scope: resource view ${resourceView}`, async ({ page }) => {
    await openDemo(page, "basic");
    await page.evaluate((resource) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.resources = [{ id: "a" }, { id: "b" }];
      calendar.setView(resource ? "resourceThreeDays" : "threeDays");
      const range = { allDay: true, start: "2026-09-03", end: "2026-09-04" };
      calendar.events = [
        { ...range, id: "a", resourceId: "a" },
        { ...range, id: "b", resourceId: "b" },
        { ...range, id: "omitted" },
        { ...range, id: "null", resourceId: null },
      ];
      calendar.backgrounds = [
        { ...range, id: "global" },
        { ...range, id: "null", resourceId: null },
        { ...range, id: "target", resourceId: "b" },
      ];
    }, resourceView);
    await flush(page);
    await expect(page.locator(".cv-allday-event")).toHaveCount(resourceView ? 2 : 4);
    const rows = await page
      .locator(".cv-allday-event")
      .evaluateAll((nodes) => nodes.map((node) => node.style.gridRow));
    expect(new Set(rows).size).toBe(resourceView ? 1 : 4);
    const spans = await page
      .locator(".cv-allday-background")
      .evaluateAll((nodes) => nodes.map((node) => node.style.gridColumn));
    expect(spans).toEqual(
      resourceView ? ["2 / 3", "5 / 6", "2 / 3", "5 / 6", "5 / 6"] : ["2 / 3", "2 / 3", "2 / 3"],
    );
  });
}

for (const source of ["eventSource", "backgroundSource"]) {
  for (const replacement of [false, true]) {
    test(`${source} invalidates pending work on ${replacement ? "replacement" : "removal"}`, async ({
      page,
    }) => {
      await openDemo(page, "basic");
      const result = await page.evaluate(
        async ({ source, replacement }) => {
          const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
          /** @type {(value: any[]) => void} */
          let resolve = () => {
            throw new Error("Source not started");
          };
          let signal = new AbortController().signal;
          /** @type {boolean[]} */
          const loading = [];
          calendar.addEventListener("calendar:loading", (/** @type {any} */ event) =>
            loading.push(event.detail.loading),
          );
          calendar.configure({
            [source]: (/** @type {any} */ query) => {
              signal = query.signal;
              return new Promise((done) => {
                resolve = done;
              });
            },
          });
          const pending = calendar.refetchEvents();
          calendar.configure({ [source]: replacement ? async () => [] : undefined });
          const aborted = signal.aborted;
          const busy = calendar.hasAttribute("aria-busy");
          calendar.events = [{ id: "fresh", allDay: true, start: "2026-09-03", end: "2026-09-04" }];
          calendar.backgrounds = [];
          if (!replacement) await calendar.refetchEvents();
          resolve([{ id: "stale", allDay: true, start: "2026-09-03", end: "2026-09-04" }]);
          await pending;
          return {
            aborted,
            busy,
            loading,
            events: calendar.events.map((/** @type {any} */ event) => event.id),
            backgrounds: calendar.backgrounds.length,
          };
        },
        { source, replacement },
      );
      expect(result).toEqual({
        aborted: true,
        busy: false,
        loading: [true, false],
        events: ["fresh"],
        backgrounds: 0,
      });
    });
  }
}

for (const equal of [false, true]) {
  test(`repeated-hour events and backgrounds stay visible: equal boundaries ${equal}`, async ({ page }) => {
    await openDemo(page, "basic");
    await page.evaluate((equal) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.setView("day");
      calendar.date = "2026-10-25";
      calendar.setAttribute("slot-min", "00:00");
      calendar.setAttribute("slot-max", "05:00");
      const range = {
        id: "fold",
        start: `2026-10-25T02:${equal ? "30" : "45"}:00+02:00[Europe/Brussels]`,
        end: `2026-10-25T02:${equal ? "30" : "15"}:00+01:00[Europe/Brussels]`,
      };
      calendar.events = [range];
      calendar.backgrounds = [range];
    }, equal);
    await flush(page);
    await expect(page.locator('.cv-event[data-event-id="fold"]')).toBeVisible();
    await expect(page.locator(".cv-background")).toBeVisible();
  });
}

for (const action of ["move", "resize", "allDay", "select"]) {
  for (const allowedAtRelease of [false, true]) {
    test(`${action} rechecks dynamic policy at release: ${allowedAtRelease}`, async ({ page }) => {
      await openDemo(page, "basic");
      await page.evaluate((action) => {
        const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
        calendar.events =
          action === "allDay"
            ? [{ id: "ad", allDay: true, start: "2026-09-03", end: "2026-09-04" }]
            : [calendar.events[0]];
        calendar.backgrounds = [];
        /** @type {any} */ (window).allowed = true;
        /** @type {any} */ (window).intents = 0;
        calendar.configure({ interactionPolicy: () => /** @type {any} */ (window).allowed });
        for (const name of ["eventmove", "eventresize", "select"])
          calendar.addEventListener(`calendar:${name}`, () => /** @type {any} */ (window).intents++);
      }, action);
      await flush(page);
      const points = await page.evaluate((action) => {
        const body = /** @type {HTMLElement} */ (
          document.querySelector(".cv-day-body")
        ).getBoundingClientRect();
        const node = document.querySelector(
          action === "select"
            ? ".cv-day-body"
            : action === "allDay"
              ? ".cv-allday-event"
              : action === "resize"
                ? ".cv-resize-s"
                : ".cv-event",
        );
        if (!node) throw new Error("Expected gesture target");
        const box = node.getBoundingClientRect();
        const x = box.x + box.width / 2;
        const y = action === "select" ? body.y + 100 : box.y + box.height / 2;
        return { x, y, tx: action === "allDay" ? x + body.width : x, ty: action === "allDay" ? y : y + 60 };
      }, action);
      await page.mouse.move(points.x, points.y);
      await page.mouse.down();
      await page.evaluate((allowed) => {
        /** @type {any} */ (window).allowed = !allowed;
      }, allowedAtRelease);
      await page.mouse.move(points.tx, points.ty, { steps: 5 });
      await page.evaluate((allowed) => {
        /** @type {any} */ (window).allowed = allowed;
      }, allowedAtRelease);
      await page.mouse.up();
      expect(await page.evaluate(() => /** @type {any} */ (window).intents)).toBe(allowedAtRelease ? 1 : 0);
      await expect(page.locator(".cv-drag-mirror, .cv-selection, .cv-invalid")).toHaveCount(0);
    });
  }
}
