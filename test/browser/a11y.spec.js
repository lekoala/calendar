import { expect, test } from "@playwright/test";

/**
 * M5 mobile + accessibility hardening: keyboard navigation and mutation,
 * context intents (right-click + press-and-hold), live announcements,
 * human-readable names, reduced motion, forced colors and narrow viewports.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * @param {import("@playwright/test").Page} page
 */
function activeEventId(page) {
  return page.evaluate(
    () => /** @type {string | undefined} */ (/** @type {any} */ (document.activeElement)?.dataset?.eventId),
  );
}

test("events expose a human-readable accessible name", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toHaveAttribute(
    "aria-label",
    "Design review, 2026-09-03, 09:00 to 10:00",
  );
});

test("arrow keys move focus within and across columns", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => activeEventId(page)).toBe("c");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => activeEventId(page)).toBe("a");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => activeEventId(page)).toBe("b");
  // Nearest-by-time: b (13:20) lands on c (09:30), not a (09:00).
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => activeEventId(page)).toBe("c");
});

test("Home and End jump to the column edges", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.locator('[data-event-id="c"]').focus();
  await page.keyboard.press("Home");
  await expect.poll(() => activeEventId(page)).toBe("a");
  await page.keyboard.press("End");
  await expect.poll(() => activeEventId(page)).toBe("c");
});

/**
 * @param {import("@playwright/test").Page} page
 */
function trackMutations(page) {
  return page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__moves = [];
    hooks.__resizes = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:eventmove", (/** @type {Event} */ event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      hooks.__moves.push({ start: String(detail.current.start), end: String(detail.current.end) });
    });
    calendar.addEventListener("calendar:eventresize", (/** @type {Event} */ event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      hooks.__resizes.push({ start: String(detail.current.start), end: String(detail.current.end) });
    });
  });
}

test("Shift+ArrowDown moves the focused event and announces it", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMutations(page);
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(1);
  const [move] = await page.evaluate(() => /** @type {any} */ (window).__moves);
  expect(move.start).toContain("T09:15:00+02:00");
  expect(move.end).toContain("T10:15:00+02:00");
  // Focus is restored on the re-rendered node and the status announces it.
  await expect.poll(() => activeEventId(page)).toBe("a");
  await expect(page.locator(".cv-status")).toContainText("Design review, 2026-09-03, 09:15 to 10:15");
});

test("Shift+ArrowRight moves the event to the next day", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMutations(page);
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(1);
  const [move] = await page.evaluate(() => /** @type {any} */ (window).__moves);
  expect(move.start).toContain("2026-09-04T09:00:00+02:00");
});

test("a rejected keyboard move reverts", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventmove",
      (/** @type {Event} */ event) => event.preventDefault(),
    );
  });
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Shift+ArrowDown");
  await page.waitForTimeout(200);
  const top = await page.evaluate(
    () => /** @type {any} */ (document.querySelector('[data-event-id="a"]'))?.style.top,
  );
  expect(top).toBe("108px");
});

test("Alt+ArrowRight extends the end through the resize contract", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMutations(page);
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__resizes.length)).toBe(1);
  const [resize] = await page.evaluate(() => /** @type {any} */ (window).__resizes);
  expect(resize.start).toContain("T09:00:00+02:00");
  expect(resize.end).toContain("T10:15:00+02:00");
});

test("keyboard resize is a no-op on non-resizable events", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackMutations(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.updateEvent({ ...calendar.getEventById("b"), resizable: false });
  });
  await flushRender(page);
  await page.locator('[data-event-id="b"]').focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => /** @type {any} */ (window).__resizes.length)).toBe(0);
});

test("view and date changes are announced", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("day");
  });
  await expect(page.locator(".cv-status")).toContainText("day, 2026-09-03");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).gotoDate("2026-09-10");
  });
  await expect(page.locator(".cv-status")).toContainText("day, 2026-09-10");
});

/**
 * @param {import("@playwright/test").Page} page
 */
function trackContextMenus(page) {
  return page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__context = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventcontextmenu",
      (/** @type {Event} */ event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        hooks.__context.push({
          eventId: detail.event?.id ?? null,
          date: String(detail.date),
          resourceId: detail.resourceId,
          time: detail.time ? String(detail.time) : null,
          cancelable: event.cancelable,
        });
      },
    );
  });
}

test("right-click on an event dispatches a context intent without preventing the menu", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackContextMenus(page);
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__nativePrevented = null;
    /** @type {any} */ (document.querySelector('[data-event-id="a"]')).addEventListener(
      "contextmenu",
      (/** @type {Event} */ event) => {
        hooks.__nativePrevented = event.defaultPrevented;
      },
    );
  });
  await page.locator('[data-event-id="a"]').click({ button: "right" });
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__context.length)).toBe(1);
  const [context] = await page.evaluate(() => /** @type {any} */ (window).__context);
  expect(context.eventId).toBe("a");
  expect(context.cancelable).toBe(true);
  expect(await page.evaluate(() => /** @type {any} */ (window).__nativePrevented)).toBe(false);
});

test("right-click on an empty slot reports date and snapped time", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackContextMenus(page);
  const box = await page.locator(".cv-day-body").first().boundingBox();
  if (!box) throw new Error("expected a day body");
  await page.mouse.click(box.x + box.width / 2, box.y + 187 * 1.8, { button: "right" });
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__context.length)).toBe(1);
  const [context] = await page.evaluate(() => /** @type {any} */ (window).__context);
  expect(context.eventId).toBeNull();
  expect(context.date).toBe("2026-09-03");
  expect(context.resourceId).toBeNull();
  expect(context.time).toContain("T11:00:00+02:00");
});

test("press-and-hold fires a context intent with no select or residual click", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await trackContextMenus(page);
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__selects = 0;
    hooks.__clicks = 0;
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.addEventListener("calendar:select", () => {
      hooks.__selects += 1;
    });
    calendar.addEventListener("calendar:eventclick", () => {
      hooks.__clicks += 1;
    });
  });
  await page.evaluate(() => {
    const target = /** @type {any} */ (document.querySelector('[data-event-id="a"]'));
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 7,
        pointerType: "touch",
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector('[data-event-id="a"]')).dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 7,
        pointerType: "touch",
        button: 0,
      }),
    );
  });
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__context.length)).toBe(1);
  // The synthetic release carries no click, so prove suppression explicitly:
  // the first click is consumed, the second reaches the handler.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector('[data-event-id="a"]')).click();
    /** @type {any} */ (document.querySelector('[data-event-id="a"]')).click();
  });
  const counts = await page.evaluate(() => ({
    selects: /** @type {any} */ (window).__selects,
    clicks: /** @type {any} */ (window).__clicks,
  }));
  expect(counts.selects).toBe(0);
  expect(counts.clicks).toBe(1);
});

test("reduced motion disables transitions", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "media emulation is chromium-only here");
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const duration = await page.evaluate(
    () => getComputedStyle(/** @type {any} */ (document.querySelector(".cv-event"))).transitionDuration,
  );
  expect(duration).toBe("0s");
});

test("forced colors keep events rendered", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "media emulation is chromium-only here");
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.emulateMedia({ forcedColors: "active" });
  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
});

test("narrow viewports keep a scrollable grid", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cv-day")).toHaveCount(6);
  const overflow = await page.evaluate(() => {
    const scroller = /** @type {any} */ (document.querySelector(".cv-scroller"));
    return scroller.scrollWidth > scroller.clientWidth;
  });
  expect(overflow).toBe(true);
});
