import { Temporal } from "temporal-polyfill";
import { orderMonthEvents } from "../core/event-order.js";
import { DEFAULT_LABELS, formatLabel } from "../core/labels.js";
import { describeEvent, eventOverlapsDate } from "../core/slicing.js";
import { temporalState } from "../core/temporal.js";
import { applyContent, emitCalendarEvent } from "./dom.js";

/**
 * Summary month grid. Weeks are full weeks covering the anchor month, from
 * the configured first weekday and without hidden days; leading/trailing
 * days render dimmed. Each cell shows up to `monthEventLimit` chips
 * repeating per overlapped civil day (no spanning bars), then a `+n more`
 * button that reports the day it belongs to rather than proposing a
 * creation. Background ranges are not rendered.
 *
 * Month is solo: events from all resources appear, no resource columns.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[][]} input.weeks
 * @param {number} input.month anchor month number (1-12) for outside detection
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {string} [input.options.locale] BCP 47 tag for the weekday row; hooks stay authoritative
 * @param {import("../core/labels.js").CalendarLabels} [input.options.labels] fixed UI strings, defaulting to English
 * @param {(a: import("../core/model.js").NormalizedEvent, b: import("../core/model.js").NormalizedEvent) => number} [input.options.monthEventOrder]
 * @param {number} [input.options.monthEventLimit]
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.moreLinkContent]
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @param {(range: { start: unknown, end: unknown, resourceId?: string | null }) => import("../core/overlaps.js").RangeContext} [input.getRangeContext] canonical range context for the selected day
 * @param {(input: {
 *   action: "select",
 *   event: import("../core/model.js").NormalizedEvent | null,
 *   start: unknown,
 *   end: unknown,
 *   resourceId: string | null,
 *   allDay?: boolean,
 * }) => import("../core/policy.js").PolicyDecision} [input.checkInteraction] synchronous policy gate for the day selection
 * @returns {{ fragment: DocumentFragment, update: (events: import("../core/model.js").NormalizedEvent[], now: Temporal.ZonedDateTime) => void }}
 */
export function renderMonthGrid({
  weeks,
  month,
  events,
  options,
  now,
  eventContent,
  moreLinkContent,
  getRangeContext,
  checkInteraction,
}) {
  const timeZone = options.timeZone ?? "UTC";
  const renderNow = now ?? Temporal.Now.zonedDateTimeISO(timeZone);
  const locale = options.locale;
  const labels = options.labels ?? DEFAULT_LABELS;
  const limit = Math.max(1, options.monthEventLimit ?? 3);
  const fragment = document.createDocumentFragment();
  const root = document.createElement("div");
  root.className = "cv-month";
  // Hidden days make the grid narrower than seven columns; the count is
  // calculated geometry, so it travels as a custom property.
  root.style.setProperty("--calendar-month-columns", String(Math.max(1, weeks[0]?.length ?? 7)));

  const head = document.createElement("div");
  head.className = "cv-month-weekdays";
  head.setAttribute("aria-hidden", "true");
  for (const day of weeks[0]) {
    const cell = document.createElement("span");
    cell.className = "cv-month-weekday";
    cell.textContent = day.toLocaleString(locale, { weekday: "short" });
    head.append(cell);
  }
  root.append(head);

  /** @type {Array<(events: import("../core/model.js").NormalizedEvent[], now: Temporal.ZonedDateTime) => void>} */
  const updateDays = [];
  for (const week of weeks) {
    const row = document.createElement("div");
    row.className = "cv-month-week";
    for (const date of week) {
      const cell = document.createElement("section");
      cell.className = "cv-month-day";
      cell.dataset.date = date.toString();
      if (date.month !== month) cell.dataset.outside = "true";

      const label = document.createElement("span");
      label.className = "cv-month-day-number";
      label.textContent = String(date.day);
      cell.append(label);

      /** @type {Map<import("../core/model.js").NormalizedEvent, HTMLButtonElement>} */
      let chips = new Map();
      /** @type {HTMLButtonElement | null} */
      let more = null;
      updateDays.push((events, now) => {
        const dayEvents = orderMonthEvents(
          events.filter((event) => eventOverlapsDate(event, date, timeZone)),
          timeZone,
          options.monthEventOrder,
        );

        const nextChips = new Map();
        for (const event of dayEvents.slice(0, limit)) {
          const state = temporalState(event.start, event.end, now, timeZone);
          const previous = chips.get(event);
          if (previous?.dataset.temporalState === state) {
            nextChips.set(event, previous);
            continue;
          }
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = ["cv-month-event", ...(event.classNames ?? [])].join(" ");
          chip.dataset.eventId = event.id;
          chip.dataset.focusKey = JSON.stringify([event.id, date.toString(), "month"]);
          chip.dataset.temporalState = state;
          chip.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
          const content = eventContent?.({
            event,
            date,
            resource: null,
            temporalState: state,
            element: chip,
          });
          if (!applyContent(chip, content)) chip.textContent = event.title ?? labels.untitledEvent;
          // Native <button> activation covers pointer click and Enter/Space equally.
          chip.addEventListener("click", (nativeEvent) => {
            emitCalendarEvent(
              chip,
              "calendar:eventclick",
              { event, date, resource: null, nativeEvent },
              { cancelable: true },
            );
          });
          nextChips.set(event, chip);
        }
        // Remove old chips first, so an unchanged chip keeps its position
        // and focus when a preceding chip is updated or disappears.
        for (const [event, chip] of chips) {
          if (nextChips.get(event) !== chip) chip.remove();
        }
        let previousNode = label;
        for (const chip of nextChips.values()) {
          if (previousNode.nextSibling !== chip) cell.insertBefore(chip, previousNode.nextSibling);
          previousNode = chip;
        }
        chips = nextChips;
        more?.remove();
        more = null;

        if (dayEvents.length > limit) {
          const hidden = dayEvents.length - limit;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cv-month-more";
          button.dataset.date = date.toString();
          const content = moreLinkContent?.({ date, events: dayEvents, hidden, element: button });
          if (!applyContent(button, content)) button.textContent = formatLabel(labels.more, { hidden });
          // The application decides what "show the rest" means: a popover, a
          // day view, a raised chip limit. The core only reports the intent.
          button.addEventListener("click", (nativeEvent) => {
            emitCalendarEvent(
              button,
              "calendar:moreclick",
              { date, events: dayEvents, hidden, nativeEvent },
              { cancelable: true },
            );
          });
          more = button;
          cell.append(button);
        }
      });

      // Empty-cell click selects the civil day as an all-day range; chips and
      // the `+n more` button carry their own intent and must not fall through
      // to it. Month has no time geometry, so the selection is civil
      // (`Temporal.PlainDate`, `allDay: true`) rather than a zoned midnight.
      cell.addEventListener("click", (nativeEvent) => {
        if (
          nativeEvent.target instanceof Element &&
          nativeEvent.target.closest(".cv-month-event, .cv-month-more")
        ) {
          return;
        }
        const range = { start: date, end: date.add({ days: 1 }), resourceId: null, allDay: true };
        // Same policy contract as the time grid: a refused selection neither
        // dispatches nor paints a ghost.
        const decision = checkInteraction?.({
          action: "select",
          event: null,
          start: range.start,
          end: range.end,
          resourceId: range.resourceId,
          allDay: true,
        }) ?? { ok: true, reason: null };
        if (!decision.ok) return;
        cell.dispatchEvent(
          new CustomEvent("calendar:select", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: {
              start: range.start,
              end: range.end,
              resourceId: range.resourceId,
              allDay: true,
              context: getRangeContext?.(range) ?? null,
              nativeEvent,
            },
          }),
        );
      });

      row.append(cell);
    }
    root.append(row);
  }

  /**
   * @param {import("../core/model.js").NormalizedEvent[]} events
   * @param {Temporal.ZonedDateTime} now
   */
  const update = (events, now) => {
    for (const updateDay of updateDays) updateDay(events, now);
  };
  update(events, renderNow);
  fragment.append(root);
  return { fragment, update };
}
