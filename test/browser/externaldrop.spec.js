import { expect, test } from "@playwright/test";

/**
 * External placement (USE_CASES §12, P2): an application source registers
 * with `addExternalDrop`; dragging it over the grid draws a real-duration
 * ghost and `calendar:externaldrop` delivers only the anchor. The core
 * judges structural geometry; `meta.validate` adds application policy.
 */

/** @param {import("@playwright/test").Page} page */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Register an external source in the page and expose `__extOver`/`__extDrop`
 * drivers that simulate the HTML5 drag lifecycle with a DataTransfer.
 *
 * @param {import("@playwright/test").Page} page
 * @param {unknown} payload
 * @param {object} [meta]
 */
async function injectSource(page, payload, meta = {}) {
  await page.evaluate(
    ({ payload: p, meta: m }) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const source = document.createElement("button");
      source.id = "ext-src";
      source.textContent = "New block";
      document.body.append(source);
      calendar.addExternalDrop(source, p, m);
      /** @param {number} x @param {number} y @param {"dragover" | "drop"} type */
      const dispatch = (x, y, type) => {
        const dt = new DataTransfer();
        source.dispatchEvent(
          new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
        const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
        root.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        );
      };
      /** @type {any} */ (globalThis).__extOver = (/** @type {number} */ x, /** @type {number} */ y) =>
        dispatch(x, y, "dragover");
      /** @type {any} */ (globalThis).__extDrop = (/** @type {number} */ x, /** @type {number} */ y) =>
        dispatch(x, y, "drop");
      /** @type {any} */ (globalThis).__extSource = source;
    },
    { payload, meta },
  );
}

/** @param {import("@playwright/test").Page} page */
async function gridPoint(page) {
  return page.evaluate(() => {
    const body = /** @type {HTMLElement} */ (document.querySelector(".cv-day-body"));
    const rect = body.getBoundingClientRect();
    const labels = [...document.querySelectorAll(".cv-axis-label")];
    // The 10:00 line, plus a small offset safely inside the same snap slot.
    const ten = labels.find((label) => label.textContent?.trim().startsWith("10"));
    const y = (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12;
    return { x: rect.left + rect.width / 2, y };
  });
}

/** @param {import("@playwright/test").Page} page @returns {Promise<number>} measured pixels per minute */
async function pxPerMinute(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll(".cv-axis-label")];
    const byHour = new Map();
    for (const label of labels) {
      const hour = Number.parseInt(label.textContent ?? "", 10);
      if (Number.isFinite(hour)) byHour.set(hour, label.getBoundingClientRect().y);
    }
    // The pitch is the distance between two labels anchored the same way.
    // The first one is not: it sits below its hour line instead of straddling
    // it, so that it does not hang outside the grid. Measure past it.
    const rows = [...byHour.entries()].sort((a, b) => a[1] - b[1]).slice(1);
    const [earlier, later] = rows;
    return later && earlier ? (later[1] - earlier[1]) / 60 : 1.8;
  });
}

test("grid drop delivers the snapped timed anchor and stays cancelable", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await injectSource(page, { kind: "occurrence", ref: "ext-1" }, { duration: 60, title: "New block" });
  const point = await gridPoint(page);

  const detail = await page.evaluate(async ({ x, y }) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return new Promise((resolve) => {
      const handler = (/** @type {any} */ event) => {
        event.preventDefault();
        resolve({
          payload: event.detail.payload,
          time: String(event.detail.time),
          date: String(event.detail.date),
          resourceId: event.detail.resourceId ?? null,
          allDay: event.detail.allDay ?? false,
          prevented: event.defaultPrevented,
        });
      };
      calendar.addEventListener("calendar:externaldrop", handler, { once: true });
      /** @type {any} */ (globalThis).__extDrop(x, y);
    });
  }, point);

  expect(detail).toEqual({
    payload: { kind: "occurrence", ref: "ext-1" },
    time: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
    date: "2026-09-03",
    resourceId: null,
    allDay: false,
    prevented: true,
  });
});

test("dragover paints a ghost shaped by the real duration", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await injectSource(page, { kind: "occurrence" }, { duration: 60, title: "New block" });
  const point = await gridPoint(page);
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extOver(x, y), point);

  await expect(page.locator(".cv-external-ghost")).toHaveCount(1);
  // A 60-minute preview: the ghost height equals the measured axis pitch.
  const px = await pxPerMinute(page);
  await expect(page.locator(".cv-external-ghost")).toHaveCSS("height", `${Math.round(px * 60)}px`);
  await expect(page.locator(".cv-external-ghost")).not.toHaveClass(/cv-invalid/);

  // Leaving the grid clears the ghost.
  await page.evaluate(() => {
    const root = /** @type {HTMLElement} */ (document.querySelector("calendar-view .cv-grid"));
    root.dispatchEvent(new DragEvent("dragleave", { bubbles: true, relatedTarget: null }));
  });
  await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
});

test("an application refusal marks the ghost invalid and suppresses the drop", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  // `validate` is a function, so it cannot cross `page.evaluate` — build the
  // source (with its policy) entirely inside the page.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const source = document.createElement("button");
    document.body.append(source);
    calendar.addExternalDrop(
      source,
      { kind: "occurrence" },
      { duration: 60, validate: () => "Doctor unavailable" },
    );
    /** @param {string} type */
    const driver = (type) => (/** @type {number} */ x, /** @type {number} */ y) => {
      const dt = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
      root.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      );
    };
    /** @type {any} */ (globalThis).__extOver = driver("dragover");
    /** @type {any} */ (globalThis).__extDrop = driver("drop");
  });
  const point = await gridPoint(page);
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extOver(x, y), point);

  await expect(page.locator(".cv-external-ghost")).toHaveClass(/cv-invalid/);
  await expect(page.locator(".cv-external-ghost")).toHaveAttribute("data-reason", "Doctor unavailable");

  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:externaldrop", () => {
      /** @type {any} */ (globalThis).__refusedDropFired = true;
    });
  });
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extDrop(x, y), point);
  await expect
    .poll(() => page.evaluate(() => /** @type {any} */ (globalThis).__refusedDropFired ?? false))
    .toBe(false);
});

test("dropping on the all-day lane places a civil anchor", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  // Force the lane into existence.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      ...calendar.events,
      { id: "ad", title: "Closure", allDay: true, start: "2026-09-03", end: "2026-09-04" },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);

  await injectSource(page, { kind: "batch", ids: ["seed"] }, { allDay: true, title: "Batch" });
  const point = await page.evaluate(() => {
    const lane = /** @type {HTMLElement} */ (document.querySelector(".cv-allday"));
    const rect = lane.getBoundingClientRect();
    return { x: rect.left + rect.width / 3, y: rect.top + rect.height / 2 };
  });

  const detail = await page.evaluate(async ({ x, y }) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return new Promise((resolve) => {
      calendar.addEventListener(
        "calendar:externaldrop",
        (/** @type {any} */ event) =>
          resolve({
            payload: event.detail.payload,
            date: String(event.detail.date),
            time: event.detail.time ?? null,
            allDay: event.detail.allDay,
            resourceId: event.detail.resourceId ?? null,
          }),
        { once: true },
      );
      /** @type {any} */ (globalThis).__extOver(x, y);
      /** @type {any} */ (globalThis).__extDrop(x, y);
    });
  }, point);

  expect(detail).toEqual({
    payload: { kind: "batch", ids: ["seed"] },
    date: "2026-09-03",
    time: null,
    allDay: true,
    resourceId: null,
  });
});

test("a non-droppable resource refuses the drop", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator(".cv-day").first()).toBeVisible();
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [
      { id: "room-a", title: "Room A" },
      { id: "room-b", title: "Room B", droppable: false },
    ];
  });
  await flushRender(page);
  await injectSource(page, { kind: "occurrence" }, { duration: 60 });

  const roomB = await page.evaluate(() => {
    const body = document.querySelector('.cv-day[data-resource-id="room-b"] .cv-day-body');
    const rect = /** @type {HTMLElement} */ (body).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + (600 - 480) * 1.8 };
  });
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extOver(x, y), roomB);
  await expect(page.locator(".cv-external-ghost")).toHaveClass(/cv-invalid/);

  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:externaldrop", () => {
      /** @type {any} */ (globalThis).__blockedDropFired = true;
    });
  });
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extDrop(x, y), roomB);
  await expect
    .poll(() => page.evaluate(() => /** @type {any} */ (globalThis).__blockedDropFired ?? false))
    .toBe(false);
});

test("removeExternalDrop disarms the source; the grid stops previewing", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await injectSource(page, { kind: "occurrence" }, { duration: 60 });
  const point = await gridPoint(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.removeExternalDrop(/** @type {any} */ (globalThis).__extSource);
  });
  await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extOver(x, y), point);
  await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
});
