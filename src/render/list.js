import { Temporal } from "temporal-polyfill";
import { formatClock, formatDayHeader } from "../core/dates.js";
import { DEFAULT_LABELS } from "../core/labels.js";
import { listDayRows } from "../core/list-rows.js";
import { describeEvent, instantRangeOf, wallMinutes } from "../core/slicing.js";
import { temporalState } from "../core/temporal.js";

/**
 * Minimal chronological list over the visible dates. Each day is a group
 * with its overlapped rows in `listDayRows` order; days without events show
 * a muted row. No drag/resize/select: events are buttons sharing
 * `eventContent` and the `describeEvent` accessible name, Enter/Space fires
 * `calendar:eventclick`.
 *
 * When `backgrounds` are passed, each overlapping range becomes an inert row
 * (`cv-list-background`): not focusable, no listener, no `calendar:*` event.
 *
 * List is solo: events and backgrounds from all resources appear, no
 * resource columns and no resource filtering.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} [input.backgrounds] rendered as inert rows; omit to list events only
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {string} [input.options.locale] BCP 47 tag for default day headers; hooks stay authoritative
 * @param {import("../core/labels.js").CalendarLabels} [input.options.labels] fixed UI strings, defaulting to English
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.backgroundContent]
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @returns {DocumentFragment}
 */
export function renderList({
  dates,
  events,
  backgrounds,
  options,
  now,
  eventContent,
  dayHeaderContent,
  backgroundContent,
}) {
  const timeZone = options.timeZone ?? "UTC";
  const renderNow = now ?? Temporal.Now.zonedDateTimeISO(timeZone);
  const locale = options.locale;
  const labels = options.labels ?? DEFAULT_LABELS;
  const fragment = document.createDocumentFragment();
  const root = document.createElement("div");
  root.className = "cv-list";

  for (const date of dates) {
    const group = document.createElement("section");
    group.className = "cv-list-day";
    group.dataset.date = date.toString();

    const header = document.createElement("header");
    header.className = "cv-list-day-header";
    const headerContent = dayHeaderContent?.({ date, resource: null, element: header });
    if (headerContent instanceof Node) header.append(headerContent);
    else if (headerContent != null) header.textContent = String(headerContent);
    else header.textContent = formatDayHeader(date, locale);
    group.append(header);

    const rows = listDayRows({ date, events, backgrounds, timeZone });

    for (const row of rows) {
      if (row.kind === "background") {
        group.append(renderBackgroundRow(row, date, labels, backgroundContent));
        continue;
      }
      const event = row.item;
      const item = document.createElement("button");
      item.type = "button";
      item.className = ["cv-list-event", ...(event.classNames ?? [])].join(" ");
      item.dataset.eventId = event.id;
      item.dataset.focusKey = JSON.stringify([event.id, date.toString(), "list"]);
      const state = temporalState(event.start, event.end, renderNow, timeZone);
      item.dataset.temporalState = state;
      item.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
      const content = eventContent?.({ event, date, resource: null, temporalState: state, element: item });
      if (content instanceof Node) {
        item.append(content);
      } else if (content != null) {
        item.textContent = String(content);
      } else if (event.start instanceof Temporal.PlainDate) {
        item.textContent = event.title ?? labels.untitledEvent;
      } else {
        item.textContent = `${formatClock(wallMinutes(instantRangeOf(event.start, event.end, timeZone).start))} ${event.title ?? labels.untitledEvent}`;
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

    if (!rows.some((row) => row.kind === "event")) {
      const empty = document.createElement("p");
      empty.className = "cv-list-empty";
      empty.textContent = labels.noEvents;
      group.append(empty);
    }

    root.append(group);
  }

  fragment.append(root);
  return fragment;
}

/**
 * Inert row for a background range. A plain element in reading order: no
 * role, no tabindex, no listener, so it never takes focus or emits intent.
 * Without `backgroundContent` it reads its time span on that day, because
 * the core attaches no meaning to a background.
 *
 * @param {import("../core/list-rows.js").ListRow & { kind: "background" }} row
 * @param {Temporal.PlainDate} date
 * @param {import("../core/labels.js").CalendarLabels} labels
 * @param {((info: object) => unknown) | undefined} backgroundContent
 * @returns {HTMLElement}
 */
function renderBackgroundRow(row, date, labels, backgroundContent) {
  const background = row.item;
  const element = document.createElement("div");
  element.className = ["cv-list-background", ...(background.classNames ?? [])].join(" ");
  element.dataset.backgroundId = background.id;
  // `start`/`end` are this day's portion (null when all-day), so a hook never
  // re-derives the clipping the row already did.
  const content = backgroundContent?.({
    background,
    date,
    start: row.start,
    end: row.end,
    allDay: row.allDay,
    element,
  });
  if (content instanceof Node) element.append(content);
  else if (content != null) element.textContent = String(content);
  else element.textContent = backgroundSpanText(row, labels);
  return element;
}

/**
 * Default text of a background row: the all-day label, or the clipped
 * wall-clock span on that day. A span reaching the next midnight ends at
 * `24:00`. Repeated-hour spans use the same projection as grid geometry;
 * the hook still receives the canonical clipped instants.
 *
 * @param {import("../core/list-rows.js").ListRow} row
 * @param {import("../core/labels.js").CalendarLabels} labels
 * @returns {string}
 */
function backgroundSpanText(row, labels) {
  if (row.coversDay || !row.span) return labels.allDaySlotLabel;
  return `${formatClock(row.span.start)}–${formatClock(row.span.end)}`;
}
