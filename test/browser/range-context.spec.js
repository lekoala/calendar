import { expect, test } from "@playwright/test";

/**
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
async function firstBodyBox(page) {
  const body = page.locator(".cv-day-body").first();
  await body.waitFor({ state: "visible" });
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector(".cv-scroller")).scrollTop = 0;
  });
  const box = await body.boundingBox();
  if (!box) throw new Error("expected the first day body to have a bounding box");
  return box;
}

/**
 * Point safely inside the 11:00 snap slot (11:05) and clear of the 11:10
 * event: derived from the measured axis pitch, not label positions.
 * @param {import("@playwright/test").Page} page
 */
async function elevenOClock(page) {
  const box = await firstBodyBox(page);
  const ppm = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".cv-axis-label")];
    const byHour = new Map();
    for (const label of labels) {
      const hour = Number.parseInt(label.textContent ?? "", 10);
      if (Number.isFinite(hour)) byHour.set(hour, label.getBoundingClientRect().y);
    }
    const rows = [...byHour.entries()].sort((a, b) => a[1] - b[1]).slice(1);
    const [earlier, later] = rows;
    return later && earlier ? (later[1] - earlier[1]) / 60 : 1.8;
  });
  // slotMin is 08:00 on the demo page; 11:02 sits in the 11:00 snap slot,
  // 8 minutes clear of the 11:10 event edge so neighbor magnetism stays out.
  return { x: box.x + box.width / 2, y: box.y + 182 * ppm };
}

test("select delivers the range context", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "m",
        title: "Meeting",
        start: "2026-09-03T11:10:00+02:00[Europe/Brussels]",
        end: "2026-09-03T11:40:00+02:00[Europe/Brussels]",
      },
    ];
    calendar.backgrounds = [
      {
        id: "cover",
        start: "2026-09-03T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "partial",
        start: "2026-09-03T11:20:00+02:00[Europe/Brussels]",
        end: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  await flushRender(page);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    /** @type {any} */ (window).__selectContext = null;
    calendar.addEventListener("calendar:select", (/** @type {any} */ event) => {
      event.preventDefault();
      /** @type {any} */ (window).__selectContext = {
        start: String(event.detail.start),
        end: String(event.detail.end),
        events: event.detail.context.events.overlapping.map((/** @type {any} */ entry) => entry.id),
        overlapping: event.detail.context.backgrounds.overlapping.map((/** @type {any} */ entry) => entry.id),
        covering: event.detail.context.backgrounds.covering.map((/** @type {any} */ entry) => entry.id),
      };
    });
  });
  const point = await elevenOClock(page);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() => page.evaluate(() => /** @type {any} */ (window).__selectContext), { timeout: 5000 })
    .not.toBe(null);
  const seen = await page.evaluate(() => /** @type {any} */ (window).__selectContext);
  expect(seen.start).toContain("T11:00:00+02:00");
  expect(seen.end).toContain("T11:30:00+02:00");
  expect(seen.events).toEqual(["m"]);
  expect(seen.overlapping).toEqual(["cover", "partial"]);
  expect(seen.covering).toEqual(["cover"]);
});

test("eventmove context is post-commit: the moved event overlaps itself", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const context = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "a",
        title: "A",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "b",
        title: "B",
        start: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
      },
    ];
    let captured = null;
    calendar.addEventListener(
      "calendar:eventmove",
      (/** @type {any} */ event) => {
        captured = {
          moved: event.detail.event.id,
          events: event.detail.context.events.overlapping.map((/** @type {any} */ entry) => entry.id),
        };
      },
      { once: true },
    );
    calendar.moveEvent("a", {
      start: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
      end: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
    });
    return captured;
  });
  expect(context).toEqual({ moved: "a", events: ["a", "b"] });
});

test("externaldrop context covers the previewed range", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "m",
        title: "Meeting",
        start: "2026-09-03T10:30:00+02:00[Europe/Brussels]",
        end: "2026-09-03T11:30:00+02:00[Europe/Brussels]",
      },
    ];
    calendar.backgrounds = [
      {
        id: "cover",
        start: "2026-09-03T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      },
    ];
    const source = document.createElement("button");
    source.id = "ext-src";
    source.textContent = "New block";
    document.body.append(source);
    calendar.addExternalDrop(source, { kind: "occurrence", ref: "ext-1" }, { duration: 60 });
  });
  await flushRender(page);
  const point = await page.evaluate(() => {
    const body = /** @type {HTMLElement} */ (document.querySelector(".cv-day-body"));
    const rect = body.getBoundingClientRect();
    const labels = [...document.querySelectorAll(".cv-axis-label")];
    const ten = labels.find((label) => label.textContent?.trim().startsWith("10"));
    return { x: rect.left + rect.width / 2, y: (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12 };
  });
  const detail = await page.evaluate(({ x, y }) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return new Promise((resolve) => {
      calendar.addEventListener(
        "calendar:externaldrop",
        (/** @type {any} */ event) => {
          event.preventDefault();
          resolve({
            time: String(event.detail.time),
            events: event.detail.context.events.overlapping.map((/** @type {any} */ entry) => entry.id),
            covering: event.detail.context.backgrounds.covering.map((/** @type {any} */ entry) => entry.id),
          });
        },
        { once: true },
      );
      const source = /** @type {HTMLElement} */ (document.querySelector("#ext-src"));
      const dt = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid")).dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }),
      );
    });
  }, point);
  expect(detail.time).toContain("T10:00:00+02:00");
  expect(detail.events).toEqual(["m"]);
  expect(detail.covering).toEqual(["cover"]);
});

test("month select delivers the civil day context", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("month");
    calendar.backgrounds = [{ id: "closure", allDay: true, start: "2026-09-10", end: "2026-09-11" }];
  });
  await flushRender(page);
  await flushRender(page);
  const detail = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return new Promise((resolve) => {
      calendar.addEventListener(
        "calendar:select",
        (/** @type {any} */ event) => {
          event.preventDefault();
          resolve({
            start: String(event.detail.start),
            events: event.detail.context.events.overlapping.map((/** @type {any} */ entry) => entry.id),
            covering: event.detail.context.backgrounds.covering.map((/** @type {any} */ entry) => entry.id),
          });
        },
        { once: true },
      );
      const cell = /** @type {HTMLElement} */ (
        document.querySelector('.cv-month-day[data-date="2026-09-10"]')
      );
      cell.click();
    });
  });
  expect(detail.start).toContain("2026-09-10");
  expect(detail.events).toEqual([]);
  expect(detail.covering).toEqual(["closure"]);
});
