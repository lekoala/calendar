import { expect, test } from "@playwright/test";

/**
 * M4 resourceTimeGrid acceptance: grouped headers, Temporal slicing,
 * unassigned-event policy, global backgrounds, capabilities, density,
 * state preservation and source races.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("resource view renders one grouped header per resource", async ({ page }) => {
  await page.goto("/demo/resources.html");
  const headers = page.locator(".cv-resource-header");
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(0)).toHaveAttribute("data-resource-id", "room-a");
  await expect(headers.nth(1)).toHaveAttribute("data-resource-id", "room-b");
  await expect(headers.nth(0)).toContainText("Room A");
  // Each header spans its 3 date columns; day headers keep only the date.
  const span = await headers.nth(0).evaluate((node) => node.style.gridColumn);
  expect(span).toBe("span 3");
  await expect(page.locator(".cv-day-header").first()).toHaveText("2026-09-03");
});

test("resourceHeaderContent is called once per resource", async ({ page }) => {
  await page.goto("/demo/resources.html");
  const calls = await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__resourceHeaders = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      resourceHeaderContent: (/** @type {any} */ info) => {
        hooks.__resourceHeaders.push(info.resource.id);
        const node = document.createElement("strong");
        node.textContent = info.resource.title;
        return node;
      },
    });
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(hooks.__resourceHeaders))),
    );
  });
  expect(calls).toEqual(["room-a", "room-b"]);
});

test("overnight event is sliced across both days", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "night",
        resourceId: "room-a",
        title: "Night shift",
        start: "2026-09-03T17:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  // room-a columns are day bodies 0..2: Sep 3 slice 17:00->slotMax, Sep 4 slice slotMin->09:00.
  const columns = await page.evaluate(() => {
    const bodies = [...document.querySelectorAll(".cv-day-body")].slice(0, 3);
    return bodies.map((body) => body.querySelector('[data-event-id="night"]')?.getAttribute("style") ?? null);
  });
  expect(columns[0]).toContain("top: 972px");
  expect(columns[1]).toContain("top: 0px");
  expect(columns[2]).toBeNull();
});

test("event without resource is hidden in resource view but visible in solo", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "global",
        title: "Unassigned",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  await expect(page.locator('[data-event-id="global"]')).toHaveCount(0);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("threeDays");
  });
  await flushRender(page);
  await expect(page.locator('[data-event-id="global"]')).toHaveCount(1);
  await expect(page.locator(".cv-resource-header")).toHaveCount(0);
});

test("global background spans every column, targeted background stays local", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [];
    calendar.backgrounds = [
      {
        id: "all",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "one",
        resourceId: "room-b",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-day-body")].map(
      (body) => body.querySelectorAll(".cv-background").length,
    ),
  );
  // 2 resources x 3 days: global background only on Sep 3 columns (0 and 3),
  // targeted background only on room-b Sep 3 (column 3).
  expect(counts).toEqual([1, 0, 0, 2, 0, 0]);
});

test("non-selectable resource blocks range selection", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__select = 0;
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:select", () => {
      hooks.__select += 1;
    });
    calendar.resources = [
      { id: "room-a", title: "Room A", selectable: false },
      { id: "room-b", title: "Room B" },
    ];
  });
  await flushRender(page);
  const box = await page.locator(".cv-day-body").first().boundingBox();
  if (!box) throw new Error("expected a day body");
  await page.mouse.click(box.x + box.width / 2, box.y + 187 * 1.8);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => /** @type {any} */ (window).__select)).toBe(0);
});

test("resource view with no resources shows an explicit empty state", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).resources = [];
  });
  await flushRender(page);
  await expect(page.locator(".cv-empty")).toHaveCount(1);
  await expect(page.locator(".cv-day")).toHaveCount(0);
});

test("solo view with resources in state renders date columns only", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("threeDays");
  });
  await flushRender(page);
  await expect(page.locator(".cv-resource-header")).toHaveCount(0);
  await expect(page.locator(".cv-day")).toHaveCount(3);
});

test("density fixtures keep minimum width and scroll horizontally", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator(".cv-day")).toHaveCount(6);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = Array.from({ length: 6 }, (_, index) => ({
      id: `room-${index}`,
      title: `Room ${index}`,
    }));
    calendar.setView("resourceDay");
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(6);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("resourceThreeDays");
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(18);
  const overflow = await page.evaluate(() => {
    const scroller = /** @type {any} */ (document.querySelector(".cv-scroller"));
    return scroller.scrollWidth > scroller.clientWidth;
  });
  expect(overflow).toBe(true);
});

test("switching solo and resource preserves date and vertical scroll", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator(".cv-scroller")).toBeAttached();
  const state = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.scrollToTime("12:00");
    return {
      date: calendar.getAttribute("date"),
      scrollTop: calendar.querySelector(".cv-scroller").scrollTop,
      view: calendar.view,
    };
  });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("threeDays");
  });
  await flushRender(page);
  const after = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return {
      date: calendar.getAttribute("date"),
      scrollTop: calendar.querySelector(".cv-scroller").scrollTop,
      view: calendar.view,
    };
  });
  expect(after.date).toBe(state.date);
  expect(after.view).toBe("threeDays");
  expect(Math.abs(after.scrollTop - state.scrollTop)).toBeLessThan(2);
});

test("stress page renders the 12x3 manual configuration", async ({ page }) => {
  await page.goto("/demo/resources-stress.html");
  await expect(page.locator(".cv-day")).toHaveCount(36);
  await expect(page.locator(".cv-resource-header")).toHaveCount(12);
});

test("late source response never overwrites newer resource state", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__releaseSlow = null;
    hooks.__seen = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      eventSource: (/** @type {{ resourceIds: string[] }} */ { resourceIds }) => {
        if (resourceIds.includes("room-c")) {
          return Promise.resolve([
            {
              id: "fast",
              resourceId: "room-c",
              title: "Fast",
              start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
              end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
            },
          ]);
        }
        return new Promise((resolve) => {
          hooks.__releaseSlow = () =>
            resolve([
              {
                id: "slow",
                resourceId: "room-a",
                title: "Slow",
                start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
                end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
              },
            ]);
        });
      },
    });
    calendar.refetchEvents();
  });
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [
      { id: "room-b", title: "Room B" },
      { id: "room-c", title: "Room C" },
    ];
    calendar.refetchEvents();
  });
  await expect(page.locator('[data-event-id="fast"]')).toHaveCount(1);
  // The stale request resolves late and must be ignored even though its
  // promise was never aborted.
  await page.evaluate(() => /** @type {any} */ (window).__releaseSlow());
  await page.waitForTimeout(200);
  await expect(page.locator('[data-event-id="fast"]')).toHaveCount(1);
  await expect(page.locator('[data-event-id="slow"]')).toHaveCount(0);
});
