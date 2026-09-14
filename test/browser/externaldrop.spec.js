import { expect, test } from "@playwright/test";

/**
 * External placement: an application source registers
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

for (const demo of ["basic", "resources"]) {
  test(`${demo}: repeated external hover reuses its ghost and validates only new slots`, async ({ page }) => {
    await page.goto(`/demo/${demo}.html`);
    await expect(page.locator(".cv-day").first()).toBeVisible();
    const result = await page.evaluate(() => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const source = document.createElement("button");
      document.body.append(source);
      let validations = 0;
      let refused = false;
      calendar.addExternalDrop(
        source,
        {},
        {
          duration: 30,
          title: "External event",
          validate: () => {
            validations += 1;
            return refused ? "Range refused" : true;
          },
        },
      );
      const dt = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt }));
      const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
      const bodies = root.querySelectorAll(".cv-day-body");
      const first = bodies[0].getBoundingClientRect();
      /** @param {number} x @param {number} y */
      const over = (x, y) =>
        root.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        );
      const x = first.left + first.width / 2;
      const y = first.top + 190;
      over(x, y);
      const ghost = /** @type {HTMLElement} */ (root.querySelector(".cv-external-ghost"));
      const observer = new MutationObserver(() => {});
      observer.observe(root, { childList: true, subtree: true });
      for (let i = 0; i < 40; i += 1) over(x + (i % 2), y + (i % 2));
      const repeated = { validations, mutations: observer.takeRecords().length };
      observer.disconnect();
      refused = true;
      over(x, y + 80);
      const invalid = ghost.classList.contains("cv-invalid") && ghost.dataset.reason === "Range refused";
      refused = false;
      const next = bodies[1].getBoundingClientRect();
      over(next.left + next.width / 2, next.top + 190);
      return {
        repeated,
        validations,
        invalid,
        sameNode: root.querySelector(".cv-external-ghost") === ghost,
        movedColumn: ghost.parentNode === bodies[1],
        cleared: !ghost.classList.contains("cv-invalid") && !ghost.hasAttribute("data-reason"),
      };
    });
    expect(result).toEqual({
      repeated: { validations: 1, mutations: 0 },
      validations: 3,
      invalid: true,
      sameNode: true,
      movedColumn: true,
      cleared: true,
    });
  });
}

test("external hover invalidates on data changes and drop rechecks application state", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  const result = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    let calls = 0;
    let refused = false;
    calendar.configure({
      interactionPolicy: (
        /** @type {import("../../src/calendar-view.js").InteractionPolicyInput} */ { action, context },
      ) => {
        if (action !== "external") return true;
        calls += 1;
        return refused || context.events.overlapping.some((/** @type {any} */ item) => item.id === "blocker")
          ? "Range refused"
          : true;
      },
    });
    await new Promise(requestAnimationFrame);
    const source = document.createElement("button");
    document.body.append(source);
    calendar.addExternalDrop(source, {}, { duration: 30 });
    const dt = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt }));
    const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
    const body = /** @type {HTMLElement} */ (root.querySelector(".cv-day-body"));
    const rect = body.getBoundingClientRect();
    /** @param {string} type */
    const dispatch = (type) =>
      root.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + 190,
        }),
      );
    dispatch("dragover");
    dispatch("dragover");
    const initialCalls = calls;
    // Data changes invalidate the cache even before their queued render runs.
    calendar.addEvent({
      id: "blocker",
      start: "2026-09-03T08:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T18:00:00+02:00[Europe/Brussels]",
    });
    dispatch("dragover");
    const invalidated =
      calls === initialCalls + 1 &&
      root.querySelector(".cv-external-ghost")?.classList.contains("cv-invalid");
    calendar.removeEvent("blocker");
    dispatch("dragover");
    const validAgain = !root.querySelector(".cv-external-ghost")?.classList.contains("cv-invalid");
    refused = true;
    const beforeDrop = calls;
    let drops = 0;
    calendar.addEventListener("calendar:externaldrop", () => {
      drops += 1;
    });
    dispatch("drop");
    return {
      initialCalls,
      invalidated,
      validAgain,
      rechecked: calls === beforeDrop + 1,
      drops,
      ghosts: root.querySelectorAll(".cv-external-ghost").length,
    };
  });
  expect(result).toEqual({
    initialCalls: 1,
    invalidated: true,
    validAgain: true,
    rechecked: true,
    drops: 0,
    ghosts: 0,
  });
});

for (const end of ["dragend", "remove", "disconnect"]) {
  test(`external ghost is cleared on ${end}`, async ({ page }) => {
    await page.goto("/demo/basic.html");
    await expect(page.locator(".cv-day")).toHaveCount(3);
    await injectSource(page, {}, { duration: 30 });
    const point = await gridPoint(page);
    await page.evaluate(({ x, y }) => /** @type {any} */ (globalThis).__extOver(x, y), point);
    await expect(page.locator(".cv-external-ghost")).toHaveCount(1);
    const remaining = await page.evaluate((end) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const source = /** @type {HTMLElement} */ (document.getElementById("ext-src"));
      if (end === "dragend") source.dispatchEvent(new DragEvent("dragend"));
      else if (end === "remove") calendar.removeExternalDrop(source);
      else calendar.remove();
      return calendar.querySelectorAll(".cv-external-ghost").length;
    }, end);
    expect(remaining).toBe(0);
  });
}

/** @param {import("@playwright/test").Page} page */
async function pointerSource(page) {
  await injectSource(page, {}, { duration: 30, title: "External event" });
  await page.evaluate(() => {
    const source = /** @type {HTMLElement} */ (document.getElementById("ext-src"));
    source.style.cssText = "position:fixed;top:4px;right:4px;z-index:100";
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const state = { clicks: 0, drops: 0, pointerDrop: false, nativeOvers: 0 };
    /** @type {any} */ (globalThis).__pointerExternal = state;
    source.addEventListener("click", () => {
      state.clicks += 1;
    });
    calendar.addEventListener("dragover", () => {
      state.nativeOvers += 1;
    });
    calendar.addEventListener("calendar:externaldrop", (/** @type {any} */ event) => {
      event.preventDefault();
      state.drops += 1;
      state.pointerDrop = event.detail.nativeEvent instanceof PointerEvent;
    });
  });
  const source = await page.locator("#ext-src").boundingBox();
  if (!source) throw new Error("Expected the external source");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
}

for (const demo of ["basic", "resources"]) {
  test(`${demo}: mouse placement follows pointer frames and suppresses the source click`, async ({
    page,
  }) => {
    await page.goto(`/demo/${demo}.html`);
    await expect(page.locator(".cv-day").first()).toBeVisible();
    await pointerSource(page);
    const point = await gridPoint(page);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator(".cv-external-ghost")).toBeVisible();
    const before = await page.locator(".cv-external-ghost").getAttribute("style");
    await page.mouse.move(point.x, point.y + 70);
    await expect(page.locator(".cv-external-ghost")).not.toHaveAttribute("style", String(before));
    await page.mouse.up();
    await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
    expect(await page.evaluate(() => /** @type {any} */ (globalThis).__pointerExternal)).toEqual({
      clicks: 0,
      drops: 1,
      pointerDrop: true,
      nativeOvers: 0,
    });
    await page.locator("#ext-src").click();
    expect(await page.evaluate(() => /** @type {any} */ (globalThis).__pointerExternal.clicks)).toBe(1);
  });
}

for (const end of ["escape", "pointercancel", "lostpointercapture", "remove", "disconnect"]) {
  test(`pointer external placement cancels on ${end} and releases keyboard handling`, async ({ page }) => {
    await page.goto("/demo/basic.html");
    await expect(page.locator(".cv-day")).toHaveCount(3);
    await pointerSource(page);
    const point = await gridPoint(page);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator(".cv-external-ghost")).toBeVisible();
    if (end === "escape") await page.keyboard.press("Escape");
    else
      await page.evaluate((end) => {
        const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
        const source = /** @type {HTMLElement} */ (document.getElementById("ext-src"));
        if (end === "remove") calendar.removeExternalDrop(source);
        else if (end === "disconnect") calendar.remove();
        else source.dispatchEvent(new PointerEvent(end));
      }, end);
    await page.mouse.up();
    await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true });
        document.dispatchEvent(event);
        return {
          handled: event.defaultPrevented,
          drops: /** @type {any} */ (globalThis).__pointerExternal.drops,
        };
      }),
    ).toEqual({ handled: false, drops: 0 });
  });
}

test("pointer external preview survives a data render and follows stationary edge autoscroll", async ({
  page,
}) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await pointerSource(page);
  const point = await gridPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".cv-external-ghost")).toBeVisible();
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEvent({
      id: "remote",
      start: "2026-10-03T08:00:00+02:00[Europe/Brussels]",
      end: "2026-10-03T09:00:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-external-ghost")).toBeVisible();
  const edge = await page.evaluate(() => {
    const scroller = /** @type {HTMLElement} */ (document.querySelector(".cv-scroller"));
    scroller.style.height = "300px";
    const rect = scroller.getBoundingClientRect();
    const body = /** @type {HTMLElement} */ (scroller.querySelector(".cv-day-body"));
    const column = body.getBoundingClientRect();
    return { x: column.left + column.width / 2, y: rect.bottom - 12, scrollTop: scroller.scrollTop };
  });
  await page.mouse.move(edge.x, edge.y);
  await expect
    .poll(() => page.evaluate(() => document.querySelector(".cv-scroller")?.scrollTop ?? 0))
    .toBeGreaterThan(edge.scrollTop + 35);
  await expect(page.locator(".cv-external-ghost")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const scrollTop = await page.evaluate(() => document.querySelector(".cv-scroller")?.scrollTop);
  await flushRender(page);
  expect(await page.evaluate(() => document.querySelector(".cv-scroller")?.scrollTop)).toBe(scrollTop);
  await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
});

test("pointer external placement can enter the all-day lane and leave the grid without a drop", async ({
  page,
}) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEvent({ id: "civil", allDay: true, start: "2026-09-03", end: "2026-09-04" });
  });
  await flushRender(page);
  await pointerSource(page);
  const point = await gridPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".cv-external-ghost:not(.cv-external-ghost-lane)")).toBeVisible();
  const lane = await page.locator(".cv-allday").boundingBox();
  if (!lane) throw new Error("Expected the all-day lane");
  await page.mouse.move(point.x, lane.y + lane.height / 2);
  await expect(page.locator(".cv-external-ghost-lane")).toContainText("External event");
  await page.mouse.move(1, 1);
  await expect(page.locator(".cv-external-ghost")).toHaveCount(0);
  await page.mouse.up();
  expect(await page.evaluate(() => /** @type {any} */ (globalThis).__pointerExternal.drops)).toBe(0);
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
