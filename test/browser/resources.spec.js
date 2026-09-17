import { expect, test } from "@playwright/test";
import { openDemo, slotPoint } from "./fixture.js";

/**
 * resourceTimeGrid acceptance: grouped headers, Temporal slicing,
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
  await openDemo(page, "resources");
  const headers = page.locator(".cv-resource-header");
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(0)).toHaveAttribute("data-resource-id", "room-a");
  await expect(headers.nth(1)).toHaveAttribute("data-resource-id", "room-b");
  await expect(headers.nth(0)).toContainText("Room A");
  // Each header spans its 3 date columns; day headers keep only the date,
  // formatted for the document locale.
  const span = await headers.nth(0).evaluate((node) => node.style.gridColumn);
  expect(span).toBe("span 3");
  await expect(page.locator(".cv-day-header").first()).toHaveText("Thu, 9/3");
});

test("resourceHeaderContent is called once per resource", async ({ page }) => {
  await openDemo(page, "resources");
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
  await openDemo(page, "resources");
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
  await openDemo(page, "resources");
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
  await openDemo(page, "resources");
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
  await openDemo(page, "resources");
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
  const point = await slotPoint(page, { time: "11:07" });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => /** @type {any} */ (window).__select)).toBe(0);
});

test("resource view with no resources shows an explicit empty state", async ({ page }) => {
  await openDemo(page, "resources");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).resources = [];
  });
  await flushRender(page);
  await expect(page.locator(".cv-empty")).toHaveCount(1);
  await expect(page.locator(".cv-day")).toHaveCount(0);
});

test("solo view with resources in state renders date columns only", async ({ page }) => {
  await openDemo(page, "resources");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("threeDays");
  });
  await flushRender(page);
  await expect(page.locator(".cv-resource-header")).toHaveCount(0);
  await expect(page.locator(".cv-day")).toHaveCount(3);
});

test("density fixtures keep minimum width and scroll horizontally", async ({ page }) => {
  await openDemo(page, "resources");
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
  await openDemo(page, "resources");
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
  await openDemo(page, "resources-stress");
  await expect(page.locator(".cv-day")).toHaveCount(36);
  await expect(page.locator(".cv-resource-header")).toHaveCount(12);
});

test("late source response never overwrites newer resource state", async ({ page }) => {
  await openDemo(page, "resources");
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

test("geometry seams resize the axis and sticky header rows together", async ({ page }) => {
  await openDemo(page, "resources");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.createElement("calendar-view"));
    calendar.id = "seams";
    calendar.setAttribute("date", "2026-09-03");
    calendar.setAttribute("view", "resourceThreeDays");
    calendar.style.setProperty("--calendar-axis-size", "2.5rem");
    calendar.style.setProperty("--calendar-resource-row-size", "2rem");
    calendar.style.setProperty("--calendar-group-row-size", "1.25rem");
    calendar.resources = [
      { id: "room-a", title: "Room A", groupId: "g1" },
      { id: "room-b", title: "Room B", groupId: "g1" },
    ];
    calendar.resourceGroups = [{ id: "g1", title: "Suite" }];
    document.body.append(calendar);
  });
  await flushRender(page);
  await flushRender(page);
  const geometry = await page.evaluate(() => {
    /** @param {Element | null} node @returns {Record<string, string>} */
    const probe = (node) => {
      if (!node) return {};
      const style = getComputedStyle(node);
      return { width: style.width, top: style.top, minHeight: style.minHeight };
    };
    const grid = document.querySelector("#seams .cv-grid");
    return {
      axis: probe(document.querySelector("#seams .cv-axis")).width,
      gridTrack: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ")[0] : "",
      resourceRow: probe(document.querySelector("#seams .cv-resource-header")).minHeight,
      groupRow: probe(document.querySelector("#seams .cv-group-header")).minHeight,
      groupOffset: probe(document.querySelector("#seams .cv-resource-row")).top,
      stackedOffset: probe(document.querySelector("#seams .cv-day-header")).top,
    };
  });
  expect(geometry.axis).toBe("40px");
  expect(geometry.gridTrack).toBe("40px");
  expect(geometry.resourceRow).toBe("32px");
  expect(geometry.groupRow).toBe("20px");
  expect(geometry.groupOffset).toBe("20px");
  expect(geometry.stackedOffset).toBe("52px");
  await page.evaluate(() => document.getElementById("seams")?.remove());
});

test("dragging toward the horizontal edge autoscrolls the wide resource grid", async ({ page }) => {
  await openDemo(page, "resources");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.createElement("calendar-view"));
    calendar.id = "wide";
    calendar.setAttribute("date", "2026-09-03");
    calendar.setAttribute("view", "resourceDay");
    calendar.configure({ timeZone: "Europe/Brussels" });
    calendar.resources = Array.from({ length: 12 }, (_, index) => ({
      id: `room-${index}`,
      title: `Room ${index}`,
    }));
    calendar.events = [
      {
        id: "drag",
        resourceId: "room-0",
        title: "Drag me",
        start: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
      },
    ];
    document.body.append(calendar);
  });
  await flushRender(page);
  await flushRender(page);
  const before = await page.evaluate(() => document.querySelector("#wide .cv-scroller")?.scrollLeft ?? -1);
  expect(before).toBe(0);

  // Dragging past the grid's right edge parks the pointer in the horizontal
  // autoscroll band: the frame loop keeps advancing scrollLeft on its own
  // until the hidden columns are revealed.
  const card = page.locator('#wide [data-event-id="drag"]');
  // The demo page pushes the fresh calendar below the default viewport; the
  // pointer only reaches nodes that are actually in view.
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error("expected the dragged card to be laid out");
  const scroller = await page.locator("#wide .cv-scroller").boundingBox();
  if (!scroller) throw new Error("expected the scroller to be laid out");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(scroller.x + scroller.width - 8, box.y + box.height / 2, { steps: 10 });
  // The frame loop advances scrollLeft on its own; poll instead of a fixed
  // wait so loaded or throttled engines still converge before mouse.up.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const scroller = document.querySelector("#wide .cv-scroller");
          const headers = [...document.querySelectorAll("#wide .cv-resource-header")];
          const viewport = scroller?.getBoundingClientRect();
          const header = headers[headers.length - 1]?.getBoundingClientRect();
          return viewport && header ? header.right > viewport.left && header.left < viewport.right : false;
        }),
      { timeout: 8000 },
    )
    .toBe(true);
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const scroller = document.querySelector("#wide .cv-scroller");
    const headers = [...document.querySelectorAll("#wide .cv-resource-header")];
    const viewport = scroller?.getBoundingClientRect();
    const header = headers[headers.length - 1]?.getBoundingClientRect();
    return {
      scrollLeft: scroller?.scrollLeft ?? -1,
      lastVisible: viewport && header ? header.right > viewport.left && header.left < viewport.right : false,
    };
  });
  expect(after.scrollLeft).toBeGreaterThan(0);
  expect(after.lastVisible).toBe(true);
  await page.evaluate(() => document.getElementById("wide")?.remove());
});
