import { expect, test } from "@playwright/test";

/**
 * M8 contract gaps: source observability, a render signal, class application
 * across every renderer, an activatable `+n more`, axis label policy, and the
 * `firstDay` / `hiddenDays` date derivation seen through the DOM.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** @param {import("@playwright/test").Page} page */
const readLog = (page) => page.evaluate(() => /** @type {any} */ (window).__log ?? []);

/**
 * Collects `calendar:loading` states, which are plain booleans.
 *
 * @param {import("@playwright/test").Page} page
 */
function recordLoading(page) {
  return page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__log = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:loading",
      (/** @type {Event} */ event) => hooks.__log.push(/** @type {CustomEvent} */ (event).detail.loading),
    );
  });
}

test("an async source brackets itself with calendar:loading", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await recordLoading(page);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({
      eventSource: () => new Promise((resolve) => window.setTimeout(() => resolve([]), 150)),
    });
  });
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).refetchEvents());
  await expect.poll(() => readLog(page)).toEqual([true, false]);
  // aria-busy and the event settle together.
  await expect(page.locator("calendar-view")).not.toHaveAttribute("aria-busy", "true");
});

test("a superseded request never reports itself as settled", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await recordLoading(page);
  await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      eventSource: () => new Promise((resolve) => window.setTimeout(() => resolve([]), 120)),
    });
    // Two overlapping fetches: the first is aborted, so only the second one
    // is allowed to flip the busy state back off.
    void calendar.refetchEvents();
    await calendar.refetchEvents();
  });
  await expect.poll(() => readLog(page)).toEqual([true, true, false]);
});

test("calendar:render fires once the subtree exists", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await flushRender(page);
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__log = [];
    /** @type {any} */ (document.querySelector("calendar-view")).addEventListener(
      "calendar:render",
      (/** @type {Event} */ event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        hooks.__log.push({
          view: detail.view,
          dates: detail.dates.map(String),
          // Counted from the document: the subtree must already be attached.
          columns: document.querySelectorAll(".cv-day").length,
        });
      },
    );
  });
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("day"));
  await flushRender(page);
  const log = await readLog(page);
  expect(log.at(-1)).toEqual({ view: "day", dates: ["2026-09-03"], columns: 1 });
});

test("classNames reach the month and list renderers too", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).events = [
      {
        id: "tagged",
        title: "Tagged",
        classNames: ["is-tagged"],
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  await expect(page.locator(".cv-event.is-tagged")).toHaveCount(1);

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await flushRender(page);
  await expect(page.locator(".cv-month-event.is-tagged")).toHaveCount(1);

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("list"));
  await flushRender(page);
  await expect(page.locator(".cv-list-event.is-tagged")).toHaveCount(1);
});

test("+n more is activatable and reports its day instead of proposing a creation", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__log = [];
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
    calendar.addEventListener("calendar:moreclick", (/** @type {Event} */ event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      hooks.__log.push({
        intent: "more",
        date: String(detail.date),
        hidden: detail.hidden,
        total: detail.events.length,
      });
    });
    // A create intent here would mean the button fell through to its cell.
    calendar.addEventListener("calendar:select", () => hooks.__log.push({ intent: "select" }));
    calendar.setView("month");
  });
  await flushRender(page);

  const more = page.locator('[data-date="2026-09-03"] .cv-month-more');
  await expect(more).toHaveJSProperty("tagName", "BUTTON");
  await expect(more).toHaveAttribute("data-date", "2026-09-03");
  await more.click();
  await expect
    .poll(() => readLog(page))
    .toEqual([{ intent: "more", date: "2026-09-03", hidden: 2, total: 5 }]);

  // Keyboard activation goes through the same path.
  await more.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => readLog(page)).toHaveLength(2);
});

test("moreLinkContent owns the label", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = Array.from({ length: 6 }, (_, index) => ({
      id: `busy-${index}`,
      title: `Busy ${index}`,
      start: `2026-09-03T${String(8 + index).padStart(2, "0")}:00:00+02:00[Europe/Brussels]`,
      end: `2026-09-03T${String(8 + index).padStart(2, "0")}:30:00+02:00[Europe/Brussels]`,
    }));
    calendar.configure({ moreLinkContent: (/** @type {any} */ info) => `${info.hidden} hidden` });
    calendar.setView("month");
  });
  await flushRender(page);
  await expect(page.locator('[data-date="2026-09-03"] .cv-month-more')).toHaveText("3 hidden");
});

test("slotLabelInterval sets axis density and slotLabelContent its text", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await flushRender(page);
  // 08:00 to 18:00 inclusive, formatted for the document locale.
  await expect(page.locator(".cv-axis-label")).toHaveCount(11);
  await expect(page.locator(".cv-axis-label").first()).toHaveText("8:00 AM");

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ slotLabelInterval: 30 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-axis-label")).toHaveCount(21);
  await expect(page.locator(".cv-axis-label").nth(1)).toHaveText("8:30 AM");

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({
      slotLabelInterval: 60,
      slotLabelContent: (/** @type {any} */ info) => `${info.time.hour}h`,
    });
  });
  await flushRender(page);
  await expect(page.locator(".cv-axis-label").first()).toHaveText("8h");
});

test("week is anchored on the civil week and firstDay moves it", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("week"));
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(7);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-08-31");
  // The anchor attribute keeps the day the application asked for.
  await expect(page.locator("calendar-view")).toHaveAttribute("date", "2026-09-03");

  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ firstDay: 7 });
  });
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-08-30");
});

test("hiddenDays drops columns in week, month and rolling views", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ hiddenDays: [6, 7] });
    calendar.setView("week");
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(5);
  await expect(page.locator(".cv-day").last()).toHaveAttribute("data-date", "2026-09-04");

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).setView("month"));
  await flushRender(page);
  await expect(page.locator(".cv-month-weekday")).toHaveCount(5);
  await expect(page.locator(".cv-month-day")).toHaveCount(25);

  // A rolling view keeps its day count and spans further instead.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.setView("threeDays");
    calendar.gotoDate("2026-09-04");
  });
  await flushRender(page);
  await expect(page.locator(".cv-day")).toHaveCount(3);
  await expect(page.locator(".cv-day").nth(1)).toHaveAttribute("data-date", "2026-09-07");
});

test("navigation with hidden days neither repeats nor skips a working day", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({ hiddenDays: [6, 7] });
    calendar.gotoDate("2026-09-04");
  });
  await flushRender(page);
  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).next());
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-09");

  await page.evaluate(() => /** @type {any} */ (document.querySelector("calendar-view")).prev());
  await flushRender(page);
  await expect(page.locator(".cv-day").first()).toHaveAttribute("data-date", "2026-09-04");
});

test("a source asked for a month still receives whole weeks when days are hidden", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      hiddenDays: [7],
      eventSource: (/** @type {any} */ query) => {
        hooks.__range = { start: query.start.toString(), end: query.end.toString() };
        return Promise.resolve([]);
      },
    });
    calendar.setView("month");
  });
  await expect
    .poll(() => page.evaluate(() => /** @type {any} */ (window).__range))
    .toEqual({ start: "2026-08-31", end: "2026-10-05" });
});

test("configure({ editable: false }) locks events that omit the flag", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await expect(page.locator(".cv-resize-handle")).toHaveCount(6);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).configure({ editable: false });
  });
  await flushRender(page);
  // Read-only is a render decision too: no resize handle is armed any more.
  await expect(page.locator(".cv-resize-handle")).toHaveCount(0);
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const item = calendar.getEventById("a");
    const moved = calendar.moveEvent("a", {
      start: String(item.start).replace("T09:", "T11:"),
      end: String(item.end).replace("T10:", "T12:"),
    });
    const resized = calendar.resizeEvent("a", { end: String(item.end).replace("T10:", "T11:") });
    // An explicit event flag still outranks the calendar default.
    calendar.updateEvent({ ...calendar.getEventById("b"), editable: true });
    const optedIn = calendar.moveEvent("b", {
      start: String(calendar.getEventById("b").start).replace("T13:", "T15:"),
      end: String(calendar.getEventById("b").end).replace("T14:", "T16:"),
    });
    return {
      moved,
      resized,
      optedIn: optedIn !== null,
      start: String(calendar.getEventById("a").start),
    };
  });
  expect(outcome.moved).toBeNull();
  expect(outcome.resized).toBeNull();
  expect(outcome.optedIn).toBe(true);
  expect(outcome.start).toContain("T09:00");
});

test("a background refetch keeps the events added while it was in flight", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      backgroundSource: () =>
        new Promise((resolve) =>
          window.setTimeout(
            () =>
              resolve([
                {
                  id: "bg-late",
                  start: "2026-09-04T08:00:00+02:00[Europe/Brussels]",
                  end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
                },
              ]),
            120,
          ),
        ),
    });
    const pending = calendar.refetchEvents();
    // Incremental mutations do not wait for a source that does not own them.
    calendar.addEvent({
      id: "mid-flight",
      title: "Added mid-flight",
      start: "2026-09-03T15:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T16:00:00+02:00[Europe/Brussels]",
    });
    await pending;
    return {
      events: calendar.events.map((/** @type {any} */ event) => event.id),
      backgrounds: calendar.backgrounds.map((/** @type {any} */ background) => background.id),
    };
  });
  expect(outcome.events).toEqual(["a", "b", "c", "mid-flight"]);
  expect(outcome.backgrounds).toEqual(["bg-late"]);
});

test("an event refetch keeps the backgrounds set while it was in flight", async ({ page }) => {
  await page.goto("/demo/basic.html");
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.configure({
      eventSource: () =>
        new Promise((resolve) =>
          window.setTimeout(
            () =>
              resolve([
                {
                  id: "from-source",
                  title: "From source",
                  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
                  end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
                },
              ]),
            120,
          ),
        ),
    });
    const pending = calendar.refetchEvents();
    calendar.backgrounds = [
      ...calendar.backgrounds,
      {
        id: "bg-mid-flight",
        start: "2026-09-04T08:00:00+02:00[Europe/Brussels]",
        end: "2026-09-04T09:00:00+02:00[Europe/Brussels]",
      },
    ];
    await pending;
    return {
      events: calendar.events.map((/** @type {any} */ event) => event.id),
      backgrounds: calendar.backgrounds.map((/** @type {any} */ background) => background.id),
    };
  });
  expect(outcome.events).toEqual(["from-source"]);
  expect(outcome.backgrounds).toEqual(["bg", "bg-mid-flight"]);
});

test("an unconfigured calendar renders in UTC, not in a product zone", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await page.evaluate(() => {
    const fresh = document.createElement("calendar-view");
    fresh.id = "neutral";
    fresh.setAttribute("view", "day");
    fresh.setAttribute("date", "2026-09-03");
    fresh.setAttribute("slot-min", "00:00");
    fresh.setAttribute("slot-max", "23:59");
    document.body.append(fresh);
    /** @type {any} */ (fresh).events = [
      {
        id: "n",
        title: "Neutral",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
      },
    ];
  });
  await flushRender(page);
  await flushRender(page);
  // 09:00 Brussels is 07:00 UTC: the neutral default converts at paint time.
  await expect(page.locator('#neutral [data-event-id="n"]')).toHaveAttribute(
    "aria-label",
    "Neutral, 2026-09-03, 07:00 to 07:30",
  );
  await page.evaluate(() => document.querySelector("#neutral")?.remove());
});
