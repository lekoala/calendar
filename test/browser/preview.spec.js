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

test("previewRange paints event geometry without dispatching a selection", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    /** @type {any} */ (window).__selects = 0;
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener("calendar:select", () => {
      /** @type {any} */ (window).__selects += 1;
    });
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  const geometry = await page.evaluate(() => {
    const node = /** @type {any} */ (document.querySelector(".cv-preview"));
    const style = node ? getComputedStyle(node) : null;
    return {
      count: document.querySelectorAll(".cv-preview").length,
      top: node?.style.top ?? null,
      height: node?.style.height ?? null,
      hidden: node?.getAttribute("aria-hidden"),
      eventId: node?.dataset.eventId ?? null,
      pointerEvents: style?.pointerEvents ?? null,
    };
  });
  // 14:00 sits 360 minutes after the 08:00 slot start at 1.8px per minute.
  expect(geometry).toEqual({
    count: 1,
    top: "648px",
    height: "54px",
    hidden: "true",
    eventId: null,
    pointerEvents: "none",
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => /** @type {any} */ (window).__selects)).toBe(0);
});

test("previewRange honors resource columns like events do", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  // room-b only: exactly one column paints.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
      resourceId: "room-b",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  const column = await page.evaluate(
    () =>
      /** @type {any} */ (document.querySelector(".cv-preview")?.closest(".cv-day"))?.dataset.resourceId ??
      null,
  );
  expect(column).toBe("room-b");
  // Null resourceId in a resource view paints nothing, like an unassigned event.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
      resourceId: null,
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
});

test("previewRange in a solo view accepts a resource id", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  // Solo columns accept every range, like they accept every event: a proposal
  // carrying its resource still paints (MyConsultation solo views).
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
      resourceId: "room-a",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
});

test("previewRange replaces, clearPreview removes, and both survive renders", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  // Replacement, not accumulation.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T15:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T16:00:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  const top = await page.evaluate(
    () => /** @type {any} */ (document.querySelector(".cv-preview"))?.style.top ?? null,
  );
  // 15:00 sits 420 minutes after the 08:00 slot start.
  expect(top).toBe("756px");
  // Render state: an unrelated mutation repaints but keeps the preview.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).addEvent({
      id: "extra",
      title: "Extra",
      start: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T11:30:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).clearPreview());
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
  // Clearing nothing renders nothing extra and throws nothing.
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).clearPreview());
});

test("previewRange paints one overlay per touched day", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T17:00:00+02:00[Europe/Brussels]",
      end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(2);
});

test("previewRange rejects non-timed and empty ranges", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  const names = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const caught = [];
    for (const range of [
      { start: "2026-09-03", end: "2026-09-04" },
      {
        start: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
        end: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      },
      {
        start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      },
      {},
    ]) {
      try {
        calendar.previewRange(range);
      } catch (error) {
        caught.push(/** @type {any} */ (error).constructor.name);
      }
    }
    return caught;
  });
  expect(names).toEqual(["TypeError", "TypeError", "TypeError", "TypeError"]);
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
});

test("previewRange paints nothing the view cannot represent", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator('[data-event-id="a"]')).toBeVisible();
  // Out of the visible range: state is kept, nothing is painted.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-20T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-20T14:30:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
  // Month has no time geometry: same range shape, no overlay, no error.
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await expect(page.locator(".cv-month-event").first()).toBeVisible();
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).previewRange({
      start: "2026-09-03T14:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T14:30:00+02:00[Europe/Brussels]",
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
});
