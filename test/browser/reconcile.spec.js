import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

/** @param {import("@playwright/test").Page} page */
function flush(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Configure two timed events in the third day column and record
 * `eventContent` calls. The demo's Brussels zone keeps the fixtures civil.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{ id: string, title: string, start: string, end: string }[]} events
 */
async function setupEvents(page, events) {
  await openDemo(page, "basic");
  await page.evaluate((items) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    /** @type {any} */ (window).__contentCalls = [];
    calendar.configure({
      eventContent: (/** @type {any} */ info) => {
        /** @type {any} */ (window).__contentCalls.push(info.event.id);
        const node = document.createElement("span");
        node.className = "custom-content";
        node.textContent = info.event.title ?? "";
        return node;
      },
    });
    calendar.events = items;
    calendar.backgrounds = [];
  }, events);
  await flush(page);
  await page.evaluate(() => {
    /** @type {any} */ (window).__contentCalls = [];
  });
}

const A = {
  id: "a",
  title: "Alpha",
  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
};
const B = {
  id: "b",
  title: "Beta",
  start: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
};

test("a time-grid update preserves another event node, content and focus", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    const node = /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="b"]')
    );
    node.focus();
    /** @type {any} */ (window).__keptNode = node;
    /** @type {any} */ (window).__keptContent = node.firstElementChild;
  });
  const styleBefore = await page.evaluate(() =>
    /** @type {HTMLElement} */ (/** @type {any} */ (window).__keptNode).getAttribute("style"),
  );

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Alpha updated",
    });
  });
  await flush(page);

  const result = await page.evaluate((before) => {
    const node = /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="b"]')
    );
    return {
      keptNode: node === /** @type {any} */ (window).__keptNode,
      keptContent: node.firstElementChild === /** @type {any} */ (window).__keptContent,
      keptFocus: document.activeElement === node,
      keptGeometry: node.getAttribute("style") === before,
      text: node.textContent,
      calls: /** @type {any} */ (window).__contentCalls,
    };
  }, styleBefore);

  expect(result).toEqual({
    keptNode: true,
    keptContent: true,
    keptFocus: true,
    keptGeometry: true,
    text: "Beta",
    calls: ["a"],
  });
});

test("an overlap change updates a kept neighbour's geometry", async ({ page }) => {
  await setupEvents(page, [A, B]);
  const before = await page.evaluate(() => {
    const node = /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="b"]')
    );
    /** @type {any} */ (window).__keptNode = node;
    return { width: node.style.width, geometry: node.getAttribute("style") };
  });

  // Move A over B: B keeps its node but the collision layout changes.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      start: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
      end: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
    });
  });
  await flush(page);

  const after = await page.evaluate(() => {
    const node = /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="b"]')
    );
    return {
      keptNode: node === /** @type {any} */ (window).__keptNode,
      width: node.style.width,
      geometry: node.getAttribute("style"),
      calls: /** @type {any} */ (window).__contentCalls,
    };
  });

  expect(after.keptNode).toBe(true);
  expect(after.width).not.toBe(before.width);
  expect(after.geometry).not.toBe(before.geometry);
  expect(after.calls).toEqual(["a"]);
});

test("a recreated event uses current data for clicks", async ({ page }) => {
  await setupEvents(page, [A, B]);
  const oldNode = await page.evaluateHandle(() =>
    document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="a"]'),
  );
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Alpha updated",
    });
  });
  await flush(page);

  const result = await page.evaluate(async (old) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const node = /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="a"]')
    );
    const title = await new Promise((resolve) => {
      calendar.addEventListener(
        "calendar:eventclick",
        (/** @type {any} */ event) => resolve(event.detail.event.title),
        { once: true },
      );
      node.click();
    });
    return {
      oldDetached: old instanceof Node ? !old.isConnected : false,
      title,
      text: node.textContent,
    };
  }, oldNode);

  expect(result).toEqual({ oldDetached: true, title: "Alpha updated", text: "Alpha updated" });
});

test("moving an updated event reconciles its old and new columns", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      start: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      end: "2026-09-04T10:00:00+02:00[Europe/Brussels]",
    });
  });
  await flush(page);

  const result = await page.evaluate(() => ({
    source: document.querySelectorAll('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').length,
    target: document.querySelectorAll('.cv-day[data-date="2026-09-04"] [data-event-id="a"]').length,
    keptB: document.querySelectorAll('.cv-day[data-date="2026-09-03"] [data-event-id="b"]').length,
  }));
  expect(result).toEqual({ source: 0, target: 1, keptB: 1 });
});

test("a recreated node keeps tab order coherent", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    /** @type {HTMLElement} */ (
      document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="a"]')
    ).focus();
  });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Alpha updated",
    });
  });
  await flush(page);
  await expect(page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]')).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="b"]')).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]')).toBeFocused();
});

test("an unrelated update during a drag keeps the gesture alive", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    /** @type {any} */ (window).__moves = 0;
    document.querySelector("calendar-view")?.addEventListener("calendar:eventmove", () => {
      /** @type {any} */ (window).__moves += 1;
    });
  });
  const box = await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').boundingBox();
  if (!box) throw new Error("expected event geometry");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 4 });
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(1);

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "b",
      title: "Beta updated",
    });
  });
  await flush(page);
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(1);

  await page.mouse.move(x, y + 80, { steps: 4 });
  await page.mouse.up();
  await flush(page);

  const result = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return {
      moves: /** @type {any} */ (window).__moves,
      start: String(calendar.getEventById("a").start),
      b: calendar.getEventById("b").title,
      mirror: document.querySelectorAll(".cv-drag-mirror").length,
    };
  });
  expect(result.moves).toBe(1);
  expect(result.start).not.toBe(A.start);
  expect(result.b).toBe("Beta updated");
  expect(result.mirror).toBe(0);
});

test("a gesture re-evaluates cached policy after an unrelated update", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    /** @type {any} */ (window).__blocked = false;
    calendar.configure({
      interactionPolicy: () => (/** @type {any} */ (window).__blocked ? "Blocked" : true),
    });
  });
  await flush(page);
  const box = await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').boundingBox();
  if (!box) throw new Error("expected event geometry");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 4 });
  const mirror = page.locator(".cv-drag-mirror");
  await expect(mirror).toHaveCount(1);
  await expect(mirror).not.toHaveClass(/cv-invalid/);

  await page.evaluate(() => {
    /** @type {any} */ (window).__blocked = true;
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "b",
      title: "Beta updated",
    });
  });
  await flush(page);
  // Same snapped target, fresh revision: the cached decision must be redone.
  await page.mouse.move(x, y + 42);
  await expect(mirror).toHaveClass(/cv-invalid/);
  await expect(mirror).toHaveAttribute("data-reason", "Blocked");
  await page.mouse.up();
});

/** @param {import("@playwright/test").Page} page */
async function framesKeepComing(page) {
  const before = await page.evaluate(() => /** @type {any} */ (window).__frames);
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => /** @type {any} */ (window).__frames);
  return after > before;
}

test("an update of the dragged event stops autoscroll and allows a fresh gesture", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__frames = 0;
    hooks.__moves = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      hooks.__frames += 1;
      return raf(callback);
    };
    document.querySelector("calendar-view")?.addEventListener("calendar:eventmove", () => {
      hooks.__moves += 1;
    });
  });
  const box = await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').boundingBox();
  const scroller = await page.locator(".cv-scroller").boundingBox();
  if (!box || !scroller) throw new Error("expected grid geometry");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, scroller.y + scroller.height - 8, { steps: 6 });
  expect(await framesKeepComing(page)).toBe(true);

  // Updating the event under the pointer replaces its node, disposes the
  // gesture and stops the frame-driven autoscroll.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Changed mid-drag",
    });
  });
  await flush(page);
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(0);
  await expect(page.locator(".cv-drag-source")).toHaveCount(0);
  expect(await framesKeepComing(page)).toBe(false);
  await page.mouse.up();
  await flush(page);
  expect(await page.evaluate(() => /** @type {any} */ (window).__moves)).toBe(0);

  // The cancelled autoscroll leaves the scroller where it stopped; bring the
  // event back into view before starting the fresh gesture.
  await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').scrollIntoViewIfNeeded();
  const fresh = await page.locator('.cv-day[data-date="2026-09-03"] [data-event-id="a"]').boundingBox();
  if (!fresh) throw new Error("expected the rebuilt event geometry");
  await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  await page.mouse.down();
  await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2 + 40, { steps: 4 });
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(1);
  await page.mouse.up();
  await flush(page);
  expect(await page.evaluate(() => /** @type {any} */ (window).__moves)).toBe(1);
});

test("an all-day update falls back to a full grid render", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).addEvent({
      id: "ad",
      title: "Closure",
      allDay: true,
      start: "2026-09-03",
      end: "2026-09-04",
    });
  });
  await flush(page);
  const node = await page.evaluateHandle(() =>
    document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="a"]'),
  );

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "ad",
      title: "Closure updated",
    });
  });
  await flush(page);

  const result = await page.evaluate((old) => {
    const current = document.querySelector('.cv-day[data-date="2026-09-03"] [data-event-id="a"]');
    return {
      rebuilt: old instanceof Node ? current !== old : false,
      allDay: document.querySelector(".cv-allday-event")?.textContent ?? null,
      a: document.querySelectorAll('[data-event-id="a"]').length,
    };
  }, node);
  expect(result).toEqual({ rebuilt: true, allDay: "Closure updated", a: 1 });
});

test("a partial update leaves scroll and the now indicator in place", async ({ page }) => {
  await setupEvents(page, [A, B]);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ slotMin: "00:00", slotMax: "24:00" });
    calendar.date = "2026-11-26";
  });
  await page.evaluate(
    (items) => {
      /** @type {any} */ (document.querySelector("calendar-view")).events = items;
    },
    [A, B],
  );
  await flush(page);
  await expect(page.locator(".cv-now")).toHaveCount(1);
  const scrollTop = await page.evaluate(() => {
    const scroller = /** @type {HTMLElement} */ (document.querySelector(".cv-scroller"));
    scroller.scrollTop = 240;
    return scroller.scrollTop;
  });

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).updateEvent({
      id: "a",
      title: "Alpha updated",
    });
  });
  await flush(page);

  const result = await page.evaluate(() => ({
    scrollTop: /** @type {HTMLElement} */ (document.querySelector(".cv-scroller")).scrollTop,
    now: document.querySelectorAll(".cv-now").length,
  }));
  expect(result.scrollTop).toBe(scrollTop);
  expect(result.now).toBe(1);
});
