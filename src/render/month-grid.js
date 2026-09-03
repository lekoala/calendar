import { Temporal } from "temporal-polyfill";
import { zonedDateTimeAt } from "../core/dates.js";
import { describeEvent, eventOverlapsDate, toZonedDateTime } from "../core/slicing.js";

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
 * @param {number} [input.options.monthEventLimit]
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.moreLinkContent]
 * @returns {DocumentFragment}
 */
export function renderMonthGrid({ weeks, month, events, options, eventContent, moreLinkContent }) {
  const timeZone = options.timeZone ?? "UTC";
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
    cell.textContent = day.toLocaleString(undefined, { weekday: "short" });
    head.append(cell);
  }
  root.append(head);

  /**
   * @param {import("../core/model.js").NormalizedEvent} event
   * @returns {number}
   */
  const startEpoch = (event) => toZonedDateTime(event.start, timeZone).epochMilliseconds;

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

      const dayEvents = events
        .filter((event) => eventOverlapsDate(event, date, timeZone))
        .sort((a, b) => startEpoch(a) - startEpoch(b));

      for (const event of dayEvents.slice(0, limit)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = ["cv-month-event", ...(event.classNames ?? [])].join(" ");
        chip.dataset.eventId = event.id;
        chip.setAttribute("aria-label", describeEvent(event, timeZone));
        const content = eventContent?.({ event, date, resource: null, element: chip });
        if (content instanceof Node) chip.append(content);
        else chip.textContent = content == null ? (event.title ?? "Event") : String(content);
        // Native <button> activation covers pointer click and Enter/Space equally.
        chip.addEventListener("click", (nativeEvent) => {
          chip.dispatchEvent(
            new CustomEvent("calendar:eventclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { event, date, resource: null, nativeEvent },
            }),
          );
        });
        cell.append(chip);
      }

      if (dayEvents.length > limit) {
        const hidden = dayEvents.length - limit;
        const more = document.createElement("button");
        more.type = "button";
        more.className = "cv-month-more";
        more.dataset.date = date.toString();
        const content = moreLinkContent?.({ date, events: dayEvents, hidden, element: more });
        if (content instanceof Node) more.append(content);
        else more.textContent = content == null ? `+${hidden} more` : String(content);
        // The application decides what "show the rest" means: a popover, a
        // day view, a raised chip limit. The core only reports the intent.
        more.addEventListener("click", (nativeEvent) => {
          more.dispatchEvent(
            new CustomEvent("calendar:moreclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { date, events: dayEvents, hidden, nativeEvent },
            }),
          );
        });
        cell.append(more);
      }

      // Empty-cell click selects the civil day; chips and the `+n more`
      // button carry their own intent and must not fall through to it.
      cell.addEventListener("click", (nativeEvent) => {
        if (
          nativeEvent.target instanceof Element &&
          nativeEvent.target.closest(".cv-month-event, .cv-month-more")
        ) {
          return;
        }
        const start = zonedDateTimeAt(date, 0, timeZone);
        cell.dispatchEvent(
          new CustomEvent("calendar:select", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: {
              start,
              end: start.add({ days: 1 }),
              resourceId: null,
              nativeEvent,
            },
          }),
        );
      });

      row.append(cell);
    }
    root.append(row);
  }

  fragment.append(root);
  return fragment;
}
