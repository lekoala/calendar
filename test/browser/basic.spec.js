import assert from "node:assert/strict";
import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";

test("solo demo renders calendar events", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(3);
});

test("overlapping events share the column width", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-event")).toHaveCount(3);
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
  await page.goto("/demo/basic.html");
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
  await page.goto("/demo/basic.html");
  const now = Temporal.Now.plainDateTimeISO("Europe/Brussels");
  // The indicator only exists inside the slot range, so widen it around the
  // wall clock rather than letting the run depend on the time of day.
  const slotMin = now.hour === 0 ? "00:00" : `${String(now.hour - 1).padStart(2, "0")}:00`;
  const slotMax = now.hour >= 22 ? "23:59" : `${String(now.hour + 1).padStart(2, "0")}:00`;
  const date = await page.evaluate(
    ([min, max]) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.setAttribute("slot-min", min);
      calendar.setAttribute("slot-max", max);
      calendar.today();
      return calendar.getAttribute("date");
    },
    [slotMin, slotMax],
  );
  expect(date).toBe(now.toPlainDate().toString());
  await expect(page.locator(".cv-now")).toHaveCount(1);
});

test("scrollToTime moves the scroller to the requested hour", async ({ page }) => {
  await page.goto("/demo/basic.html");
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
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
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
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="b"]')).toBeVisible();
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

/**
 * Rendering is queued on requestAnimationFrame: wait two frames so a state
 * change is guaranteed to be flushed to the DOM before interacting.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("hovering an empty slot shows a duration preview", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const box = await firstBodyBox(page);
  // 187 minutes sits inside the 11:00 snap step: cross-API sub-pixel slop
  // (~1px) must never flip the asserted step.
  await page.mouse.move(box.x + box.width / 2, box.y + 187 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeVisible();
  await expect(page.locator(".cv-hover-chip").first()).toContainText("+ 11:00");
});

test("hovering an event shows no slot preview", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const box = await firstBodyBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + 187 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeVisible();
  await page.mouse.move(box.x + box.width * 0.25, box.y + 75 * 1.8);
  await expect(page.locator(".cv-hover").first()).toBeHidden();
});

test("clicking an empty slot selects a snapped default-duration range", async ({ page }) => {
  await page.goto("/demo/basic.html");
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
  await page.goto("/demo/basic.html");
  await trackSelections(page);
  const box = await firstBodyBox(page);
  const x = box.x + box.width / 2;
  // Interior snap steps (182/252): exact boundaries would let sub-pixel
  // cross-API slop flip the asserted range on some browsers.
  await page.mouse.move(x, box.y + 182 * 1.8);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 252 * 1.8, { steps: 5 });
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

/**
 * Pre-interaction coordinates. Resets the inner scroll to the top so the
 * point below always lands on the body itself: `scrollIntoViewIfNeeded`
 * scrolls oversized elements differently per browser and can leave a sticky
 * day header covering the target point.
 *
 * @param {import("@playwright/test").Page} page
 */
async function firstBodyBox(page) {
  const body = page.locator(".cv-day-body").first();
  await body.waitFor({ state: "visible" });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector(".cv-scroller")).scrollTop = 0;
  });
  const box = await body.boundingBox();
  assert(box, "expected the first day body to have a bounding box");
  return box;
}

/**
 * Pre-interaction event coordinates. Waits for visibility, then measures;
 * only use before interacting — after a state change prefer eventTop.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} id
 */
async function eventBox(page, id) {
  const target = page.locator(`[data-event-id="${id}"]`).first();
  await target.waitFor({ state: "visible" });
  const box = await target.boundingBox();
  assert(box, `expected event ${id} to have a bounding box`);
  return box;
}

/**
 * Atomic post-mutation position read. Unlike waitFor + boundingBox, a single
 * evaluate never observes the detached window of a re-render: _render clears
 * and rebuilds synchronously, so the query always sees a stable tree.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} id
 */
function eventTop(page, id) {
  return page.evaluate(
    (eventId) =>
      /** @type {any} */ (document.querySelector(`[data-event-id="${eventId}"]`))?.style.top ?? null,
    id,
  );
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} id
 * @param {"n" | "s"} edge
 */
async function resizeHandleBox(page, id, edge) {
  const target = page.locator(`[data-event-id="${id}"] .cv-resize-${edge}`).first();
  await target.waitFor({ state: "visible" });
  const box = await target.boundingBox();
  assert(box, `expected a resize handle for event ${id}`);
  return box;
}

/**
 * @param {import("@playwright/test").Page} page
 */
function trackMoves(page) {
  return page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__moves = [];
    hooks.__resizes = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:eventmove", (/** @type {Event} */ event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      hooks.__moves.push({
        start: String(detail.current.start),
        end: String(detail.current.end),
        resourceId: detail.current.resourceId,
        previousResourceId: detail.previous.resourceId,
        hasRevert: typeof detail.revert === "function",
      });
    });
    calendar.addEventListener("calendar:eventresize", (/** @type {Event} */ event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      hooks.__resizes.push({
        start: String(detail.current.start),
        end: String(detail.current.end),
        hasRevert: typeof detail.revert === "function",
      });
    });
  });
}

/**
 * @param {import("@playwright/test").Page} page
 */
async function readMoves(page) {
  return /** @type {any[]} */ (await page.evaluate(() => /** @type {any} */ (window).__moves));
}

/**
 * @param {import("@playwright/test").Page} page
 */
async function readResizes(page) {
  return /** @type {any[]} */ (await page.evaluate(() => /** @type {any} */ (window).__resizes));
}

test("dragging an event in time dispatches a reversible eventmove", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  const box = await eventBox(page, "a");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => readMoves(page)).toHaveLength(1);
  const [move] = await readMoves(page);
  expect(move.start).toContain("T09:45:00+02:00");
  expect(move.end).toContain("T10:45:00+02:00");
  expect(move.hasRevert).toBe(true);
  // 09:45 sits 105 minutes after the 08:00 slot start at 1.8px per minute.
  await expect.poll(() => eventTop(page, "a")).toBe("189px");
});

test("dragging an event across resources changes its resource", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await trackMoves(page);
  const from = await eventBox(page, "a");
  const bodies = page.locator(".cv-day-body");
  await bodies.first().waitFor({ state: "visible" });
  const target = await bodies.nth(3).boundingBox();
  assert(target, "expected the room-b column");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, from.y + from.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => readMoves(page)).toHaveLength(1);
  const [move] = await readMoves(page);
  expect(move.previousResourceId).toBe("room-a");
  expect(move.resourceId).toBe("room-b");
});

test("a rejected move reverts to its previous position", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (window).__moves = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventmove",
      (/** @type {Event} */ event) => {
        /** @type {any} */ (window).__moves.push(1);
        event.preventDefault();
      },
    );
  });
  const box = await eventBox(page, "a");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(1);
  // 09:00 sits 60 minutes after the 08:00 slot start at 1.8px per minute.
  await expect.poll(() => eventTop(page, "a")).toBe("108px");
});

test("resizing an event dispatches eventresize", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  const box = await resizeHandleBox(page, "a", "s");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 54, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => readResizes(page)).toHaveLength(1);
  const [resize] = await readResizes(page);
  expect(resize.start).toContain("T09:00:00+02:00");
  expect(resize.end).toContain("T10:30:00+02:00");
  expect(resize.hasRevert).toBe(true);
});

test("resizing from the top moves the start", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  const box = await resizeHandleBox(page, "a", "n");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 36, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => readResizes(page)).toHaveLength(1);
  const [resize] = await readResizes(page);
  expect(resize.start).toContain("T08:30:00+02:00");
  expect(resize.end).toContain("T10:00:00+02:00");
});

test("pointercancel aborts a drag without dispatching", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  const box = await eventBox(page, "a");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 4 });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector('[data-event-id="a"]')).dispatchEvent(
      new PointerEvent("pointercancel", { bubbles: true }),
    );
  });
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect(await readMoves(page)).toHaveLength(0);
  await expect.poll(() => eventTop(page, "a")).toBe("108px");
});

test("a non-movable event cannot be dragged or moved by command", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.updateEvent({ ...calendar.getEventById("b"), movable: false });
  });
  await flushRender(page);
  const box = await eventBox(page, "b");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect(await readMoves(page)).toHaveLength(0);
  const rejected = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.moveEvent("b", { start: "2026-09-04T15:00:00+02:00[Europe/Brussels]" });
  });
  expect(rejected).toBeNull();
});

test("dropping on a non-droppable resource reverts silently", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await trackMoves(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [
      { id: "room-a", title: "Room A" },
      { id: "room-b", title: "Room B", droppable: false },
    ];
  });
  await flushRender(page);
  const from = await eventBox(page, "a");
  const column = page.locator(".cv-day-body").nth(3);
  await column.waitFor({ state: "visible" });
  const target = await column.boundingBox();
  assert(target, "expected the room-b column");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, from.y + from.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await readMoves(page)).toHaveLength(0);
  // Event a starts at 09:00, 60 minutes after the 08:00 slot start.
  await expect.poll(() => eventTop(page, "a")).toBe("108px");
});

test("moveEvent and resizeEvent commands share the pointer contract", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  const moved = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return (
      calendar.moveEvent("b", {
        start: "2026-09-04T14:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T14:30:00+02:00[Europe/Brussels]",
      }) !== null
    );
  });
  expect(moved).toBe(true);
  await expect.poll(() => readMoves(page)).toHaveLength(1);
  const resized = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return (
      calendar.resizeEvent("b", {
        start: "2026-09-04T14:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T15:00:00+02:00[Europe/Brussels]",
      }) !== null
    );
  });
  expect(resized).toBe(true);
  await expect.poll(() => readResizes(page)).toHaveLength(1);
});

test("getEventOverlaps answers conflicts from canonical state", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const hits = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar
      .getEventOverlaps({
        start: "2026-09-03T09:45:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:15:00+02:00[Europe/Brussels]",
      })
      .map((/** @type {any} */ entry) => entry.id);
  });
  // Events a (09:00-10:00) and c (09:30-10:30) overlap the range; b is the
  // next day. Adjacent-only ranges report nothing.
  expect(hits).toEqual(["a", "c"]);
  const adjacent = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.getEventOverlaps({
      start: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
    }).length;
  });
  expect(adjacent).toBe(1);
  const empty = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.getEventOverlaps({
      start: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
      end: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
    });
  });
  expect(empty).toEqual([]);
});

test("a dragged event magnetizes to a neighboring boundary", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMoves(page);
  // A predecessor ending off-grid (10:10, not a 15-minute step): dropping
  // the second event at a raw 10:08 must snap to 10:10, not floor to 10:00.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "snap-a",
        title: "First",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:10:00+02:00[Europe/Brussels]",
      },
      {
        id: "snap-b",
        title: "Second",
        start: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T11:40:00+02:00[Europe/Brussels]",
      },
    ];
    calendar.backgrounds = [];
  });
  await flushRender(page);
  const box = await eventBox(page, "snap-b");
  // Press at the event center (11:20, clear of both resize handles, grab
  // offset 20 minutes) and move so the raw start lands near 10:08: two
  // minutes off the 10:10 edge, eight past the 10:00 grid step, so only
  // magnetism explains a 10:10 landing.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 52 * 1.8, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => readMoves(page)).toHaveLength(1);
  const [move] = await readMoves(page);
  expect(move.start).toContain("T10:10:00+02:00");
  expect(move.end).toContain("T10:50:00+02:00");
});
