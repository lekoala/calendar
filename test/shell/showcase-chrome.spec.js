import { expect, test } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import {
  anchorDate,
  closePanel,
  flushRender,
  openDayFrom,
  openPanel,
  setView,
  weekdayFrom,
} from "../support/showcase-helpers.js";

/**
 * The showcase's own application chrome: mini-month, search palette, tools
 * shelf, live strip, responsive side panel. None of it is a core contract, so
 * it stays out of the default browser run and is launched by `test:shell`.
 */

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
  const anchor = await anchorDate(page);
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
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", anchor.toString());
  await expect(page.locator("#view-label")).toHaveText("Month");

  // Digit shortcuts are the reason one trigger can replace seven buttons.
  await page.locator("calendar-view").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("7");
  await flushRender(page);
  await expect(page.locator("#view-label")).toHaveText("List");
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", anchor.toString());
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
  // "Live sync" is seeded on the next opening day, whichever weekday that is.
  const liveDay = await page.evaluate(() =>
    String(/** @type {any} */ (document.querySelector("calendar-view")).getEventById("live").start).slice(
      0,
      10,
    ),
  );
  await page.locator('.cb-option:has-text("Live sync")').first().click();
  await flushRender(page);
  await expect(page.locator("#search-dialog")).toBeHidden();
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", liveDay);
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
  const anchor = await anchorDate(page);
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText(String(anchor.day));
  // Temporal already answers this: no date library, no extra option. The
  // number belongs to the first day the grid renders, whichever it is.
  const firstCell = await page.locator(".sc-mini-day").first().getAttribute("data-date");
  await expect(page.locator(".sc-mini-week").first()).toHaveText(
    String(Temporal.PlainDate.from(/** @type {string} */ (firstCell)).weekOfYear),
  );
  // A week away, staying inside the anchor's own month so the cell is always
  // one of the six rendered rows.
  const other = anchor.day <= 21 ? anchor.add({ days: 7 }) : anchor.subtract({ days: 7 });
  await page.click(`.sc-mini-day[data-date="${other}"]`);
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", other.toString());
  await expect(page.locator('.sc-mini-day[data-anchor="true"]')).toHaveText(String(other.day));
});
test("month and year selects drive the mini grid without navigating", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  const anchor = await anchorDate(page);
  // The month label is the month alone: the year has its own select, and a
  // narrow label keeps the mini section from overflowing the sidebar.
  const monthText = await page.evaluate(() => {
    const select = /** @type {any} */ (document.getElementById("mini-month"));
    return select.options[select.selectedIndex]?.text ?? "";
  });
  expect(monthText).toBe(
    new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(anchor.year, anchor.month - 1, 1)),
    ),
  );
  const noOverflow = await page.evaluate(() => {
    const sidebar = /** @type {HTMLElement} */ (document.querySelector(".sc-sidebar"));
    return sidebar.scrollWidth <= sidebar.clientWidth;
  });
  expect(noOverflow).toBe(true);
  // Mid-month in the month after the anchor: always one of the six rows.
  const nextMonth = anchor.with({ day: 1 }).add({ months: 1 });
  const target = nextMonth.with({ day: 15 });
  await page.selectOption("#mini-month", String(nextMonth.month));
  if (nextMonth.year !== anchor.year) await page.selectOption("#mini-year", String(nextMonth.year));
  await expect(page.locator(`.sc-mini-day[data-date="${target}"]`)).toBeVisible();
  // Selecting shows another month; the main anchor only moves on day click.
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", anchor.toString());
  await page.click(`.sc-mini-day[data-date="${target}"]`);
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute("data-date", target.toString());

  const far = target.with({ year: target.year + 4, day: 1 });
  await page.selectOption("#mini-year", String(far.year));
  await expect(page.locator(`.sc-mini-day[data-date="${far}"]`)).toBeVisible();
  // Chevron past the window edge recenters the year list on the anchor:
  // three months on from October lands in January of the following year.
  const edge = far.with({ month: 10, day: 1, year: target.year + 10 });
  await page.selectOption("#mini-year", String(edge.year));
  await page.selectOption("#mini-month", "10");
  await page.click("#mini-next");
  await page.click("#mini-next");
  await page.click("#mini-next");
  await expect(page.locator("#mini-year")).toHaveValue(String(edge.year + 1));
  await expect(
    page.locator(`.sc-mini-day[data-date="${edge.add({ months: 3 }).with({ day: 15 })}"]`),
  ).toBeVisible();
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
  // Six stable rows always spill over at least one month edge; take whichever
  // padding day the anchor's month happens to produce.
  const outside = page.locator('.sc-mini-day[data-outside-month="true"]').first();
  const outsideIso = await outside.getAttribute("data-date");
  await outside.click();
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute(
    "data-date",
    /** @type {string} */ (outsideIso),
  );
});
test("the mini-month marks closed days and the active week", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // Closed follows the fixture policy (closedWeekdays) and the hidden
  // Sunday, never the weekday name: Saturday and Sunday read closed, a
  // plain working day does not. Taken from the anchor's own month, so the
  // cells exist whatever month the shell opened on.
  const anchor = await anchorDate(page);
  const firstOfMonth = anchor.with({ day: 1 });
  const saturday = weekdayFrom(firstOfMonth, 6);
  const sunday = saturday.add({ days: 1 });
  const working = weekdayFrom(firstOfMonth, 4);
  await expect(page.locator(`.sc-mini-day[data-date="${saturday}"]`)).toHaveAttribute("data-closed", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${sunday}"]`)).toHaveAttribute("data-closed", "true");
  await expect(page.locator(`.sc-mini-day[data-date="${working}"]`)).not.toHaveAttribute(
    "data-closed",
    "true",
  );
  // The anchor's civil week rides one band of seven.
  const monday = anchor.subtract({ days: anchor.dayOfWeek - 1 });
  const otherWeek = anchor.day <= 21 ? anchor.add({ days: 7 }) : anchor.subtract({ days: 7 });
  await expect(page.locator('.sc-mini-day[data-activeweek="true"]')).toHaveCount(7);
  await expect(page.locator(`.sc-mini-day[data-date="${monday}"]`)).toHaveAttribute(
    "data-activeweek",
    "true",
  );
  await expect(page.locator(`.sc-mini-day[data-date="${otherWeek}"]`)).not.toHaveAttribute(
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
  const outside = page.locator('.sc-mini-day[data-outside-month="true"]').first();
  const outsideIso = await outside.getAttribute("data-date");
  await outside.click();
  await flushRender(page);
  await expect(page.locator("#anchor-label")).toHaveAttribute(
    "data-date",
    /** @type {string} */ (outsideIso),
  );
  await expect(page.locator("#mini-grid [disabled]")).toHaveCount(0);
});
test("occupancy removes the availability dot without closing the day", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // Availability only means anything on a day the desk opens.
  const anchor = await anchorDate(page);
  const day = openDayFrom(anchor);
  const iso = day.toString();
  const nextIso = openDayFrom(day.add({ days: 1 })).toString();
  // Every active room fully occupied leaves no free interval: the dot
  // disappears while the day itself stays open (not closed, navigable).
  await page.evaluate(
    ([day, next]) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const fill = (/** @type {string} */ resourceId) => ({
        id: `fill-${resourceId.split("-")[1]}`,
        start: `${day}T08:00:00[Europe/Brussels]`,
        end: `${day}T18:00:00[Europe/Brussels]`,
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
  // The fixture puts it a week out, on the first opening day from there.
  const fullIso = openDayFrom((await anchorDate(page)).add({ days: 6 })).toString();
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
  await expect(page.locator("#mini-legend")).toContainText(/fully booked/i);
});
test("a seeded nearly-full day shows amber from the first load", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  await openPanel(page);
  // The three verdicts the legend names are all on screen without touching
  // anything: this fixture is the amber one, three days past the red day.
  const nearIso = openDayFrom((await anchorDate(page)).add({ days: 9 })).toString();
  const cell = page.locator(`.sc-mini-day[data-date="${nearIso}"]`);
  await expect(cell).toHaveAttribute("data-soon", "true");
  await expect(cell).not.toHaveAttribute("data-full", "true");
  await expect(cell).not.toHaveAttribute("data-marked", "true");
  await expect(cell).not.toHaveAttribute("data-closed", "true");
  // Amber is a verdict about the day, not about one room: all three are busy.
  await expect(page.locator('.sc-mini-day[data-soon="true"]').first()).toBeVisible();
  await expect(page.locator("#mini-legend .is-warning")).toBeVisible();
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
  // Rooms are addressed by id: the list also carries group rows, and which
  // row sits at which index is not what this test is about.
  const rooms = await page.evaluate(() =>
    [...document.querySelectorAll("#room-list input[data-room-id]")].map(
      (input) => /** @type {HTMLElement} */ (input).dataset.roomId,
    ),
  );
  expect(rooms.length).toBe(3);
  await page.locator(`#room-list input[data-room-id="${rooms[2]}"]`).uncheck();
  await flushRender(page);
  await expect(page.locator("#room-summary")).toHaveText("2/3");
  await expect.poll(isIndeterminate).toBe(true);

  // No room at all: the mini-month must not read "none" as "full".
  await page.locator(`#room-list input[data-room-id="${rooms[0]}"]`).uncheck();
  await page.locator(`#room-list input[data-room-id="${rooms[1]}"]`).uncheck();
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
  const iso = openDayFrom(await anchorDate(page)).toString();
  // Every room 08:00-17:30 leaves half an hour: still bookable, but under
  // the `nearFullFreeMinutes` policy, so amber instead of red.
  await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = ["room-a", "room-b", "room-c"].map((resourceId) => ({
      id: `near-${resourceId.split("-")[1]}`,
      start: `${day}T08:00:00[Europe/Brussels]`,
      end: `${day}T17:30:00[Europe/Brussels]`,
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
  await expect(page.locator("#mini-legend")).toContainText(/nearly full/i);
  // A day fully covered in every room still outranks it: red is the
  // exhausted verdict.
  await page.evaluate((day) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = ["room-a", "room-b", "room-c"].map((resourceId) => ({
      id: `full-${resourceId.split("-")[1]}`,
      start: `${day}T08:00:00[Europe/Brussels]`,
      end: `${day}T18:00:00[Europe/Brussels]`,
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
  // The seeded fully-booked day, a week out, reads red aloud.
  const fullIso = openDayFrom((await anchorDate(page)).add({ days: 6 })).toString();
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
test("flagged bookings carry an icon cluster, hidden when short", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();
  // Both states are on screen: a card with room prints its flags, a short one
  // drops the cluster instead of clipping it. Which booking carries which
  // flag is the fixture s business, not this test s.
  const clusters = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-event .sc-icons")].map((node) => ({
      glyphs: node.querySelectorAll(".ti").length,
      shown: getComputedStyle(node).display !== "none",
    })),
  );
  expect(clusters.some((cluster) => cluster.shown && cluster.glyphs > 0)).toBe(true);
  expect(clusters.some((cluster) => !cluster.shown)).toBe(true);
  // List rows lead with the kind glyph.
  await setView(page, "list");
  await expect(page.locator(".sc-row .ti").first()).toBeVisible();
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
  const gridRows = await page.locator("#grid-menu li").count();
  await page.locator('#grid-menu li [aria-label^="Pin Week numbers"]').click();
  await expect(page.locator("#tools-pinned")).toBeVisible();
  await expect(page.locator("#tools-pinned-list .menu-item-text").first()).toHaveText("Week numbers");
  // One row left the catalog for the pinned lane - how many the catalog
  // holds is fixture size, not the contract under test.
  await expect(page.locator("#grid-menu li")).toHaveCount(gridRows - 1);
  await page.locator('#tools-pinned-list [data-grid="weeks"]').click();
  await flushRender(page);
  await expect(page.locator('#tools-pinned-list [data-grid="weeks"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );

  // A pinned tool also escapes the menu: one icon above the calendar, with
  // the tool's name as its tooltip, firing the same row action.
  await expect(page.locator("#tools-pinned-bar")).toBeVisible();
  await expect(page.locator("#tools-pinned-bar .sc-pinned-tool")).toHaveCount(1);
  await expect(page.locator("#tools-pinned-bar .sc-pinned-tool")).toHaveAttribute(
    "aria-label",
    "Week numbers",
  );
  await page.locator("#tools-pinned-bar .sc-pinned-tool").click();
  await flushRender(page);
  await expect(page.locator('#tools-pinned-list [data-grid="weeks"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // The bar click light-dismissed the menu, but the dismissal lands on its
  // own task: `popovertarget` is a toggle, so clicking it while the menu is
  // still open closes it instead of reopening it, the unpin click never
  // reaches its row, and the strip below stays visible. Wait for both edges.
  await expect(page.locator("#tools-menu")).toBeHidden();
  await page.click("#tools-toggle");
  await expect(page.locator("#tools-menu")).toBeVisible();

  // Unpinning restores the row to its section home and hides the strip.
  await page.locator('#tools-pinned-list .sc-pin[aria-label^="Pin Week numbers"]').click();
  await expect(page.locator("#tools-pinned")).toBeHidden();
  await expect(page.locator("#tools-pinned-bar")).toBeHidden();
  await expect(page.locator("#grid-menu li")).toHaveCount(gridRows);
  await expect(page.locator('#grid-menu [data-grid="weeks"]')).toHaveAttribute("aria-checked", "true");
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
test("the two card skins are one attribute, and switching keeps the same cards", async ({ page }) => {
  await page.goto("/demo/showcase.html");
  await expect(page.locator(".cv-event").first()).toBeVisible();

  // Stamp the tallest card and read that one: it is the only card certain
  // to sit above every container-query threshold, so what is measured is
  // what a skin does to a full card rather than what a container query
  // does to a short one.
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".cv-event")];
    const tallest = cards.reduce((best, card) => (card.clientHeight > best.clientHeight ? card : best));
    tallest.dataset.skinProbe = "1";
  });
  const probe = page.locator('.cv-event[data-skin-probe="1"]');
  const read = () =>
    probe.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        radius: Number.parseFloat(style.borderTopLeftRadius),
        shadow: style.boxShadow,
        tag: getComputedStyle(/** @type {Element} */ (node.querySelector(".sc-tag"))).display,
        ink: style.color,
        fill: style.backgroundColor,
      };
    });

  await expect(page.locator("html")).toHaveAttribute("data-skin", "soft");
  const soft = await read();

  await page.click("#account-toggle");
  await page.click('#skin-chips [data-skin-value="solid"]');
  await expect(page.locator("html")).toHaveAttribute("data-skin", "solid");
  await expect(page.locator('#skin-chips [data-skin-value="solid"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  // The stamp is still there, so no card was rebuilt: the switch is a CSS
  // concern end to end, and nothing the application had put on a node was
  // lost with it.
  await expect(probe).toHaveCount(1);
  const solid = await read();

  // Relationships, not values: `soft` rounds more than `solid`, carries no
  // resting shadow, and hides the kind chip that a filled card can still
  // afford, while both the ink and the fill change. Re-tuning either skin
  // stays free.
  expect(soft.radius).toBeGreaterThan(solid.radius);
  expect(soft.shadow).toBe("none");
  expect(solid.shadow).not.toBe("none");
  expect(soft.tag).toBe("none");
  expect(solid.tag).not.toBe("none");
  expect(soft.ink).not.toBe(solid.ink);
  expect(soft.fill).not.toBe(solid.fill);
});
