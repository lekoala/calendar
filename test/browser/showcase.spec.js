import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import {
  anchorDate,
  closePanel,
  emptyDayFrom,
  flushRender,
  gotoDate,
  openDayFrom,
  openPanel,
  scrollToMorning,
  setView,
  weekdayFrom,
} from "../support/showcase-helpers.js";

/**
 * Showcase shell, core contracts only: what the element promises an
 * application that drives it. The chrome this shell builds around the grid -
 * mini-month, palette, tools shelf, responsive panel - is exercised by
 * `test/shell/showcase-chrome.spec.js`, which runs on demand.
 */

test("showcase renders seeded team events with kind cards", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const count = await page.locator(".cv-event").count();
  expect(count).toBeGreaterThan(5);
  await expect(page.locator('.cv-event[data-kind="review"]').first()).toBeVisible();
  await expect(page.locator(".sc-card strong").first()).not.toBeEmpty();
});
test("the classic-script build serves the shell over file://", async ({ page }) => {
  // The showcase loads `../dist/calendar.js` and reaches the month math
  // through element statics — no local ESM import, so it opens from disk.
  const fileUrl = pathToFileURL(fileURLToPath(new URL("../../demo/showcase.html", import.meta.url))).href;
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(fileUrl);
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator(".sc-mini-day")).toHaveCount(42);
  expect(errors).toHaveLength(0);
});
test("clicking an event opens the app-owned detail sheet", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await page.locator(".cv-event").first().click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-title")).not.toBeEmpty();
  await expect(page.locator("#cockpit .sc-last")).toContainText("eventclick");
});
test("the seeded all-day closure lives in the lane and opens the detail sheet", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);
  const bar = page.locator(".cv-allday-event[data-event-id='seed-all-day']");
  await expect(bar).toContainText("Atrium closure");
  // Seeded from the anchor across three civil days, end exclusive.
  const anchor = await anchorDate(page);
  await expect(bar).toHaveAttribute(
    "aria-label",
    `Atrium closure, ${anchor} to ${anchor.add({ days: 2 })}, all day`,
  );
  // Timed bookings stay in the bodies; the lane bar never leaks down there.
  await expect(page.locator(".cv-day-body .cv-allday-event")).toHaveCount(0);
  await bar.click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-title")).toHaveText("Atrium closure");
  await expect(page.locator("#detail-meta")).toContainText("all day");
});
test("the tools shelf hides and restores the all-day lane", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);
  await closePanel(page);

  // `allDaySlot: false` is a display choice: the lane goes, the closure does
  // not - it comes back with the lane, and it never leaks into the bodies.
  await page.click("#tools-toggle");
  await page.click('#grid-menu [data-grid="allday"]');
  await flushRender(page);
  await expect(page.locator('#grid-menu [data-grid="allday"]')).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".cv-allday")).toHaveCount(0);
  await expect(page.locator(".cv-day-body .cv-allday-event")).toHaveCount(0);

  await page.click('#grid-menu [data-grid="allday"]');
  await flushRender(page);
  await expect(page.locator(".cv-allday-event[data-event-id='seed-all-day']")).toBeVisible();
});
test("the shell reports the source lifecycle while a slow source runs", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#tools-toggle");
  await page.click('#source-menu [data-source="slow"]');
  await expect(page.locator("#shell")).toHaveAttribute("data-busy", "true");
  await expect(page.locator("#cockpit")).toContainText("Loading");
  await expect(page.locator("#shell")).toHaveAttribute("data-busy", "false");
  await expect(page.locator("#cockpit")).toContainText("bookings in view");
  await expect(page.locator('#source-menu [data-source="slow"]')).toHaveAttribute("aria-checked", "true");
});
test("a failing source is reported without clearing the grid", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#tools-toggle");
  await page.click('#source-menu [data-source="failing"]');
  await expect(page.locator("#toast")).toContainText("The event source failed");
  await expect(page.locator(".cv-event").first()).toBeVisible();
});
test("month +n more opens the day it belongs to", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "month");
  const more = page.locator(".cv-month-more").first();
  const date = await more.getAttribute("data-date");
  await more.click();
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", /** @type {string} */ (date));
  await expect(page.locator("#view-label")).toHaveText("Day");
});
test("realtime stand-in adds an event with an aura, without navigation", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  const before = await page.locator(".cv-event").count();
  await page.click("#tools-toggle");
  await page.click("#rt-add");
  await flushRender(page);
  await expect(page.locator(".cv-event")).toHaveCount(before + 1);
  await expect(page.locator('.cv-event[data-fresh="true"]')).toHaveCount(1);
  await expect(page.locator("#cockpit .sc-last")).toContainText("realtime add");
});
test("the application refuses a move that breaks its own booking rules", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // `calendar:eventmove` is cancelable: a synchronous preventDefault() makes
  // the core revert its own optimistic change.
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const before = String(calendar.getEventById("live").start);
    // 21:00 is past closing on every weekday and outside every extended desk
    // window, so the refusal never depends on which day the shell opened on.
    const returned = calendar.moveEvent("live", {
      start: before.replace(/T\d\d:/, "T21:"),
      end: String(calendar.getEventById("live").end).replace(/T\d\d:/, "T21:"),
    });
    return { before, returned, after: String(calendar.getEventById("live").start) };
  });
  expect(outcome.returned).toBeNull();
  expect(outcome.after).toBe(outcome.before);
  await expect(page.locator("#toast")).toContainText("Bookings stay inside 08:00–18:00");
  await expect(page.locator("#cockpit .sc-last")).toContainText("refused");
});
test("a non-bookable range refuses the drop it is drawn over", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceThreeDays");
  // The rule is visible before it is enforced: the hatched background and
  // the refusal come from the same application constant.
  await expect(page.locator(".cv-background.sc-blocked").first()).toBeVisible();
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const before = String(calendar.getEventById("live").start);
    const returned = calendar.moveEvent("live", {
      start: before.replace(/T\d\d:\d\d/, "T12:15"),
      end: before.replace(/T\d\d:\d\d/, "T12:45"),
      resourceId: "room-c",
    });
    return { returned, after: String(calendar.getEventById("live").start), before };
  });
  expect(outcome.returned).toBeNull();
  expect(outcome.after).toBe(outcome.before);
  await expect(page.locator("#toast")).toContainText("Daily reset");
});
test("bookable hours paint green with an amber late desk", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // The shell opens on a single day below 640px; pin the 3-day resource
  // view so the band counts are portable across viewports.
  await setView(page, "resourceThreeDays");
  // Pinned to a Thursday, the rolling window is Thu/Fri/Sat whatever day the
  // shell opened on: two open days across three rooms, Saturday fully closed,
  // and the room-b late desk is the single extended window in view.
  await gotoDate(page, weekdayFrom(await anchorDate(page), 4));
  await expect(page.locator(".cv-background.sc-open")).toHaveCount(6);
  // room-b Thursday 18:00-20:00 at 1.5px/min from a 07:00 slot start.
  const extra = page.locator(".cv-background.sc-extra");
  await expect(extra).toHaveCount(1);
  const style = await extra.getAttribute("style");
  expect(style).toContain("top: 990px");
  expect(style).toContain("height: 180px");
});
test("an extended desk window accepts the drop official hours refuse", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // The late desk is a weekly rule, so the target is the next Thursday. The
  // zone annotation carries the whole answer: writing an offset by hand would
  // be wrong for half the year.
  const thursday = weekdayFrom(await anchorDate(page), 4);
  const outcome = await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const returned = calendar.moveEvent("live", {
      start: `${day}T18:00:00[Europe/Brussels]`,
      end: `${day}T18:30:00[Europe/Brussels]`,
      resourceId: "room-b",
    });
    return { accepted: returned !== null, start: String(calendar.getEventById("live").start) };
  }, thursday.toString());
  expect(outcome.accepted).toBe(true);
  expect(outcome.start).toContain(`${thursday}T18:00:00`);
  // Outside every window the guard still refuses.
  const refused = await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.moveEvent("live", {
      start: `${day}T21:00:00[Europe/Brussels]`,
      end: `${day}T21:30:00[Europe/Brussels]`,
      resourceId: "room-b",
    });
  }, thursday.toString());
  expect(refused).toBeNull();
});
test("an accepted move can still be reverted after the round-trip", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // The asynchronous half of the same contract: `detail.revert()` is
  // idempotent and may be called long after the dispatch returned.
  const outcome = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const item = calendar.getEventById("seed-overlap");
    const before = String(item.start);
    const returned = calendar.moveEvent("seed-overlap", {
      start: before.replace(/T\d\d:\d\d/, "T14:00"),
      end: String(item.end).replace(/T\d\d:\d\d/, "T15:00"),
    });
    const optimistic = String(calendar.getEventById("seed-overlap").start);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      accepted: returned !== null,
      optimistic,
      after: String(calendar.getEventById("seed-overlap").start),
      before,
    };
  });
  expect(outcome.accepted).toBe(true);
  expect(outcome.optimistic).toContain("T14:00");
  expect(outcome.after).toBe(outcome.before);
  await expect(page.locator("#toast")).toContainText("did not confirm");
});
test("the context menu is placed from the coordinates the core reports", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const card = page.locator('.cv-event[data-kind="maintenance"]').first();
  const box = await card.boundingBox();
  await card.click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  // Locked bookings expose the read-only rule instead of hiding the menu.
  await expect(page.locator('#context-menu [role="menuitem"]:has-text("Move +1h")')).toBeDisabled();
  await expect(page.locator('#context-menu [role="menuitem"]:has-text("Delete")')).toBeDisabled();
  const menu = await page.locator("#context-menu").boundingBox();
  expect(menu).not.toBeNull();
  expect(box).not.toBeNull();
  // Placement, not guesswork: the menu stays inside the viewport and next
  // to the point that was clicked.
  const viewport = page.viewportSize();
  expect(menu?.x).toBeGreaterThanOrEqual(0);
  expect(menu?.y).toBeGreaterThanOrEqual(0);
  expect((menu?.x ?? 0) + (menu?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect((menu?.y ?? 0) + (menu?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#context-menu")).toBeHidden();
});
test("the empty-slot context menu proposes a real range", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceDay");
  // Backgrounds are `pointer-events: none`, so the first hit on a free slot
  // is the day body itself: that is the empty-slot intent.
  const point = await page.evaluate(() => {
    const scroller = document.querySelector(".cv-scroller");
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    for (let y = rect.bottom - 10; y > rect.top + 80; y -= 12) {
      for (let x = rect.left + 80; x < rect.right - 20; x += 40) {
        const node = document.elementFromPoint(x, y);
        if (node instanceof Element && node.classList.contains("cv-day-body")) return { x, y };
      }
    }
    return null;
  });
  expect(point).not.toBeNull();
  await page.mouse.move(point?.x ?? 0, point?.y ?? 0);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await expect(page.locator("#context-menu")).toContainText("Book 30 minutes here");
  await expect(page.locator("#context-menu")).toContainText("Block this hour");
});
test("grid options travel through configure(), not through the toolbar", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await setView(page, "week");
  const withoutSunday = await page.locator(".cv-day").count();
  await page.click("#tools-toggle");
  await page.click('#grid-menu [data-grid="sunday"]');
  await flushRender(page);
  await expect(page.locator('#grid-menu [data-grid="sunday"]')).toHaveAttribute("aria-checked", "false");
  expect(await page.locator(".cv-day").count()).toBe(withoutSunday + 1);

  const hourly = await page.locator(".cv-axis-label").count();
  await page.click('#grid-menu [data-grid="halfhour"]');
  await flushRender(page);
  expect(await page.locator(".cv-axis-label").count()).toBeGreaterThan(hourly);
});
test("the locale switch drives the core labels and the shell's own dates", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  // The page declares `lang="en"`, and the shell resolves its locale the way
  // the core documents, so the chrome and the grid start out agreeing.
  await expect(page.locator("#anchor-sub")).toContainText("en");
  await expect(page.locator(".cv-scroller")).toHaveAttribute("aria-label", "Calendar");

  await page.click("#account-toggle");
  await page.click('#locale-chips [data-locale="fr"]');
  await flushRender(page);
  // One `configure()` call carries both halves: `labels` for the strings the
  // core writes itself, `locale` for everything `Intl` formats.
  await expect(page.locator(".cv-scroller")).toHaveAttribute("aria-label", "Calendrier");
  await expect(page.locator("#mini-month")).toHaveValue("9");
  const monthLabel = await page.evaluate(() => {
    const select = /** @type {any} */ (document.getElementById("mini-month"));
    return select.options[select.selectedIndex]?.text ?? "";
  });
  expect(monthLabel).toMatch(/septembre/);
  await expect(page.locator("#anchor-sub")).toContainText("fr");
  await page.keyboard.press("Escape");

  await setView(page, "month");
  await expect(page.locator(".cv-month-more").first()).toContainText("en plus");
  await expect(page.locator(".cv-month-weekday").first()).toHaveText(/lun/);

  await page.click("#account-toggle");
  await page.click('#locale-chips [data-locale="nl"]');
  await flushRender(page);
  await expect(page.locator(".cv-month-more").first()).toContainText("meer");
  await expect(page.locator(".cv-scroller")).toHaveAttribute("aria-label", "Agenda");
});
test("an explicit firstDay wins over the locale, and dropping it hands the choice back", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await setView(page, "month");
  await page.click("#account-toggle");
  await page.click('#locale-chips [data-locale="en-US"]');
  await flushRender(page);
  await page.keyboard.press("Escape");
  // `en-US` suggests Sunday, but this shell pins Monday.
  await expect(page.locator(".cv-month-weekday").first()).toHaveText(/Mon/);

  await page.click("#tools-toggle");
  // Sundays have to exist before the week start can be seen at all.
  await page.click('#grid-menu [data-grid="sunday"]');
  await flushRender(page);
  await page.click('#grid-menu [data-grid="monday"]');
  await flushRender(page);
  await expect(page.locator(".cv-month-weekday").first()).toHaveText(/Sun/);
  await expect(page.locator(".cv-month-weekday")).toHaveCount(7);
});
test("cut parks the booking in the workbench and Escape disarms it", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await node.getAttribute("data-event-id");
  await node.click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  // The queue is the state: the event shows in the sidebar, parked and armed,
  // and stays in place in the grid as a muted "waiting" card.
  await expect(page.locator("#workbench-panel")).toBeVisible();
  await expect(page.locator("#workbench-list button[aria-current='true']")).toHaveAttribute(
    "data-event-id",
    String(id),
  );
  await expect(page.locator(`.cv-event[data-event-id="${id}"][data-parked="true"]`)).toBeVisible();
  // Escape disarms the active item without removing it from the queue.
  await page.keyboard.press("Escape");
  await expect(page.locator("#workbench-list button[aria-current='true']")).toHaveCount(0);
  await expect(page.locator(`.cv-event[data-event-id="${id}"]`)).toHaveAttribute("data-parked", "true");
  // Empty clears the queue; the parked look goes with it.
  await page.locator("#workbench-clear").click();
  await expect(page.locator("#workbench-panel")).toBeHidden();
  await expect(page.locator(`.cv-event[data-event-id="${id}"][data-parked="true"]`)).toHaveCount(0);
});
test("replanning the current day queues its bookings, which survive navigation", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // Replanning only says something on a working day, so pin the range to the
  // first one the fixture opens on.
  const anchor = await anchorDate(page);
  await gotoDate(page, openDayFrom(anchor));
  await openPanel(page);
  await page.click("#tools-toggle");
  await page.click('[data-tool="reschedule-day"]');
  const queued = await page.locator("#workbench-list li").count();
  // A seeded working day holds a dozen+ bookings, all queued in one beat.
  expect(queued).toBeGreaterThan(3);
  // Bulk fill arms nothing: an item only gets armed when cut or clicked.
  await expect(page.locator("#workbench-list button[aria-current='true']")).toHaveCount(0);
  // Navigation and re-renders must not lose the queue: it is application
  // state, rendered off its own `change` beat.
  await gotoDate(page, openDayFrom(anchor).add({ days: 21 }));
  await expect(page.locator("#workbench-list li")).toHaveCount(queued);
});
test("dragging a workbench row onto the grid places it and advances the queue", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // A free target, found rather than assumed: the fixture thins out with
  // distance instead of stopping, so no fixed offset is reliably empty.
  const empty = await emptyDayFrom(page, (await anchorDate(page)).add({ days: 21 }));
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await node.getAttribute("data-event-id");
  await node.click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  const node2 = page.locator('.cv-event[data-kind="planning"]').nth(1);
  const id2 = await node2.getAttribute("data-event-id");
  await node2.click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await expect(page.locator("#workbench-list li")).toHaveCount(2);
  // The last cut is armed; auto-advance will hand on to the first one.
  await expect(page.locator("#workbench-list button[aria-current='true']")).toHaveAttribute(
    "data-event-id",
    String(id2),
  );

  await gotoDate(page, empty);
  await scrollToMorning(page);

  const target = await page.evaluate(() => {
    const body = document.querySelector(".cv-day-body");
    const rect = /** @type {HTMLElement} */ (body).getBoundingClientRect();
    const ten = [...document.querySelectorAll(".cv-axis-label")].find((label) =>
      label.textContent?.trim().startsWith("10"),
    );
    return { x: rect.left + rect.width / 2, y: (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12 };
  });
  const outcome = await page.evaluate(
    async ({ eventId, x, y }) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const row = /** @type {HTMLElement} */ (
        document.querySelector(`#workbench-list button[data-event-id="${eventId}"]`)
      );
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
      root.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      );
      const ghostInvalid =
        document.querySelector(".cv-external-ghost")?.classList.contains("cv-invalid") ?? false;
      root.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        start: String(calendar.getEventById(eventId).start),
        ghostInvalid,
        rows: document.querySelectorAll("#workbench-list li").length,
        active:
          /** @type {HTMLElement | null} */ (
            document.querySelector("#workbench-list button[aria-current='true']")
          )?.dataset.eventId ?? null,
      };
    },
    { eventId: String(id2), x: target.x, y: target.y },
  );

  // The target was policy-clean (no ghost red), the booking moved, left the
  // queue, and the next pending one was armed in the same beat.
  expect(outcome.ghostInvalid).toBe(false);
  expect(outcome.start).toContain(`${empty}T10:00`);
  expect(outcome.rows).toBe(1);
  expect(outcome.active).toBe(String(id));
});
test("pasting the armed item places it, and an occupied slot keeps it", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const anchor = await anchorDate(page);
  // A free target, found rather than assumed (see above).
  const empty = await emptyDayFrom(page, anchor.add({ days: 21 }));
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await node.getAttribute("data-event-id");
  await node.click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await expect(page.locator("#workbench-list li")).toHaveCount(1);

  await gotoDate(page, empty);
  await scrollToMorning(page);
  const point = await page.evaluate(() => {
    const body = document.querySelector(".cv-day-body");
    const rect = /** @type {HTMLElement} */ (body).getBoundingClientRect();
    const ten = [...document.querySelectorAll(".cv-axis-label")].find((label) =>
      label.textContent?.trim().startsWith("10"),
    );
    return { x: rect.left + rect.width / 2, y: (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12 };
  });
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: /Paste/ }).click();
  await flushRender(page);

  const start = await page.evaluate(
    (eventId) =>
      String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById(eventId).start),
    String(id),
  );
  expect(start).toContain(`${empty}T10:00`);
  await expect(page.locator("#workbench-list li")).toHaveCount(0);

  // A refused placement keeps the item: back on the seeded range, drag an
  // armed booking onto a slot another visible booking already holds. The app
  // policy marks the ghost invalid and the drop is silent. The seeded overlap
  // is the deterministic occupant: mid-morning in room A on the first opening
  // day, so it is neither closed, blocked nor off-screen.
  await gotoDate(page, openDayFrom(anchor));
  const moved = page.locator('.cv-event[data-kind="planning"]').first();
  const movedId = await moved.getAttribute("data-event-id");
  await moved.click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await expect(page.locator("#workbench-list li")).toHaveCount(1);
  const occupant = page.locator('.cv-event[data-event-id="seed-overlap"]');
  await occupant.scrollIntoViewIfNeeded();
  const occupied = await occupant.boundingBox();
  expect(occupied).not.toBeNull();

  const refused = await page.evaluate(
    async ({ eventId, x, y }) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const row = /** @type {HTMLElement} */ (
        document.querySelector(`#workbench-list button[data-event-id="${eventId}"]`)
      );
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
      root.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      );
      const ghostInvalid =
        document.querySelector(".cv-external-ghost")?.classList.contains("cv-invalid") ?? false;
      const reason = document.querySelector(".cv-external-ghost")?.getAttribute("data-reason") ?? null;
      root.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        ghostInvalid,
        reason,
        rows: document.querySelectorAll("#workbench-list li").length,
        start: String(calendar.getEventById(eventId).start),
      };
    },
    {
      eventId: String(movedId),
      x: (occupied?.x ?? 0) + (occupied?.width ?? 0) / 2,
      y: (occupied?.y ?? 0) + (occupied?.height ?? 0) / 2,
    },
  );
  expect(refused.ghostInvalid).toBe(true);
  expect(refused.reason).toContain("already occupies");
  expect(refused.rows).toBe(1);
  expect(refused.start).not.toContain(String(empty));
  await page.keyboard.press("Escape");
});
test("an armed placement previews its target until pasted or cleared", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const anchor = await anchorDate(page);
  const empty = await emptyDayFrom(page, anchor.add({ days: 21 }));
  // Park a timed booking: it is armed, so a later empty-slot target previews
  // at the real duration once the context menu closes (the keyboard target
  // was invisible before M15).
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  await node.click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await expect(page.locator("#workbench-list li")).toHaveCount(1);

  await gotoDate(page, empty);
  await scrollToMorning(page);
  const point = await page.evaluate(() => {
    const body = document.querySelector(".cv-day-body");
    const rect = /** @type {HTMLElement} */ (body).getBoundingClientRect();
    const ten = [...document.querySelectorAll(".cv-axis-label")].find((label) =>
      label.textContent?.trim().startsWith("10"),
    );
    return { x: rect.left + rect.width / 2, y: (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12 };
  });
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  // The preview stays while the menu is open and after light-dismiss closes it
  // (Escape disarms instead), so `Ctrl+V` no longer acts on an invisible
  // destination. Clicking the inert anchor label only light-dismisses.
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  await page.locator("#anchor-label").click();
  await expect(page.locator("#context-menu")).toBeHidden();
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);

  // Disarming with Escape clears the target and the preview with it.
  await page.keyboard.press("Escape");
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
});
test("the placement preview tracks the active payload, not the last click", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const anchor = await anchorDate(page);
  const empty = await emptyDayFrom(page, anchor.add({ days: 21 }));
  await gotoDate(page, empty);
  await scrollToMorning(page);
  // Two injected bookings with known durations: the preview must show the
  // payload that would act *now* — clipboard first, then the armed item
  // winning over it — at the same 10:00 target.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date.toString();
    calendar.addEvent({
      id: "ev-copy",
      title: "30 min",
      resourceId: "room-a",
      start: `${day}T09:00:00[Europe/Brussels]`,
      end: `${day}T09:30:00[Europe/Brussels]`,
    });
    calendar.addEvent({
      id: "ev-arm",
      title: "120 min",
      resourceId: "room-a",
      start: `${day}T13:00:00[Europe/Brussels]`,
      end: `${day}T15:00:00[Europe/Brussels]`,
    });
  });
  await flushRender(page);

  const point = await page.evaluate(() => {
    const body = document.querySelector(".cv-day-body");
    const rect = /** @type {HTMLElement} */ (body).getBoundingClientRect();
    const ten = [...document.querySelectorAll(".cv-axis-label")].find((label) =>
      label.textContent?.trim().startsWith("10"),
    );
    return { x: rect.left + rect.width / 2, y: (ten?.getBoundingClientRect().y ?? rect.top + 220) + 12 };
  });

  const previewHeight = () =>
    page.evaluate(() => /** @type {any} */ (document.querySelector(".cv-preview"))?.style.height ?? null);

  // A target with no payload paints nothing: nothing would happen on Ctrl+V.
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await expect(page.locator(".cv-preview")).toHaveCount(0);
  await page.locator("#anchor-label").click();
  await expect(page.locator("#context-menu")).toBeHidden();

  // Copying a 30-minute booking previews 30 minutes at the target.
  await page.locator('[data-event-id="ev-copy"]').click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Copy" }).click();
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  expect(await previewHeight()).toBe("45px");

  // Arming a 120-minute booking swaps the preview, same target.
  await page.locator('[data-event-id="ev-arm"]').click({ button: "right" });
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(1);
  expect(await previewHeight()).toBe("180px");
  await page.keyboard.press("Escape");
  await flushRender(page);
  await expect(page.locator(".cv-preview")).toHaveCount(0);
});
test("dragging a booking out of the grid parks it, glows the zone and opens no modal", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const card = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await card.getAttribute("data-event-id");
  // The first planning card of the day can sit well below the fold; grabbing
  // it by a stale box would press on whatever is at those coordinates.
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  // The axis strip is outside every column, and unlike a fixed upward sweep
  // it stays on screen whatever hour the booking sits at: column bodies keep
  // their full height, so a point above the scroller can still be inside one.
  const axisX = await page.evaluate(() => {
    const axis = /** @type {HTMLElement} */ (document.querySelector(".cv-axis"));
    const rect = axis.getBoundingClientRect();
    return rect.left + rect.width / 2;
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  // While the pointer is outside every column the core arms `data-dropout` on
  // the dragged card and the shell lights the workbench panel as the target.
  await page.mouse.move(axisX, y, { steps: 6 });
  await expect(page.locator(`.cv-event[data-event-id="${id}"]:not(.cv-drag-mirror)`)).toHaveAttribute(
    "data-dropout",
    "true",
  );
  const glow = await page.evaluate(
    () =>
      getComputedStyle(/** @type {HTMLElement} */ (document.getElementById("workbench-panel"))).outlineWidth,
  );
  expect(glow).not.toBe("0px");
  await page.mouse.up();
  await flushRender(page);
  // The residual click is suppressed: no detail dialog, the event is parked.
  await expect(page.locator("#detail-dialog")).toBeHidden();
  await expect(page.locator(`#workbench-list [data-event-id="${id}"]`)).toBeVisible();
  await expect(page.locator(`.cv-event[data-event-id="${id}"]:not(.cv-drag-mirror)`)).not.toHaveAttribute(
    "data-dropout",
    "true",
  );
});
test("a blocked-range slot queues the bookings it overlaps", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // Room C holds a daily 12:00-13:00 "Daily reset" block; expect the same
  // overlap set the application's per-event preflight will queue.
  const expected = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date.toString();
    return calendar.getEventOverlaps({
      start: `${day}T12:00:00[Europe/Brussels]`,
      end: `${day}T13:00:00[Europe/Brussels]`,
    }).length;
  });
  // Drive the empty-slot handler directly with a time inside the block, so
  // the geometry of a hatched cell never decides the outcome.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date.toString();
    calendar.dispatchEvent(
      new CustomEvent("calendar:eventcontextmenu", {
        bubbles: true,
        composed: true,
        detail: {
          event: null,
          date: day,
          time: `${day}T12:20:00[Europe/Brussels]`,
          resourceId: null,
          clientX: 0,
          clientY: 0,
        },
      }),
    );
  });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page
    .locator("#context-menu")
    .getByRole("menuitem", { name: /affected by this block/i })
    .click();
  await flushRender(page);
  await expect(page.locator("#workbench-list li")).toHaveCount(expected);
});
test("right-clicking a day header queues that day's bookings", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // The default resource view's first day header belongs to room A and the
  // first rendered day, so the action is scoped to that resource's day.
  await page.locator(".cv-day-header").first().click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page
    .locator("#context-menu")
    .getByRole("menuitem", { name: /Replanify this day/i })
    .click();
  await flushRender(page);
  await expect(page.locator("#workbench-panel")).toBeVisible();
  const expected = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const resourceId = calendar.resources[0].id;
    // The first column, not the anchor: a hidden Sunday is never rendered.
    const day = calendar.getVisibleRange().start.toString();
    return /** @type {Array<{ resourceId: unknown, start: unknown }>} */ (calendar.events).filter(
      (event) => event.resourceId === resourceId && String(event.start).slice(0, 10) === day,
    ).length;
  });
  await expect(page.locator("#workbench-list li")).toHaveCount(expected);
});

/**
 * M13 in the shell: `violation()` used to answer only once the drop had
 * committed - the booking was accepted, snapped back, and explained by a
 * toast. As an interaction policy the same function answers while the
 * pointer is still down, so these tests assert the refusal is visible
 * *during* the gesture and that nothing ever commits.
 */

/**
 * The painted blocker's canonical range, the room it belongs to and the
 * label the shell gave it. All of it is read rather than assumed: which
 * room's non-bookable range is on screen depends on the weekday the suite
 * runs on.
 *
 * @param {import("@playwright/test").Page} page
 */
async function describeBlocker(page) {
  const node = page.locator(".cv-background.sc-blocked").first();
  await expect(node).toBeVisible();
  const range = await node.evaluate((element) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const resourceId = /** @type {HTMLElement | null} */ (element.closest(".cv-day"))?.dataset.resourceId;
    const found = /** @type {Array<any>} */ (calendar.backgrounds).find(
      (entry) => entry.classNames?.includes("sc-blocked") && String(entry.resourceId) === resourceId,
    );
    if (!found) return null;
    return {
      resourceId: String(resourceId),
      start: String(found.start),
      label: String(found.extendedProps?.label ?? found.title ?? ""),
    };
  });
  if (!range?.label) throw new Error("expected a painted, labelled blocker on screen");
  return range;
}

/**
 * Its box, measured now. Kept separate from `describeBlocker` because every
 * render moves it: the group row alone changes the header height, so a box
 * read before seeding is already stale by the time the drag starts.
 *
 * @param {import("@playwright/test").Page} page
 * @param {boolean} [scroll] bring it into view first, when nothing else has to stay reachable
 */
async function blockerBox(page, scroll = false) {
  const node = page.locator(".cv-background.sc-blocked").first();
  await expect(node).toBeVisible();
  if (scroll) await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  if (!box) throw new Error("expected the blocker to be laid out");
  return box;
}

test("a refused destination is red under the pointer, and never commits", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // One day, three rooms: every column fits the viewport, so the target is
  // reachable without a horizontal scroll on any engine. Far enough out that
  // the fixture has thinned to nothing, so the probe below is the only
  // booking in that column.
  await setView(page, "resourceDay");
  await gotoDate(page, weekdayFrom((await anchorDate(page)).add({ days: 21 }), 3));
  const { label, resourceId, start } = await describeBlocker(page);

  // The rule is a rectangle on screen, so the drag source is placed relative
  // to it rather than to a clock: 90 minutes earlier in the same room is
  // open by every other rule the shell enforces.
  const anchor = Temporal.ZonedDateTime.from(start);
  await page.evaluate(
    async ({ probeStart, probeEnd, room }) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      // Awaited: a load still in flight would replace the probe.
      await calendar.refetchEvents();
      calendar.addEvent({
        id: "probe-drag",
        title: "Drag me",
        start: probeStart,
        end: probeEnd,
        resourceId: room,
      });
    },
    {
      probeStart: anchor.subtract({ minutes: 90 }).toString(),
      probeEnd: anchor.subtract({ minutes: 60 }).toString(),
      room: resourceId,
    },
  );
  await flushRender(page);

  // Scrolled so both ends of the drag are on screen at once, from the
  // element's own API rather than by nudging the blocker into view - that
  // scrolls the minimum needed and can push the source out the other side.
  await page.evaluate(
    (time) => /** @type {any} */ (document.querySelector("calendar-view")).scrollToTime(time),
    anchor.subtract({ minutes: 120 }).toPlainTime().toString(),
  );
  // Both boxes measured after the last render that moves them.
  const box = await blockerBox(page);
  const source = await page.locator('.cv-event[data-event-id="probe-drag"]').boundingBox();
  if (!source) throw new Error("expected the probe booking to be laid out");

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  const mirror = page.locator(".cv-drag-mirror");
  await expect(mirror).toHaveClass(/cv-invalid/);
  // The reason names the background the core reported as overlapping the
  // proposed range, not a constant the shell looked up a second time.
  await expect(mirror).toHaveAttribute("data-reason", new RegExp(label));
  await page.mouse.up();
  await flushRender(page);

  // Prevention, not correction: the drop never happened, so the booking kept
  // its place and the commit-time guard had no refusal to explain.
  const after = await page.evaluate(() =>
    String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("probe-drag").start),
  );
  expect(Temporal.ZonedDateTime.compare(after, anchor.subtract({ minutes: 90 }))).toBe(0);
  await expect(page.locator("#toast")).not.toHaveClass(/is-open/);
});

test("a refused selection drag paints its own ghost", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceThreeDays");
  // Far enough out that the fixture has thinned to nothing, so the space
  // above the blocker is column background rather than a booking.
  await gotoDate(page, weekdayFrom((await anchorDate(page)).add({ days: 21 }), 3));
  await scrollToMorning(page);
  const { label } = await describeBlocker(page);
  const box = await blockerBox(page, true);
  const x = box.x + box.width / 2;

  // The press has to land on a legal anchor - a refused start arms no
  // selection at all - so it begins clear of the blocker and grows into it.
  await page.mouse.move(x, box.y - 80);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 6, { steps: 10 });
  const ghost = page.locator(".cv-select-ghost");
  await expect(ghost).toHaveClass(/cv-invalid/);
  await expect(ghost).toHaveAttribute("data-reason", new RegExp(label));
  await page.mouse.up();
  await flushRender(page);
  // A refused selection arms no creation sheet.
  await expect(page.locator("#create-dialog")).not.toBeVisible();
});

/**
 * M11 in the shell: the core marks every rendered node past/current/future
 * against the render's own `now`, and re-renders by itself at the next
 * boundary. The cockpit counter reads that fact instead of keeping a clock.
 */
test("the cockpit counts what the core marks as running", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    // "Running" is about now, so today has to be on screen: the shell hides
    // Sunday by policy and the anchor is not always rendered. Day bounds are
    // widened for the same reason - the suite runs at any hour.
    calendar.setAttribute("slot-min", "00:00");
    calendar.setAttribute("slot-max", "23:59");
    calendar.configure({ hiddenDays: [] });
  });
  await flushRender(page);
  await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    // Awaited: the range change queued a load that would otherwise replace
    // these two the moment it lands.
    await calendar.refetchEvents();
    // The instant comes from the clock and is handed over as a zoned ISO
    // string; the element projects it into its own zone. No literal date,
    // no hand-written offset.
    const at = (/** @type {number} */ deltaMinutes) =>
      new Date(Date.now() + deltaMinutes * 60000).toISOString().replace("Z", "+00:00[UTC]");
    const resourceId = calendar.resources[0].id;
    calendar.addEvent({ id: "probe-running", title: "Running now", start: at(-20), end: at(20), resourceId });
    calendar.addEvent({ id: "probe-done", title: "Already over", start: at(-90), end: at(-60), resourceId });
  });
  await flushRender(page);

  await expect(page.locator('[data-event-id="probe-running"]')).toHaveAttribute(
    "data-temporal-state",
    "current",
  );
  await expect(page.locator('[data-event-id="probe-done"]')).toHaveAttribute("data-temporal-state", "past");
  // The chip counts events, not nodes: a booking spanning several days owns
  // several nodes, and the fixture may already have something running.
  const distinct = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const ids = new Set();
    for (const node of calendar.querySelectorAll('[data-temporal-state="current"]')) {
      if (node.dataset.eventId) ids.add(node.dataset.eventId);
    }
    return ids.size;
  });
  expect(distinct).toBeGreaterThan(0);
  await expect(page.locator(".sc-now-chip")).toHaveText(`${distinct} in progress`);
});

/**
 * A viewport point at a wall-clock minute inside a rendered column, derived
 * from the column box and the element's own day bounds rather than from an
 * axis label - the labels are localized, the geometry is not. Columns are
 * scanned from `fromColumn` until one is free at that height, so the point
 * is an empty-slot intent and not a hit on a booking.
 *
 * @param {import("@playwright/test").Page} page
 * @param {number} minutes wall-clock minutes from midnight
 */
async function freeSlotPoint(page, minutes) {
  return page.evaluate((target) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const toMinutes = (/** @type {string} */ value) =>
      Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const min = toMinutes(calendar.getAttribute("slot-min") ?? "00:00");
    const max = toMinutes(calendar.getAttribute("slot-max") ?? "24:00");
    for (const body of calendar.querySelectorAll(".cv-day-body")) {
      const rect = body.getBoundingClientRect();
      const y = rect.top + (rect.height * (target - min)) / (max - min);
      const x = rect.left + rect.width / 2;
      const node = document.elementFromPoint(x, y);
      if (node instanceof Element && node.classList.contains("cv-day-body")) return { x, y };
    }
    return null;
  }, minutes);
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {{ x: number, y: number } | null} point
 */
async function bookHere(page, point) {
  expect(point).not.toBeNull();
  await page.mouse.move(point?.x ?? 0, point?.y ?? 0);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: "Book 30 minutes here" }).click();
}

/**
 * The rule the shell draws has to be the rule it enforces, and a proposal
 * that names no room asks a different question from one that does: not "is
 * this room blocked" but "is every room blocked". That is already how the
 * mini-month marks a day, and these two tests pin the grid to the same
 * answer.
 */
test("a combined view no longer refuses a slot another room is free for", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // Combined: the columns are days, not rooms, so a slot names no room. The
  // Wednesday three weeks out keeps the fixture thin and stays clear of the
  // Tuesday building-wide range and of view-only Saturday.
  await setView(page, "threeDays");
  await gotoDate(page, weekdayFrom((await anchorDate(page)).add({ days: 21 }), 3));
  await scrollToMorning(page);
  // Room C is on its Daily reset at this hour - and rooms A and B are not.
  await bookHere(page, await freeSlotPoint(page, 12 * 60 + 15));

  await expect(page.locator("#create-dialog")).toBeVisible();
  await expect(page.locator("#toast")).not.toHaveClass(/is-open/);
});

test("a building-wide closure is drawn in a combined view, and refuses there", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "threeDays");
  await gotoDate(page, weekdayFrom((await anchorDate(page)).add({ days: 21 }), 2));
  await scrollToMorning(page);
  // A room-scoped range has no column to live in here; a building-wide one
  // does, so it is the one thing a combined view can honestly hatch.
  await expect(page.locator(".cv-background.sc-blocked").first()).toBeVisible();
  await bookHere(page, await freeSlotPoint(page, 8 * 60 + 15));

  await expect(page.locator("#create-dialog")).not.toBeVisible();
  await expect(page.locator("#toast")).toContainText("in every room");
});

/**
 * M16 in the shell: one level of room grouping. The core derives the
 * sections and owns the column spans; the shell only declares the groups,
 * skins the row and mirrors the same sections in its own filter - grouping
 * never becomes a core filter.
 */
test("rooms are grouped by building, and the columns follow the sections", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceDay");

  const declared = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return {
      groups: /** @type {Array<any>} */ (calendar.resourceGroups).map((group) => String(group.id)),
      // `calendar.resources` keeps the application's own order: grouping is
      // a visual derivation, not a reordering of what was handed over.
      resources: /** @type {Array<any>} */ (calendar.resources).map((resource) => ({
        id: String(resource.id),
        groupId: resource.groupId == null ? null : String(resource.groupId),
      })),
    };
  });
  expect(declared.groups.length).toBeGreaterThan(1);

  // One header per non-empty group, in the declared order.
  const rendered = await page
    .locator(".cv-group-header")
    .evaluateAll((nodes) => nodes.map((node) => /** @type {HTMLElement} */ (node).dataset.groupId));
  expect(rendered).toEqual(declared.groups.filter((id) => declared.resources.some((r) => r.groupId === id)));

  // The resource columns are ordered by section, and every declared room is
  // rendered exactly once - never twice, never dropped.
  const columns = await page
    .locator(".cv-resource-header")
    .evaluateAll((nodes) => nodes.map((node) => /** @type {HTMLElement} */ (node).dataset.resourceId));
  const bySection = declared.groups
    .flatMap((id) => declared.resources.filter((r) => r.groupId === id).map((r) => r.id))
    .concat(
      declared.resources
        .filter((r) => r.groupId === null || !declared.groups.includes(r.groupId))
        .map((r) => r.id),
    );
  expect(columns).toEqual(bySection);
  expect(new Set(columns).size).toBe(declared.resources.length);
});

test("dropping the group declaration reserves no header space", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceDay");
  await expect(page.locator(".cv-group-row")).toBeVisible();
  const groupedTop = await page
    .locator(".cv-day-header")
    .first()
    .evaluate((node) => node.getBoundingClientRect().top);

  await openPanel(page);
  await page.click("#tools-toggle");
  await page.locator('[data-grid="groups"]').click();
  await flushRender(page);

  // The rooms keep their `groupId`; nothing matches it any more, so they all
  // trail in the headerless block and the row is not rendered at all.
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-resource-header")).toHaveCount(3);
  const flatTop = await page
    .locator(".cv-day-header")
    .first()
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(flatTop).toBeLessThan(groupedTop);
});

test("filtering a whole group only ever changes which rooms the core is given", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await setView(page, "resourceDay");
  await openPanel(page);

  const first = await page.evaluate(
    () =>
      /** @type {HTMLElement | null} */ (document.querySelector("#room-list input[data-group-id]"))?.dataset
        .groupId ?? null,
  );
  expect(first).not.toBeNull();
  const members = await page.evaluate((groupId) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return /** @type {Array<any>} */ (calendar.resources)
      .filter((resource) => String(resource.groupId) === groupId)
      .map((resource) => String(resource.id));
  }, first);
  expect(members.length).toBeGreaterThan(0);

  await page.locator(`#room-list input[data-group-id="${first}"]`).uncheck();
  await flushRender(page);

  // The core was handed fewer resources - not a group filter - so the
  // section disappears with its members instead of rendering empty.
  const left = await page.evaluate(() =>
    /** @type {Array<any>} */ (/** @type {any} */ (document.querySelector("calendar-view")).resources).map(
      (resource) => String(resource.id),
    ),
  );
  expect(left.some((id) => members.includes(id))).toBe(false);
  await expect(page.locator(`.cv-group-header[data-group-id="${first}"]`)).toHaveCount(0);
  await expect(page.locator("#room-summary")).toHaveText(`${left.length}/3`);
});
