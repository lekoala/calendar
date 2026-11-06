import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

for (const resourceAware of [false, true]) {
  for (const allDay of [false, true]) {
    for (const edge of ["start", "end"]) {
      test(`external render cancels ${allDay ? "all-day" : "timed"} ${edge} resize in ${resourceAware ? "resource" : "solo"} grid`, async ({
        page,
      }) => {
        await openDemo(page, "basic");
        const start = allDay ? "2026-09-04" : "2026-09-04T09:00:00+02:00[Europe/Brussels]";
        const end = allDay ? "2026-09-05" : "2026-09-04T10:00:00+02:00[Europe/Brussels]";
        await page.evaluate(
          ({ resourceAware, allDay, start, end }) => {
            const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
            calendar.resources = [{ id: "resource-a", title: "Resource A" }];
            calendar.setView(resourceAware ? "resourceThreeDays" : "threeDays");
            calendar.events = [
              { id: "resize", title: "Event", allDay, start, end, resourceId: "resource-a" },
            ];
            /** @type {any} */ (window).__resizeCommits = 0;
            calendar.addEventListener("calendar:eventresize", () => {
              /** @type {any} */ (window).__resizeCommits++;
            });
          },
          { resourceAware, allDay, start, end },
        );
        await flushRender(page);
        const direction = allDay ? (edge === "start" ? "w" : "e") : edge === "start" ? "n" : "s";
        const handle = page.locator(`[data-event-id="resize"] .cv-resize-${direction}`);
        await handle.scrollIntoViewIfNeeded();
        const eventNode = page.locator('[data-event-id="resize"]');
        const originalGeometry = await eventNode.getAttribute("style");
        const box = await handle.boundingBox();
        const day = await page
          .locator(`.cv-day[data-date="${edge === "start" ? "2026-09-03" : "2026-09-05"}"]`)
          .boundingBox();
        if (!box || !day) throw new Error("expected resize geometry");
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(
          allDay ? day.x + day.width / 2 : x,
          allDay ? y : y + (edge === "start" ? -30 : 30),
          { steps: 5 },
        );
        await expect(eventNode).not.toHaveAttribute("style", originalGeometry ?? "");
        await page.evaluate(() => {
          /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
            id: "resize",
            title: "Updated externally",
          });
        });
        await flushRender(page);
        await expect(eventNode).toHaveAttribute("style", originalGeometry ?? "");
        await page.mouse.move(x + 10, y + 10);
        await page.mouse.up();
        await flushRender(page);
        expect(
          await page.evaluate(() => {
            const current = /** @type {any} */ (document.querySelector("calendar-view")).getEventById(
              "resize",
            );
            return {
              start: String(current.start),
              end: String(current.end),
              title: current.title,
              resourceId: current.resourceId,
              commits: /** @type {any} */ (window).__resizeCommits,
            };
          }),
        ).toEqual({ start, end, title: "Updated externally", resourceId: "resource-a", commits: 0 });
      });
    }
  }
}

/** @param {import("@playwright/test").Page} page */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("an external update keeps focus on the same rendered segment", async ({ page }) => {
  await openDemo(page, "basic");
  await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').focus();
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Renamed externally",
    });
  });
  await flushRender(page);
  const focused = await page.evaluate(() => {
    const active = /** @type {HTMLElement | null} */ (document.activeElement);
    return {
      id: active?.dataset.eventId ?? null,
      date: active?.closest("[data-date]")?.getAttribute("data-date") ?? null,
      text: active?.textContent ?? null,
    };
  });
  expect(focused).toEqual({ id: "a", date: "2026-09-03", text: "Renamed externally" });
});

test("a multi-day slice keeps its own date focused, not the first slice", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "multi",
        title: "Multi",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-05T10:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  await page.locator('.cv-day[data-date="2026-09-04"] [data-event-id="multi"]').focus();
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "multi",
      title: "Multi updated",
    });
  });
  await flushRender(page);
  const focused = await page.evaluate(() => {
    const active = /** @type {HTMLElement | null} */ (document.activeElement);
    return active?.closest("[data-date]")?.getAttribute("data-date") ?? null;
  });
  expect(focused).toBe("2026-09-04");
});

test("an external update does not steal focus from the application", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "outside-focus";
    document.body.append(input);
    input.focus();
  });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Still outside",
    });
  });
  await flushRender(page);
  expect(await page.evaluate(() => document.activeElement?.id ?? null)).toBe("outside-focus");
});

test("an external update during a drag cancels the gesture without committing", async ({ page }) => {
  await openDemo(page, "basic");
  const event = page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]');
  const box = await event.boundingBox();
  if (!box) throw new Error("expected event geometry");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Changed mid-drag",
    });
  });
  await flushRender(page);
  await page.mouse.up();
  await flushRender(page);
  const state = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const current = calendar.getEventById("a");
    return {
      start: String(current.start),
      end: String(current.end),
      mirrors: document.querySelectorAll(".cv-drag-mirror").length,
      sources: document.querySelectorAll(".cv-drag-source").length,
    };
  });
  expect(state).toEqual({
    start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
    mirrors: 0,
    sources: 0,
  });
});
