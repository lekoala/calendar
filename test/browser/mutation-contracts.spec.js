import { expect, test } from "@playwright/test";
import { openDemo, slotPoints } from "./fixture.js";

/** @param {import("@playwright/test").Page} page */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("partial updates preserve metadata and civil boundaries, and explicit clears normalize", async ({
  page,
}) => {
  await openDemo(page, "basic");
  const result = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEvent({
      id: "civil",
      allDay: true,
      start: "2026-09-03",
      end: "2026-09-05",
      resourceId: "a",
      classNames: ["custom"],
      extendedProps: { revision: 7 },
    });
    calendar.updateEvent({ id: "civil", title: "Renamed" });
    const kept = calendar.getEventById("civil");
    let invalid = false;
    try {
      calendar.updateEvent({ id: "civil", end: "2026-09-02" });
    } catch {
      invalid = true;
    }
    const unchanged = calendar.getEventById("civil") === kept;
    calendar.updateEvent({ id: "civil", resourceId: undefined, classNames: null, extendedProps: undefined });
    const cleared = calendar.getEventById("civil");
    return {
      kept: {
        title: kept.title,
        allDay: kept.allDay,
        start: String(kept.start),
        end: String(kept.end),
        classNames: kept.classNames,
        extendedProps: kept.extendedProps,
        resourceId: kept.resourceId,
      },
      invalid,
      unchanged,
      cleared: {
        resourceId: cleared.resourceId ?? null,
        classNames: cleared.classNames,
        extendedProps: cleared.extendedProps,
      },
    };
  });
  expect(result.kept).toEqual({
    title: "Renamed",
    allDay: true,
    start: "2026-09-03",
    end: "2026-09-05",
    resourceId: "a",
    classNames: ["custom"],
    extendedProps: { revision: 7 },
  });
  expect(result.invalid).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.cleared).toEqual({ resourceId: null, classNames: [], extendedProps: {} });
  await expect(page.locator('[data-event-id="civil"]').first()).toContainText("Renamed");
});

test("all-day resizeEvent commits civil ranges, refuses empty ones and can revert", async ({ page }) => {
  await openDemo(page, "basic");
  const result = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [{ id: "civil", allDay: true, start: "2026-09-03", end: "2026-09-05" }];
    /** @type {any} */
    let detail = null;
    let dispatched = 0;
    calendar.addEventListener("calendar:eventresize", (/** @type {any} */ event) => {
      dispatched += 1;
      detail = event.detail;
    });
    calendar.configure({
      interactionPolicy() {
        return "programmatic mutations stay authoritative";
      },
    });
    const resized = calendar.resizeEvent("civil", { start: "2026-09-04", end: "2026-09-06" });
    const committed = calendar.getEventById("civil");
    const previous = detail
      ? { start: String(detail.previous.start), end: String(detail.previous.end) }
      : null;
    const current = detail ? { start: String(detail.current.start), end: String(detail.current.end) } : null;
    detail?.revert();
    const reverted = calendar.getEventById("civil");
    const empty = calendar.resizeEvent("civil", { start: "2026-09-06", end: "2026-09-06" });
    const afterEmpty = calendar.getEventById("civil");
    return {
      resized: resized && { start: String(resized.start), end: String(resized.end) },
      committed: committed && { start: String(committed.start), end: String(committed.end) },
      previous,
      current,
      dispatched,
      reverted: reverted && { start: String(reverted.start), end: String(reverted.end) },
      empty,
      afterEmpty: afterEmpty && { start: String(afterEmpty.start), end: String(afterEmpty.end) },
    };
  });
  expect(result.resized).toEqual({ start: "2026-09-04", end: "2026-09-06" });
  expect(result.committed).toEqual({ start: "2026-09-04", end: "2026-09-06" });
  expect(result.previous).toEqual({ start: "2026-09-03", end: "2026-09-05" });
  expect(result.current).toEqual({ start: "2026-09-04", end: "2026-09-06" });
  expect(result.dispatched).toBe(1);
  expect(result.reverted).toEqual({ start: "2026-09-03", end: "2026-09-05" });
  expect(result.empty).toBeNull();
  expect(result.afterEmpty).toEqual({ start: "2026-09-03", end: "2026-09-05" });
});

for (const view of ["threeDays", "resourceThreeDays"]) {
  test(`${view}: moving a continuation by keyboard shifts the whole event by one day`, async ({ page }) => {
    await openDemo(page, "basic");
    await page.evaluate((view) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.resources = [{ id: "a" }];
      calendar.events = [
        {
          id: "multi",
          resourceId: "a",
          start: "2026-09-03T09:00:30+02:00[Europe/Brussels]",
          end: "2026-09-05T10:00:30+02:00[Europe/Brussels]",
        },
      ];
      calendar.setView(view);
    }, view);
    await flushRender(page);
    await page.locator('.cv-day[data-date="2026-09-04"] [data-event-id="multi"]').focus();
    await page.keyboard.press("Shift+ArrowRight");
    await flushRender(page);
    const moved = await page.evaluate(() => {
      const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("multi");
      return [String(event.start), String(event.end), event.resourceId];
    });
    expect(moved).toEqual([
      "2026-09-04T09:00:30+02:00[Europe/Brussels]",
      "2026-09-06T10:00:30+02:00[Europe/Brussels]",
      "a",
    ]);
    await page.locator('.cv-day[data-date="2026-09-05"] [data-event-id="multi"]').focus();
    await page.keyboard.press("Shift+ArrowLeft");
    expect(
      await page.evaluate(() =>
        String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("multi").start),
      ),
    ).toBe("2026-09-03T09:00:30+02:00[Europe/Brussels]");
  });

  for (const edge of ["start", "end"]) {
    test(`${view}: resize ${edge} validates the full range and keeps its resource`, async ({ page }) => {
      await openDemo(page, "basic");
      await page.evaluate((view) => {
        const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
        calendar.resources = [{ id: "a" }];
        calendar.events = [
          {
            id: "multi",
            resourceId: "a",
            start: "2026-09-03T09:00+02:00[Europe/Brussels]",
            end: "2026-09-05T10:00+02:00[Europe/Brussels]",
          },
        ];
        calendar.backgrounds = [];
        calendar.setView(view);
        /** @type {any} */ (window).maxHours = 49;
        calendar.configure({
          interactionPolicy: (/** @type {any} */ { action, target }) =>
            action !== "resize" ||
            (target.resourceId === "a" &&
              (target.end.epochMilliseconds - target.start.epochMilliseconds) / 3600000 <=
                /** @type {any} */ (window).maxHours),
        });
      }, view);
      await flushRender(page);
      const date = edge === "start" ? "2026-09-03" : "2026-09-05";
      const handle = page.locator(
        `.cv-day[data-date="${date}"] [data-event-id="multi"] .cv-resize-${edge === "start" ? "n" : "s"}`,
      );
      for (const hours of [49, 50]) {
        await page.evaluate((hours) => {
          /** @type {any} */ (window).maxHours = hours;
        }, hours);
        await handle.scrollIntoViewIfNeeded();
        const [target] = await slotPoints(page, [{ date, time: edge === "start" ? "08:01" : "10:59" }]);
        const box = await handle.boundingBox();
        if (!box) throw new Error("expected resize handle");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x, target.y, { steps: 6 });
        if (hours === 49)
          await expect(page.locator('.cv-day [data-event-id="multi"].cv-invalid')).toHaveCount(1);
        await page.mouse.up();
        const duration = await page.evaluate(() => {
          const event = /** @type {any} */ (document.querySelector("calendar-view")).getEventById("multi");
          return (event.end.epochMilliseconds - event.start.epochMilliseconds) / 3600000;
        });
        expect(duration).toBe(hours);
      }
    });
  }
}

for (const view of ["day", "resourceDay"]) {
  test(`${view}: selection reaches the next civil midnight`, async ({ page }) => {
    await openDemo(page, "basic");
    await page.evaluate((view) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.resources = [{ id: "a" }];
      calendar.events = [];
      calendar.backgrounds = [];
      calendar.setView(view);
      calendar.configure({ locale: "en-GB" });
      calendar.setAttribute("slot-min", "21:00");
      calendar.setAttribute("slot-max", "24:00");
      /** @type {any} */ (window).selections = [];
      calendar.addEventListener("calendar:select", (/** @type {any} */ event) => {
        /** @type {any} */ (window).selections.push([
          String(event.detail.start),
          String(event.detail.end),
          event.detail.resourceId,
        ]);
      });
    }, view);
    await flushRender(page);
    const [start, end] = await slotPoints(page, [{ time: "23:31" }, { time: "23:59" }]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => /** @type {any} */ (window).selections)).toEqual([
      [
        "2026-09-03T23:30:00+02:00[Europe/Brussels]",
        "2026-09-04T00:00:00+02:00[Europe/Brussels]",
        view === "day" ? null : "a",
      ],
    ]);
  });
}

test("event and preview colors have fallbacks without color-mix support", async ({ page }) => {
  // Make the CSS parser reject the enhanced function, including its feature
  // query, so the actual fallback cascade is exercised in every engine.
  await page.route("**/dist/calendar.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replaceAll("color-mix(", "unsupported-color-mix("),
    });
  });
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.previewRange({
      start: "2026-09-03T11:00+02:00[Europe/Brussels]",
      end: "2026-09-03T12:00+02:00[Europe/Brussels]",
    });
  });
  await expect(page.locator(".cv-preview")).toBeVisible();
  const colors = await page.evaluate(() =>
    [".cv-event", ".cv-preview", ".cv-background"].map((selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`missing ${selector}`);
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, border: css.borderLeftStyle };
    }),
  );
  for (const color of colors) {
    expect(color.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(color.border).not.toBe("none");
  }
});
