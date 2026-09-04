import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Showcase shell: generic room-booking application around the core, in a
 * full-viewport Actual CSS layout (side panel with mini-month and filters,
 * one-row agenda toolbar, popover menus, application booking rules, hover
 * tooltip, app-owned sheets).
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Under 64rem the side panel is a popover. Tests that drive it open it the
 * way a user would instead of assuming the desktop layout, and close it
 * again so it stops covering the toolbar.
 *
 * @param {import("@playwright/test").Page} page
 */
async function openPanel(page) {
  const toggle = page.locator("#sidebar-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

/** @param {import("@playwright/test").Page} page */
async function closePanel(page) {
  if (await page.evaluate(() => document.getElementById("sidebar")?.matches(":popover-open"))) {
    await page.keyboard.press("Escape");
  }
}

/**
 * View switching goes through the view menu now. Driving it by keyboard
 * digit keeps the test independent of the menu's own geometry.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} view
 */
async function setView(page, view) {
  await page.evaluate((name) => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView(name);
  }, view);
  await flushRender(page);
}

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

test("the shell fills the viewport and only the calendar scrolls", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const box = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    shellHeight: document.getElementById("shell")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
    scroller: document.querySelector(".cv-scroller")?.clientHeight ?? 0,
  }));
  expect(box.documentOverflow).toBe(0);
  expect(Math.round(box.shellHeight)).toBe(box.viewport);
  // The chrome is one topbar, one toolbar row and one status line: the grid
  // gets the rest of the viewport, on a phone as much as on a desktop.
  expect(box.scroller).toBeGreaterThan(box.viewport * 0.7);
});

test("the view menu switches views and names the current one", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // Narrow viewports deliberately open on a single day, so the label is
  // whatever the shell chose: assert it follows, not a fixed name.
  const initial = await page.evaluate(
    () => /** @type {any} */ (document.querySelector("calendar-view")).view,
  );
  await page.click("#view-toggle");
  await expect(page.locator("#view-menu")).toBeVisible();
  await expect(page.locator(`#view-menu [data-view="${initial}"]`)).toHaveAttribute("aria-checked", "true");

  await page.click('#view-menu [data-view="month"]');
  await flushRender(page);
  await expect(page.locator("#view-menu")).toBeHidden();
  await expect(page.locator(".cv-month-day").first()).toBeVisible();
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-03");
  await expect(page.locator("#view-label")).toHaveText("Month");

  // Digit shortcuts are the reason one trigger can replace seven buttons.
  await page.locator("calendar-view").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("7");
  await flushRender(page);
  await expect(page.locator("#view-label")).toHaveText("List");
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-03");
});

test("clicking an event opens the app-owned detail sheet", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await page.locator(".cv-event").first().click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-title")).not.toBeEmpty();
  await expect(page.locator("#cockpit .sc-last")).toContainText("eventclick");
});

test("the search palette reveals a loaded event on its date", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#search-toggle");
  await expect(page.locator("#search-dialog")).toBeVisible();
  // `<combo-box>` enhances a real `input list`, and its suggestions come from
  // an async `load(query, { signal })` - the same shape as `eventSource`.
  await page.fill("#tools-search", "live sync");
  await expect(page.locator('.cb-option:has-text("Live sync")')).toBeVisible();
  await page.locator('.cb-option:has-text("Live sync")').first().click();
  await flushRender(page);
  await expect(page.locator("#search-dialog")).toBeHidden();
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-04");
  await expect(page.locator("#cockpit .sc-last")).toContainText("search → live");
  // Navigation, not a value: reopening starts from an empty query, with no
  // picker and none of the previous search's transient results.
  await page.click("#search-toggle");
  await expect(page.locator("#tools-search")).toHaveValue("");
  await expect(page.locator(".cb-popover")).toBeHidden();
});

test("the palette opens quiet, and closes without the keyboard", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#search-toggle");
  await expect(page.locator("#search-dialog")).toBeVisible();
  // Every suggestion comes from `load()`, so there is nothing to show below
  // `minChars`: the picker stays shut instead of opening on a state row.
  await expect(page.locator(".cb-popover")).toBeHidden();
  await page.fill("#tools-search", "r");
  await expect(page.locator(".cb-popover")).toBeHidden();
  await page.fill("#tools-search", "road");
  await expect(page.locator(".cb-option").first()).toBeVisible();

  await page.click("#search-dialog .dialog-close");
  await expect(page.locator("#search-dialog")).toBeHidden();
  await expect(page.locator(".cb-popover")).toBeHidden();

  // The backdrop dismisses every sheet in the shell, not just this one.
  await page.click("#search-toggle");
  await expect(page.locator("#search-dialog")).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator("#search-dialog")).toBeHidden();
});

test("the search picker belongs to its dialog, and follows the locale", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#search-toggle");
  await page.fill("#tools-search", "sprint");
  await expect(page.locator(".cb-option").first()).toBeVisible();
  // The picker is a `popover="manual"` parented to the nearest ancestor
  // dialog. That is the whole reason the search is a palette rather than a
  // field inside the side panel, which is itself a popover below 64rem.
  expect(
    await page.evaluate(() => {
      const picker = /** @type {HTMLElement | null} */ (document.querySelector(".cb-popover"));
      return { parent: picker?.parentElement?.id, mode: picker?.popover };
    }),
  ).toEqual({ parent: "search-dialog", mode: "manual" });
  // Rich rows are DOM nodes here too, so a suggestion carries the detail a
  // single line cannot.
  await expect(page.locator(".cb-option .sc-hit").first()).toBeVisible();
  await expect(page.locator(".cb-option small").first()).not.toBeEmpty();

  // Escape unwinds one layer at a time: the picker first, the palette after.
  await page.keyboard.press("Escape");
  await expect(page.locator(".cb-popover")).toBeHidden();
  await expect(page.locator("#search-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#search-dialog")).toBeHidden();

  await page.click("#account-toggle");
  await page.click('#locale-chips [data-locale="fr"]');
  await page.keyboard.press("Escape");
  await page.click("#search-toggle");
  await page.fill("#tools-search", "zzzzz");
  // `messages` is snapshotted per instance, so the locale switch has to
  // reconfigure it - and does.
  await expect(page.locator(".cb-empty")).toContainText("Aucune réservation");
});

test("the mini month navigates the anchor date and shows ISO weeks", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText("3");
  // Temporal already answers this: no date library, no extra option.
  await expect(page.locator(".sc-mini-week").first()).toHaveText("36");
  await page.click('.sc-mini-day[data-date="2026-09-10"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-10");
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText("10");
});

test("month and year selects drive the mini grid without navigating", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // The month label is the month alone: the year has its own select, and a
  // narrow label keeps the mini section from overflowing the sidebar.
  const monthText = await page.evaluate(() => {
    const select = /** @type {any} */ (document.getElementById("mini-month"));
    return select.options[select.selectedIndex]?.text ?? "";
  });
  expect(monthText).toBe("September");
  const noOverflow = await page.evaluate(() => {
    const sidebar = /** @type {HTMLElement} */ (document.querySelector(".sc-sidebar"));
    return sidebar.scrollWidth <= sidebar.clientWidth;
  });
  expect(noOverflow).toBe(true);
  await page.selectOption("#mini-month", "10");
  await expect(page.locator('.sc-mini-day[data-date="2026-10-15"]')).toBeVisible();
  // Selecting shows another month; the main anchor only moves on day click.
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-09-03");
  await page.click('.sc-mini-day[data-date="2026-10-15"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-10-15");

  await page.selectOption("#mini-year", "2030");
  await expect(page.locator('.sc-mini-day[data-date="2030-10-01"]')).toBeVisible();
  // Chevron past the window edge recenters the year list on the anchor.
  await page.selectOption("#mini-year", "2036");
  await page.click("#mini-next");
  await page.click("#mini-next");
  await page.click("#mini-next");
  await expect(page.locator("#mini-year")).toHaveValue("2037");
  await expect(page.locator('.sc-mini-day[data-date="2037-01-15"]')).toBeVisible();
});

test("short months still fill six stable rows", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // February 2021 holds four civil weeks; presentation pads it to six.
  await page.selectOption("#mini-year", "2021");
  await page.selectOption("#mini-month", "2");
  await expect(page.locator(".sc-mini-day")).toHaveCount(42);
  await expect(page.locator('.sc-mini-day[data-date="2021-02-01"]')).toBeVisible();
  await expect(page.locator('.sc-mini-day[data-date="2021-03-14"]')).toBeVisible();
});

test("outside-month days navigate and nothing is ever disabled", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  await expect(page.locator("#mini-grid [disabled]")).toHaveCount(0);
  await expect(page.locator('.sc-mini-day[data-date="2026-08-31"]')).toHaveAttribute(
    "data-outside-month",
    "true",
  );
  await page.click('.sc-mini-day[data-date="2026-08-31"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-08-31");
});

test("the mini-month marks closed days and the active week", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // Closed follows the fixture policy (closedWeekdays) and the hidden
  // Sunday, never the weekday name: Saturday and Sunday read closed, a
  // plain Thursday does not.
  await expect(page.locator('.sc-mini-day[data-date="2026-09-05"]')).toHaveAttribute("data-closed", "true");
  await expect(page.locator('.sc-mini-day[data-date="2026-09-06"]')).toHaveAttribute("data-closed", "true");
  await expect(page.locator('.sc-mini-day[data-date="2026-09-03"]')).not.toHaveAttribute(
    "data-closed",
    "true",
  );
  // The anchor week (Mon 31 Aug – Sun 6 Sep) rides one band of seven.
  await expect(page.locator('.sc-mini-day[data-activeweek="true"]')).toHaveCount(7);
  await expect(page.locator('.sc-mini-day[data-date="2026-09-01"]')).toHaveAttribute(
    "data-activeweek",
    "true",
  );
  await expect(page.locator('.sc-mini-day[data-date="2026-09-10"]')).not.toHaveAttribute(
    "data-activeweek",
    "true",
  );
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveAttribute("aria-current", "date");
});

test("the viewer toggle re-marks availability without touching navigation", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const adminMarks = await page.locator('.sc-mini-day[data-marked="true"]').count();
  expect(adminMarks).toBeGreaterThan(0);
  await expect(page.locator("#mini-legend")).toContainText("Free");
  await page.click("#tools-toggle");
  await page.click('#grid-menu [data-grid="viewer"]');
  await expect(page.locator("#mini-legend")).toContainText("Bookable for you");
  const externalMarks = await page.locator('.sc-mini-day[data-marked="true"]').count();
  // Bookable implies available, so the external set can only shrink.
  expect(externalMarks).toBeLessThanOrEqual(adminMarks);
  // Navigation is viewer-independent: an outside-month day still jumps.
  // Below 64rem the Escape that closed the tools menu also closes the
  // side panel popover, so reopen it on the way there.
  await page.keyboard.press("Escape");
  await closePanel(page);
  await openPanel(page);
  await page.click('.sc-mini-day[data-date="2026-08-31"]');
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", "2026-08-31");
  await expect(page.locator("#mini-grid [disabled]")).toHaveCount(0);
});

test("occupancy removes the availability dot without closing the day", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const [iso, nextIso] = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const day = calendar.date;
    return /** @type {[string, string]} */ ([day.toString(), day.add({ days: 1 }).toString()]);
  });
  // Every active room fully occupied leaves no free interval: the dot
  // disappears while the day itself stays open (not closed, navigable).
  await page.evaluate(
    ([day, next]) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const fill = (/** @type {string} */ resourceId) => ({
        id: `fill-${resourceId.split("-")[1]}`,
        start: `${day}T08:00:00+02:00[Europe/Brussels]`,
        end: `${day}T18:00:00+02:00[Europe/Brussels]`,
        resourceId,
      });
      calendar.events = ["room-a", "room-b", "room-c"].map(fill);
      void next;
    },
    [iso, nextIso],
  );
  // `.events =` re-renders the core; the mini follows via calendar:render.
  await flushRender(page);
  // The day stays open, but red "full" replaces the green dot: no free
  // interval remains anywhere.
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).toHaveAttribute("data-full", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).not.toHaveAttribute("data-marked", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).not.toHaveAttribute("data-closed", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${nextIso}"]`)).toHaveAttribute("data-marked", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${nextIso}"]`)).not.toHaveAttribute("data-full", "true");
});

test("a seeded fully-booked day shows red, and no day mixes markers", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const fullIso = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.date.add({ days: 6 }).toString();
  });
  await expect(page.locator(`.sc-mini-day[data-date="${fullIso}"]`)).toHaveAttribute("data-full", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${fullIso}"]`)).not.toHaveAttribute(
    "data-marked",
    "true",
  );
  await expect(page.locator(`.sc-mini-day[data-date="${fullIso}"]`)).not.toHaveAttribute(
    "data-closed",
    "true",
  );
  // A green day is never simultaneously red.
  await expect(page.locator('.sc-mini-day[data-marked="true"][data-full="true"]')).toHaveCount(0);
  await expect(page.locator("#mini-legend .is-danger")).toBeVisible();
  await expect(page.locator("#mini-legend")).toContainText("fully booked");
});

test("room and kind filters change what the core is given", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // Resource headers only exist in resource views; the filter itself does not
  // depend on the view the shell happened to open on.
  await setView(page, "resourceThreeDays");
  await expect(page.locator(".cv-resource-header")).toHaveCount(3);

  await page.locator("#room-list input").nth(2).uncheck();
  await flushRender(page);
  await expect(page.locator(".cv-resource-header")).toHaveCount(2);
  await expect(page.locator("#room-summary")).toHaveText("2/3");

  const before = await page.locator(".cv-event").count();
  await page.click('#kind-legend button[data-kind="maintenance"]');
  await flushRender(page);
  await expect(page.locator('#kind-legend button[data-kind="maintenance"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator('.cv-event[data-kind="maintenance"]')).toHaveCount(0);
  expect(await page.locator(".cv-event").count()).toBeLessThan(before);
});

test("the room master toggle reads indeterminate, and no room is no verdict", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const isIndeterminate = () =>
    page.evaluate(() => /** @type {HTMLInputElement} */ (document.getElementById("room-all")).indeterminate);

  // All three rooms start active: the master is checked, not indeterminate.
  await expect(page.locator("#room-all")).toBeChecked();
  expect(await isIndeterminate()).toBe(false);

  // One room off turns the master `indeterminate`; the demand stays 2/3.
  await page.locator("#room-list input").nth(2).uncheck();
  await flushRender(page);
  await expect(page.locator("#room-summary")).toHaveText("2/3");
  await expect.poll(isIndeterminate).toBe(true);

  // No room at all: the mini-month must not read "none" as "full".
  await page.locator("#room-list input").first().uncheck();
  await page.locator("#room-list input").nth(1).uncheck();
  await flushRender(page);
  await expect(page.locator("#room-summary")).toHaveText("0/3");
  await expect(page.locator('.sc-mini-day[data-full="true"]')).toHaveCount(0);
  await expect(page.locator('.sc-mini-day[data-marked="true"]')).toHaveCount(0);
  await expect(page.locator('.sc-mini-day[data-neutral="true"]')).toHaveCount(42);
  await expect(page.locator(".sc-mini-day").first()).toHaveAttribute("aria-label", /no rooms selected$/);

  // One click on the master restores the whole fixture.
  await page.locator("#room-all").check();
  await flushRender(page);
  await expect(page.locator("#room-summary")).toHaveText("3/3");
  await expect(page.locator("#room-all")).toBeChecked();
});

test("a nearly-full day shows amber before it tips to red", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const iso = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).date.toString(),
  );
  // Every room 08:00-17:30 leaves half an hour: still bookable, but under
  // the `nearFullFreeMinutes` policy, so amber instead of red.
  await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = ["room-a", "room-b", "room-c"].map((resourceId) => ({
      id: `near-${resourceId.split("-")[1]}`,
      start: `${day}T08:00:00+02:00[Europe/Brussels]`,
      end: `${day}T17:30:00+02:00[Europe/Brussels]`,
      resourceId,
    }));
  }, iso);
  await flushRender(page);
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).toHaveAttribute("data-soon", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).not.toHaveAttribute("data-full", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).not.toHaveAttribute("data-closed", "true");
  // The amber verdict is named and shown next to its legend swatch.
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).toHaveAttribute(
    "aria-label",
    /nearly full$/,
  );
  await expect(page.locator("#mini-legend .is-warning")).toBeVisible();
  await expect(page.locator("#mini-legend")).toContainText("nearly full");
  // A day fully covered in every room still outranks it: red is the
  // exhausted verdict.
  await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = ["room-a", "room-b", "room-c"].map((resourceId) => ({
      id: `full-${resourceId.split("-")[1]}`,
      start: `${day}T08:00:00+02:00[Europe/Brussels]`,
      end: `${day}T18:00:00+02:00[Europe/Brussels]`,
      resourceId,
    }));
  }, iso);
  await flushRender(page);
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).toHaveAttribute("data-full", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${iso}"]`)).not.toHaveAttribute("data-soon", "true");
});

test("the mini month names its verdict in the accessible name", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // The seeded fully-booked day (anchor + 6) reads red aloud.
  const fullIso = await page.evaluate(() =>
    /** @type {any} */ (document.querySelector("calendar-view")).date.add({ days: 6 }).toString(),
  );
  await expect(page.locator(`.sc-mini-day[data-date="${fullIso}"]`)).toHaveAttribute(
    "aria-label",
    /fully booked$/,
  );
  // A closed Saturday is named closed.
  await expect(page.locator('.sc-mini-day[data-closed="true"]').first()).toHaveAttribute(
    "aria-label",
    /closed$/,
  );
  // An open day is named free, and the anchor keeps its aria-current.
  await expect(page.locator('.sc-mini-day[data-marked="true"]').first()).toHaveAttribute(
    "aria-label",
    /free$/,
  );
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveAttribute("aria-current", "date");
});

test("the live strip reports the visible range", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // The shell counts every booking in range, time-grid and all-day alike.
  const shown = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const { start, end } = calendar.getVisibleRange();
    const from = start.toString();
    const to = end.toString();
    return /** @type {Array<{ start: unknown }>} */ (calendar.events).filter((item) => {
      const day = String(item.start).slice(0, 10);
      return day >= from && day < to;
    }).length;
  });
  await expect(page.locator("#cockpit")).toContainText(`${shown} bookings in view`);
  await expect(page.locator("#cockpit")).toContainText("3/3 rooms shown");
});

test("the seeded all-day closure lives in the lane and opens the detail sheet", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator(".cv-allday-event")).toHaveCount(1);
  const bar = page.locator(".cv-allday-event[data-event-id='seed-all-day']");
  await expect(bar).toContainText("Atrium closure");
  await expect(bar).toHaveAttribute("aria-label", "Atrium closure, 2026-09-03 to 2026-09-05, all day");
  // Timed bookings stay in the bodies; the lane bar never leaks down there.
  await expect(page.locator(".cv-day-body .cv-allday-event")).toHaveCount(0);
  await bar.click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-title")).toHaveText("Atrium closure");
  await expect(page.locator("#detail-meta")).toContainText("all day");
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

test("the activity log stays out of the way until it is asked for", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await expect(page.locator("#activity")).toBeHidden();
  const withoutLog = await page.evaluate(() => document.querySelector(".cv-scroller")?.clientHeight ?? 0);
  await page.click("#activity-toggle");
  await expect(page.locator("#activity")).toBeVisible();
  await expect(page.locator("#event-log li").first()).toContainText("shell ready");
  const withLog = await page.evaluate(() => document.querySelector(".cv-scroller")?.clientHeight ?? 0);
  expect(withLog).toBeLessThan(withoutLog);
  await page.click("#activity-close");
  await expect(page.locator("#activity")).toBeHidden();
});

test("the application refuses a move that breaks its own booking rules", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // `calendar:eventmove` is cancelable: a synchronous preventDefault() makes
  // the core revert its own optimistic change.
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const before = String(calendar.getEventById("live").start);
    const returned = calendar.moveEvent("live", {
      start: before.replace(/T\d\d:/, "T19:"),
      end: String(calendar.getEventById("live").end).replace(/T\d\d:/, "T19:"),
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
  // Two open days (Thu/Fri) across three rooms; Saturday stays fully closed.
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
  const outcome = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const returned = calendar.moveEvent("live", {
      start: "2026-09-03T18:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T18:30:00+02:00[Europe/Brussels]",
      resourceId: "room-b",
    });
    return { accepted: returned !== null, start: String(calendar.getEventById("live").start) };
  });
  expect(outcome.accepted).toBe(true);
  expect(outcome.start).toContain("T18:00:00+02:00");
  // Outside every window the guard still refuses.
  const refused = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return calendar.moveEvent("live", {
      start: "2026-09-03T21:00:00+02:00[Europe/Brussels]",
      end: "2026-09-03T21:30:00+02:00[Europe/Brussels]",
      resourceId: "room-b",
    });
  });
  expect(refused).toBeNull();
});

test("flagged bookings carry an icon cluster, hidden when short", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // Seeded remote/priority flags render trailing glyphs on roomy cards,
  // while short cards hide the cluster instead of clipping it.
  await expect(page.locator(".cv-event .sc-icons .ti-video").first()).toBeVisible();
  const clusters = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-event .sc-icons")].map((node) => ({
      star: node.querySelector(".ti-star") !== null,
      shown: getComputedStyle(node).display !== "none",
    })),
  );
  expect(clusters.some((cluster) => cluster.star && cluster.shown)).toBe(true);
  expect(clusters.some((cluster) => !cluster.shown)).toBe(true);
  // List rows lead with the kind glyph.
  await setView(page, "list");
  await expect(page.locator(".sc-row .ti").first()).toBeVisible();
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

test("a hovered event gets an application tooltip with the dropped detail", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const card = page.locator('.cv-event[data-kind="maintenance"]').first();
  const title = await card.locator(".sc-card strong span").textContent();
  await card.hover();
  await expect(page.locator("#event-tip")).toBeVisible();
  await expect(page.locator("#event-tip strong")).toHaveText(/** @type {string} */ (title ?? ""));
  await expect(page.locator("#event-tip")).toContainText("Seats");
  // No core hook is involved: the tooltip is keyed on `data-event-id`.
  await expect(page.locator("#event-tip")).toContainText("Locked by facilities");
  await page.locator(".sc-toolbar").hover();
  await expect(page.locator("#event-tip")).toBeHidden();
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

test("the tools shelf filters the catalog and pins rows without breaking them", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await closePanel(page);
  await page.click("#tools-toggle");
  await expect(page.locator("#tools-menu")).toBeVisible();

  // Filtering hides non-matching rows and empties the sections they lived
  // in - here only the two rows whose label carries "now" remain.
  await page.fill("#tools-filter", "now");
  await expect(page.locator('[data-tool="now"]')).toBeVisible();
  await expect(page.locator("#source-menu li").first()).toBeHidden();
  await expect(page.locator("#tools-menu > section:not([hidden])")).toHaveCount(2);

  // Escape inside the search field clears the query first (a text field
  // swallows Esc by spec, so the platform cannot close the shelf from it),
  // and only the second press closes the menu. A reopened shelf starts bare.
  await page.keyboard.press("Escape");
  await expect(page.locator("#tools-filter")).toHaveValue("");
  await expect(page.locator("#tools-menu > section:not([hidden])")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(page.locator("#tools-menu")).toBeHidden();
  await page.click("#tools-toggle");
  await expect(page.locator("#tools-filter")).toHaveValue("");

  // Pinning moves a row to the pinned lane; a pinned option keeps working.
  await page.locator('#grid-menu li [aria-label^="Pin Week numbers"]').click();
  await expect(page.locator("#tools-pinned")).toBeVisible();
  await expect(page.locator("#tools-pinned-list .menu-item-text").first()).toHaveText("Week numbers");
  await expect(page.locator("#grid-menu li")).toHaveCount(5);
  await page.locator('#tools-pinned-list [data-grid="weeks"]').click();
  await flushRender(page);
  await expect(page.locator('#tools-pinned-list [data-grid="weeks"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );

  // Unpinning restores the row to its section home.
  await page.locator('#tools-pinned-list .sc-pin[aria-label^="Pin Week numbers"]').click();
  await expect(page.locator("#tools-pinned")).toBeHidden();
  await expect(page.locator("#grid-menu li")).toHaveCount(6);
  await expect(page.locator('#grid-menu [data-grid="weeks"]')).toHaveAttribute("aria-checked", "false");
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

test("the side panel is a popover below 64rem and a column above it", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const narrow = await page.evaluate(() => window.innerWidth < 1024);
  const popover = await page.evaluate(() => document.getElementById("sidebar")?.hasAttribute("popover"));
  expect(popover).toBe(narrow);
  if (!narrow) {
    await expect(page.locator("#sidebar")).toBeVisible();
    return;
  }
  await expect(page.locator("#sidebar")).toBeHidden();
  await page.click("#sidebar-toggle");
  await expect(page.locator("#sidebar")).toBeVisible();
  const drawer = await page.locator("#sidebar").boundingBox();
  expect(Math.round(drawer?.y ?? -1)).toBe(0);
  // Escape and light dismiss come from the platform, not from the shell.
  await page.keyboard.press("Escape");
  await expect(page.locator("#sidebar")).toBeHidden();
});

test("cut marks the event and raises a banner until Escape", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await node.getAttribute("data-event-id");
  await node.click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  // The event stays in place, visibly cut, with a persistent banner: the
  // clipboard must survive navigation and re-renders.
  await expect(page.locator("#clipboard-bar")).toBeVisible();
  await expect(page.locator("#clipboard-bar")).toContainText("is cut");
  await expect(page.locator(`.cv-event[data-event-id="${id}"][data-cut="true"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#clipboard-bar")).toBeHidden();
  await expect(page.locator(`.cv-event[data-event-id="${id}"][data-cut="true"]`)).toHaveCount(0);
});

test("cut, navigate to another week, paste into a free slot", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  const node = page.locator('.cv-event[data-kind="planning"]').first();
  const id = await node.getAttribute("data-event-id");
  await node.click({ button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  await expect(page.locator("#clipboard-bar")).toBeVisible();

  // 2026-10-06 is a Tuesday past the six seeded weeks: no conflicts, no
  // blocked ranges, so the paste validates cleanly.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).gotoDate("2026-10-06");
  });
  await flushRender(page);
  // The banner (and the cut mark) survived the navigation.
  await expect(page.locator("#clipboard-bar")).toBeVisible();
  const body = await page.locator(".cv-day-body").first().boundingBox();
  assert(body, "expected a day body to paste into");
  // 187 minutes sits inside the 10:00 snap step (07:00 slot start): exact
  // boundaries let sub-pixel cross-API slop flip the asserted step.
  await page.mouse.click(body.x + body.width / 2, body.y + 187 * 1.5, { button: "right" });
  await expect(page.locator("#context-menu")).toBeVisible();
  await page.locator("#context-menu").getByRole("menuitem", { name: /Paste/ }).click();
  // A committed paste clears the clipboard and moves the booking.
  await expect(page.locator("#clipboard-bar")).toBeHidden();
  const start = await page.evaluate(
    (eventId) => /** @type {any} */ (document.querySelector("calendar-view")).getEventById(eventId).start,
    id,
  );
  expect(String(start)).toContain("2026-10-06T10:00");
});
