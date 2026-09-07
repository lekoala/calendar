import { expect, test } from "@playwright/test";

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

test("revealEvent scrolls to the event and highlights without stealing focus", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const revealed = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("a"),
  );
  expect(revealed).toBe(true);
  // Visuals land on the render seam: flush before reading them.
  await flushRender(page);
  const state = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const node = /** @type {any} */ (document.querySelector('[data-event-id="a"]'));
    return {
      highlighted: node?.classList.contains("cv-reveal") === true && node?.dataset.revealed === "true",
      scrollTop: calendar.querySelector(".cv-scroller").scrollTop,
      focused: document.activeElement === node,
    };
  });
  // Event a starts at 09:00, 60 minutes after the 08:00 slot start.
  expect({ ...state, revealed }).toEqual({
    revealed: true,
    highlighted: true,
    scrollTop: 60 * 1.8,
    focused: false,
  });
  // Success announces the event even without focus (search/keyboard context).
  await expect
    .poll(() => page.evaluate(() => document.querySelector(".cv-status")?.textContent))
    .toContain("Design review");
});

test("revealEvent focuses the node only when asked", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("a", { focus: true });
  });
  await flushRender(page);
  const focused = await page.evaluate(
    () => document.activeElement === document.querySelector('[data-event-id="a"]'),
  );
  expect(focused).toBe(true);
});

test("revealEvent reports misses without navigating", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const unknown = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("no-such-event"),
  );
  expect(unknown).toBe(false);
  // Navigation only moves through gotoDate: flush its render first so the
  // miss below is settled, not observed on the stale tree.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).gotoDate("2026-09-20");
  });
  await flushRender(page);
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return { outOfRange: calendar.revealEvent("a"), date: calendar.getAttribute("date") };
  });
  expect(outcome.outOfRange).toBe(false);
  // revealEvent never navigates: the date only moved through gotoDate.
  expect(outcome.date).toBe("2026-09-20");
});

test("revealEvent highlights all-day, month and list nodes", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      ...calendar.events,
      {
        id: "closure",
        title: "Atrium closure",
        allDay: true,
        start: "2026-09-03",
        end: "2026-09-04",
      },
    ];
  });
  await flushRender(page);
  const lane = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("closure"),
  );
  expect(lane).toBe(true);
  await expect(page.locator('[data-event-id="closure"].cv-reveal')).toHaveCount(1);

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await expect(page.locator(".cv-month-event").first()).toBeVisible();
  const month = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("a"),
  );
  expect(month).toBe(true);
  await expect(page.locator('[data-event-id="a"].cv-reveal')).toHaveCount(1);

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("list"));
  await expect(page.locator(".cv-list-event").first()).toBeVisible();
  const list = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("a"),
  );
  expect(list).toBe(true);
  await expect(page.locator('[data-event-id="a"].cv-reveal')).toHaveCount(1);
});

test("a month event behind +n more schedules the reveal without highlighting", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  // Everything happens synchronously — mutation, view switch, reveal — so
  // the retry path runs while the render is still pending.
  const scheduled = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ monthEventLimit: 1 });
    calendar.setView("month");
    calendar.events = [
      ...calendar.events,
      {
        id: "overflow",
        title: "Overflow",
        start: "2026-09-03T15:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T16:00:00+02:00[Europe/Brussels]",
      },
    ];
    return calendar.revealEvent("overflow");
  });
  // Scheduled, not guaranteed: the event exists and its date is rendered.
  expect(scheduled).toBe(true);
  // Two flushes cover the mutation render plus the announce-triggered one
  // carrying the visuals; the +n more button proves the overflow rendered.
  await flushRender(page);
  await flushRender(page);
  await expect(page.locator(".cv-month-more")).toHaveCount(1);
  await expect(page.locator(".cv-reveal")).toHaveCount(0);
});

test("gotoDate is awaitable and fires a single load", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    let calls = 0;
    calendar.configure({
      eventSource: async () => {
        calls += 1;
        return [
          {
            id: "loaded",
            title: "Loaded",
            start: "2026-09-10T10:00:00+02:00[Europe/Brussels]",
            end: "2026-09-10T10:30:00+02:00[Europe/Brussels]",
          },
        ];
      },
    });
    await calendar.gotoDate("2026-09-10");
    // The awaited load only settles data: the render still rides rAF.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { calls, rendered: document.querySelectorAll('[data-event-id="loaded"]').length };
  });
  expect(outcome.calls).toBe(1);
  expect(outcome.rendered).toBe(1);
});

test("reveal navigates, loads once, then highlights the event", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    let calls = 0;
    calendar.configure({
      eventSource: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return [
          {
            id: "far",
            title: "Far away",
            start: "2026-09-20T10:00:00+02:00[Europe/Brussels]",
            end: "2026-09-20T10:30:00+02:00[Europe/Brussels]",
          },
        ];
      },
    });
    const revealed = await calendar.reveal({ eventId: "far", date: "2026-09-20" });
    return {
      revealed,
      date: calendar.getAttribute("date"),
      calls,
      highlighted:
        /** @type {any} */ (document.querySelector('[data-event-id="far"]'))?.classList.contains(
          "cv-reveal",
        ) === true,
    };
  });
  // One load total: gotoDate's own refetch, awaited — never a second one.
  expect(outcome).toEqual({ revealed: true, date: "2026-09-20", calls: 1, highlighted: true });
});

test("reveal resolves false when a concurrent navigation wins", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      eventSource: async (/** @type {any} */ query) => {
        const { signal } = query;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 300);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          });
        });
        return [
          {
            id: "far",
            title: "Far away",
            start: "2026-09-20T10:00:00+02:00[Europe/Brussels]",
            end: "2026-09-20T10:30:00+02:00[Europe/Brussels]",
          },
        ];
      },
    });
    const pending = calendar.reveal({ eventId: "far", date: "2026-09-20" });
    calendar.gotoDate("2026-09-10");
    const revealed = await pending;
    return {
      revealed,
      date: calendar.getAttribute("date"),
      highlighted: document.querySelectorAll(".cv-reveal").length,
    };
  });
  expect(outcome).toEqual({ revealed: false, date: "2026-09-10", highlighted: 0 });
});

test("reveal requires an event id and an anchor", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const names = [];
    try {
      await calendar.reveal({ date: "2026-09-20" });
    } catch (error) {
      names.push(/** @type {any} */ (error).constructor.name);
    }
    try {
      await calendar.reveal({ eventId: "a" });
    } catch (error) {
      names.push(/** @type {any} */ (error).constructor.name);
    }
    return names;
  });
  expect(outcome).toEqual(["TypeError", "TypeError"]);
});

test("the reveal highlight clears itself", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).revealEvent("a"));
  await expect(page.locator('[data-event-id="a"].cv-reveal')).toHaveCount(1);
  await page.waitForTimeout(2300);
  await expect(page.locator(".cv-reveal")).toHaveCount(0);
});

test("a disconnect settles a pending reveal instead of hanging it", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date.toString();
    // In state but outside the visible band, so no node exists: reveal()
    // falls through to its post-render promise, which a disconnect drops.
    calendar.addEvent({
      id: "outside",
      title: "Outside",
      start: `${day}T03:00:00[Europe/Brussels]`,
      end: `${day}T03:30:00[Europe/Brussels]`,
    });
    const pending = calendar.reveal({ eventId: "outside", date: day });
    calendar.remove();
    return await Promise.race([
      pending.then((/** @type {boolean} */ value) => ({ settled: true, value })),
      new Promise((resolve) => setTimeout(() => resolve({ settled: false }), 600)),
    ]);
  });
  expect(outcome).toEqual({ settled: true, value: false });
});

test("a zoned anchor navigates to the day the calendar shows it on", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date.toString();
    // Late evening in New York is the next morning in Brussels, so the two
    // anchor shapes for one and the same instant must agree on the day.
    const zoned = `${day}T23:30:00-04:00[America/New_York]`;
    calendar.addEvent({
      id: "abroad",
      title: "Abroad",
      start: zoned,
      end: `${day}T23:45:00-04:00[America/New_York]`,
    });
    const shownOn = calendar
      .getEventById("abroad")
      .start.withTimeZone("Europe/Brussels")
      .toPlainDate()
      .toString();
    await calendar.reveal({ eventId: "abroad", start: zoned });
    const fromString = calendar.getAttribute("date");
    await calendar.gotoDate(day);
    await calendar.reveal({ eventId: "abroad", start: calendar.getEventById("abroad").start });
    return { shownOn, fromString, fromObject: calendar.getAttribute("date") };
  });
  expect(outcome.fromString).toBe(outcome.shownOn);
  expect(outcome.fromObject).toBe(outcome.shownOn);
});
