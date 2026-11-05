import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

/**
 * Month + list: summary grid and chronological list over shared state,
 * alternate representations without resource matrices.
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
function gotoMonth(page) {
  return page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("month");
  });
}

test("month renders full Monday weeks with outside days dimmed", async ({ page }) => {
  await openDemo(page, "basic");
  await gotoMonth(page);
  await flushRender(page);
  await expect(page.locator(".cv-month-day")).toHaveCount(35);
  await expect(page.locator(".cv-month-weekday")).toHaveCount(7);
  const first = page.locator(".cv-month-day").first();
  await expect(first).toHaveAttribute("data-date", "2026-08-31");
  await expect(first).toHaveAttribute("data-outside", "true");
  await expect(page.locator('[data-date="2026-09-01"]')).not.toHaveAttribute("data-outside", "true");
});

test("multi-day events repeat per overlapped day, midnight excluded", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "night",
        title: "Night shift",
        start: "2026-09-03T17:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "evening",
        title: "Evening",
        start: "2026-09-03T20:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T00:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await gotoMonth(page);
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-03"] [data-event-id="night"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-04"] [data-event-id="night"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-03"] [data-event-id="evening"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-04"] [data-event-id="evening"]')).toHaveCount(0);
});

test("crowded days collapse behind +n more, honoring monthEventLimit", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = Array.from({ length: 5 }, (_, index) => {
      const hour = String(8 + index).padStart(2, "0");
      return {
        id: `busy-${index}`,
        title: `Busy ${index}`,
        start: `2026-09-03T${hour}:00:00+02:00[Europe/Brussels]`,
        end: `2026-09-03T${hour}:30:00+02:00[Europe/Brussels]`,
      };
    });
  });
  await gotoMonth(page);
  await flushRender(page);
  const cell = page.locator('[data-date="2026-09-03"]');
  await expect(cell.locator(".cv-month-event")).toHaveCount(3);
  await expect(cell.locator(".cv-month-more")).toContainText("+2 more");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ monthEventLimit: 5 });
  });
  await flushRender(page);
  await expect(cell.locator(".cv-month-event")).toHaveCount(5);
  await expect(cell.locator(".cv-month-more")).toHaveCount(0);
});

test("month chips activate like events", async ({ page }) => {
  await openDemo(page, "basic");
  await gotoMonth(page);
  await flushRender(page);
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
  });
  await page.locator('[data-date="2026-09-03"] [data-event-id="a"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["a"]);
  await page.locator('[data-date="2026-09-04"] [data-event-id="b"]').focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["a", "b"]);
});

test("empty month day click selects the civil day", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__select = null;
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:select",
      (/** @type {Event} */ event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        hooks.__select = {
          start: String(detail.start),
          end: String(detail.end),
          resourceId: detail.resourceId,
          allDay: detail.allDay,
        };
      },
    );
  });
  await gotoMonth(page);
  await flushRender(page);
  await page.locator('[data-date="2026-09-05"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__select)).not.toBeNull();
  const selection = await page.evaluate(() => /** @type {any} */ (window).__select);
  // Month has no time geometry: the selection is a civil all-day range.
  expect(selection.start).toBe("2026-09-05");
  expect(selection.end).toBe("2026-09-06");
  expect(selection.allDay).toBe(true);
  expect(selection.resourceId).toBeNull();
});

test("prev and next step whole months", async ({ page }) => {
  await openDemo(page, "basic");
  await gotoMonth(page);
  await flushRender(page);
  const dates = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.gotoDate("2026-09-15");
    calendar.next();
    const afterNext = calendar.getAttribute("date");
    calendar.prev();
    const afterPrev = calendar.getAttribute("date");
    return { afterNext, afterPrev };
  });
  expect(dates.afterNext).toBe("2026-10-15");
  expect(dates.afterPrev).toBe("2026-09-15");
});

test("month sources receive the week-aligned range", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__range = null;
    /** @type {any} */ (document.querySelector("calendar-view")).configure({
      eventSource: (/** @type {{ start: object, end: object }} */ { start, end }) => {
        hooks.__range = { start: String(start), end: String(end) };
        return Promise.resolve([]);
      },
    });
  });
  await gotoMonth(page);
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__range)).not.toBeNull();
  const range = await page.evaluate(() => /** @type {any} */ (window).__range);
  expect(range.start).toContain("2026-08-31");
  expect(range.end).toContain("2026-10-05");
});

test("list renders chronological day groups with empty states", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await expect(page.locator(".cv-list-day")).toHaveCount(7);
  await expect(page.locator('[data-date="2026-09-03"] .cv-list-event')).toHaveCount(2);
  const first = await page
    .locator('[data-date="2026-09-03"] .cv-list-event')
    .first()
    .getAttribute("data-event-id");
  expect(first).toBe("a");
  await expect(page.locator('[data-date="2026-09-05"] .cv-list-empty')).toContainText("No events");
  await expect(page.locator('[data-date="2026-09-03"] .cv-list-event').first()).toContainText("09:00");
});

test("list events activate and switching preserves the anchor date", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__seen = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:eventclick",
      (/** @type {Event} */ event) => hooks.__seen.push(/** @type {CustomEvent} */ (event).detail.event.id),
    );
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  await page.locator('[data-date="2026-09-04"] [data-event-id="b"]').click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__seen)).toEqual(["b"]);
  const state = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("month");
    calendar.setView("week");
    return { date: calendar.getAttribute("date"), view: calendar.view };
  });
  expect(state).toEqual({ date: "2026-09-03", view: "week" });
});

test("list backgrounds are opt-in inert rows in chronological order", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("list");
  });
  await flushRender(page);
  // Off by default: the fixture background stays grid-only.
  await expect(page.locator(".cv-list-background")).toHaveCount(0);

  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const hooks = /** @type {any} */ (window);
    hooks.__intents = [];
    for (const name of [
      "calendar:eventclick",
      "calendar:select",
      "calendar:datechange",
      "calendar:viewchange",
    ]) {
      calendar.addEventListener(name, () => hooks.__intents.push(name));
    }
    calendar.backgrounds = [
      {
        id: "bg",
        start: "2026-09-03T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "room",
        resourceId: "resource-a",
        start: "2026-09-05T22:00:00+02:00[Europe/Brussels]",
        end: "2026-09-06T02:00:00+02:00[Europe/Brussels]",
      },
      { id: "closed", allDay: true, start: "2026-09-04", end: "2026-09-05" },
    ];
    calendar.configure({ listBackgrounds: true });
  });
  await flushRender(page);

  const day3 = page.locator('[data-date="2026-09-03"]');
  await expect(day3.locator(".cv-list-background, .cv-list-event")).toHaveCount(3);
  await expect(day3.locator(".cv-list-background, .cv-list-event").first()).toHaveAttribute(
    "data-background-id",
    "bg",
  );
  await expect(day3.locator('[data-background-id="bg"]')).toHaveText("08:00–12:00");
  // The all-day background leads its day, ahead of the timed event.
  const day4 = page.locator('[data-date="2026-09-04"]');
  await expect(day4.locator(".cv-list-background, .cv-list-event").first()).toHaveAttribute(
    "data-background-id",
    "closed",
  );
  await expect(day4.locator('[data-background-id="closed"]')).toHaveText("All day");
  // A resource-scoped range is not filtered, and an overnight range splits at midnight.
  await expect(page.locator('[data-date="2026-09-05"] [data-background-id="room"]')).toHaveText(
    "22:00–24:00",
  );
  await expect(page.locator('[data-date="2026-09-06"] [data-background-id="room"]')).toHaveText(
    "00:00–02:00",
  );
  // A day holding only backgrounds still has no events.
  await expect(page.locator('[data-date="2026-09-05"] .cv-list-empty')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-05"] > :last-child')).toHaveClass("cv-list-empty");

  // Inert: not focusable, and a click emits no intent.
  const row = day3.locator('[data-background-id="bg"]');
  expect(await row.evaluate((element) => element.tagName)).toBe("DIV");
  expect(await row.getAttribute("tabindex")).toBeNull();
  await row.click();
  await day3.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.classList.contains("cv-list-background"))).toBe(
    false,
  );
  expect(await page.evaluate(() => /** @type {any} */ (window).__intents)).toEqual([]);
});

test("backgroundContent fills list background rows with text or nodes", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      listBackgrounds: true,
      backgroundContent: (/** @type {any} */ { background, date, element }) => {
        element.dataset.seenDate = String(date);
        if (background.id !== "bg") return null;
        const label = document.createElement("strong");
        label.textContent = `Blocked (${background.extendedProps.note})`;
        return label;
      },
    });
    calendar.backgrounds = [
      {
        id: "bg",
        extendedProps: { note: "maintenance" },
        start: "2026-09-03T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      },
      {
        id: "plain",
        start: "2026-09-04T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      },
    ];
    calendar.setView("list");
  });
  await flushRender(page);
  const row = page.locator('[data-background-id="bg"]');
  await expect(row.locator("strong")).toHaveText("Blocked (maintenance)");
  await expect(row).toHaveAttribute("data-seen-date", "2026-09-03");
  // A null return keeps the default span text.
  await expect(page.locator('[data-background-id="plain"]')).toHaveText("08:00–09:00");
});

test("list repeated-hour text uses grid projection and hooks retain real instants", async ({ page }) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [];
    calendar.backgrounds = [
      {
        id: "repeat",
        start: "2026-10-25T02:30:00+02:00[Europe/Brussels]",
        end: "2026-10-25T02:15:00+01:00[Europe/Brussels]",
      },
    ];
    calendar.configure({
      listBackgrounds: true,
      backgroundContent: (/** @type {any} */ { start, end, element }) => {
        element.dataset.elapsed = String(start.until(end).total({ unit: "minutes" }));
        element.dataset.endOffset = end.offset;
        return null;
      },
    });
    calendar.gotoDate("2026-10-25");
    calendar.setView("list");
  });
  await flushRender(page);
  const row = page.locator('[data-background-id="repeat"]');
  await expect(row).toHaveText("02:30–03:15");
  await expect(row).toHaveAttribute("data-elapsed", "45");
  await expect(row).toHaveAttribute("data-end-offset", "+01:00");
});

test("skipped midnight creates neither an empty list background nor a next-day month chip", async ({
  page,
}) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const range = {
      id: "evening",
      start: "2026-09-05T22:00:00-04:00[America/Santiago]",
      end: "2026-09-06T01:00:00-03:00[America/Santiago]",
    };
    calendar.configure({ timeZone: "America/Santiago", listBackgrounds: true });
    calendar.events = [{ ...range, title: "Evening" }];
    calendar.backgrounds = [range];
    calendar.gotoDate("2026-09-05");
    calendar.setView("list");
  });
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-05"] .cv-list-background')).toHaveText("22:00–24:00");
  await expect(
    page.locator('[data-date="2026-09-06"] .cv-list-background, [data-date="2026-09-06"] .cv-list-event'),
  ).toHaveCount(0);
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-05"] [data-event-id="evening"]')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-09-06"] [data-event-id="evening"]')).toHaveCount(0);
});

test("month comparator controls visible chips, Tab order and more payload without sorting state", async ({
  page,
}) => {
  await openDemo(page, "basic");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = ["a", "b", "c"].map((id, index) => ({
      id,
      title: id,
      resourceId: index === 1 ? "b" : "a",
      editable: false,
      start: `2026-09-03T${String(9 + index).padStart(2, "0")}:00:00+02:00[Europe/Brussels]`,
      end: `2026-09-03T${String(9 + index).padStart(2, "0")}:30:00+02:00[Europe/Brussels]`,
    }));
    calendar.configure({
      monthEventLimit: 2,
      monthEventOrder: (/** @type {any} */ a, /** @type {any} */ b) => b.id.localeCompare(a.id),
    });
    calendar.addEventListener("calendar:moreclick", (/** @type {CustomEvent} */ event) => {
      /** @type {any} */ (window).ordered = event.detail.events.map((/** @type {any} */ item) => item.id);
    });
    calendar.setView("month");
  });
  const cell = page.locator('.cv-month-day[data-date="2026-09-03"]');
  await expect(cell.locator(".cv-month-event")).toHaveText(["c", "b"]);
  await cell.locator(".cv-month-event").first().focus();
  await page.keyboard.press("Tab");
  await expect(cell.locator('[data-event-id="b"]')).toBeFocused();
  await cell.locator(".cv-month-more").click();
  expect(await page.evaluate(() => /** @type {any} */ (window).ordered)).toEqual(["c", "b", "a"]);
  expect(
    await page.evaluate(() =>
      /** @type {any} */ (document.querySelector("calendar-view")).events.map(
        (/** @type {any} */ event) => event.id,
      ),
    ),
  ).toEqual(["a", "b", "c"]);
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.removeEvent("c");
    calendar.addEvent({
      id: "d",
      title: "d",
      start: "2026-09-03T12:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T13:00:00+02:00[Europe/Brussels]",
    });
  });
  await expect(cell.locator(".cv-month-event")).toHaveText(["d", "b"]);
  await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ monthEventOrder: undefined }),
  );
  await expect(cell.locator(".cv-month-event")).toHaveText(["a", "b"]);
  await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const events = calendar.events;
    calendar.configure({
      monthEventOrder: (/** @type {any} */ a, /** @type {any} */ b) => b.id.localeCompare(a.id),
      eventSource: async () => events,
    });
    await calendar.refetchEvents();
  });
  await expect(cell.locator(".cv-month-event")).toHaveText(["d", "b"]);
});
