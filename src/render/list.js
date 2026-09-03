import { Temporal } from "temporal-polyfill";
import { formatClock } from "../core/dates.js";
import { describeEvent, eventOverlapsDate, toZonedDateTime, wallMinutes } from "../core/slicing.js";

/**
 * Minimal chronological list over the visible dates. Each day is a group
 * with its overlapped events sorted by start; empty days show a muted row.
 * No drag/resize/select: events are buttons sharing `eventContent` and the
 * `describeEvent` accessible name, Enter/Space fires `calendar:eventclick`.
 *
 * List is solo: events from all resources appear, no resource columns.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @returns {DocumentFragment}
 */
export function renderList({ dates, events, options, eventContent, dayHeaderContent }) {
  const timeZone = options.timeZone ?? "UTC";
  const fragment = document.createDocumentFragment();
  const root = document.createElement("div");
  root.className = "cv-list";

  /**
   * @param {import("../core/model.js").NormalizedEvent} event
   * @returns {number}
   */
  const startEpoch = (event) => toZonedDateTime(event.start, timeZone).epochMilliseconds;

  for (const date of dates) {
    const group = document.createElement("section");
    group.className = "cv-list-day";
    group.dataset.date = date.toString();

    const header = document.createElement("header");
    header.className = "cv-list-day-header";
    const headerContent = dayHeaderContent?.({ date, resource: null, element: header });
    if (headerContent instanceof Node) header.append(headerContent);
    else if (headerContent != null) header.textContent = String(headerContent);
    else header.textContent = date.toString();
    group.append(header);

    const dayEvents = events
      .filter((event) => eventOverlapsDate(event, date, timeZone))
      .sort((a, b) => startEpoch(a) - startEpoch(b));

    if (dayEvents.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cv-list-empty";
      empty.textContent = "No events";
      group.append(empty);
    }

    for (const event of dayEvents) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "cv-list-event";
      item.dataset.eventId = event.id;
      item.setAttribute("aria-label", describeEvent(event, timeZone));
      const content = eventContent?.({ event, date, resource: null, element: item });
      if (content instanceof Node) {
        item.append(content);
      } else if (content != null) {
        item.textContent = String(content);
      } else {
        item.textContent = `${formatClock(wallMinutes(toZonedDateTime(event.start, timeZone)))} ${event.title ?? "Event"}`;
      }
      // Native <button> activation covers pointer click and Enter/Space equally.
      item.addEventListener("click", (nativeEvent) => {
        item.dispatchEvent(
          new CustomEvent("calendar:eventclick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { event, date, resource: null, nativeEvent },
          }),
        );
      });
      group.append(item);
    }

    root.append(group);
  }

  fragment.append(root);
  return fragment;
}
