import { Temporal } from "temporal-polyfill";
import { durationMinutes, formatClock, minutesFromMidnight, zonedDateTimeAt } from "../core/dates.js";
import { eventGeometry, snapMinutes } from "../core/geometry.js";
import { hitTest } from "../core/hit.js";
import { layoutEvents } from "../core/layout.js";
import { isMovable, isResizable } from "../core/model.js";
import { createAutoscroller } from "./autoscroll.js";

/**
 * @typedef {object} CommitTarget
 * @property {boolean} [editable]
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} _commitEventMove
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} _commitEventResize
 */

/**
 * @typedef {object} TimeGridColumn
 * @property {Temporal.PlainDate} date
 * @property {import("../core/model.js").CalendarResource | null} resource
 */

/**
 * @typedef {object} TimeGridOptions
 * @property {string} slotMin
 * @property {string} slotMax
 * @property {number} pxPerMinute
 * @property {string} [timeZone]
 * @property {boolean} [editable]
 * @property {Temporal.Duration | { minutes: number }} [snapDuration]
 * @property {Temporal.Duration | { minutes: number }} [defaultTimedEventDuration]
 */

/**
 * @typedef {object} ActiveSelection
 * @property {number} anchor
 * @property {number} downX
 * @property {number} downY
 * @property {boolean} moved
 * @property {number} start
 * @property {number} end
 */

/**
 * @param {unknown} isoLike
 * @returns {number}
 */
function eventMinutes(isoLike) {
  // Prototype shortcut: the public model is Temporal/ZonedDateTime, but this
  // renderer only needs wall-clock geometry for the first spike.
  // TODO: parse through the shared Temporal adapter once timezone/view logic lands.
  const match = String(isoLike).match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/**
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").CalendarResource[]} input.resources
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {TimeGridOptions} input.options
 * @param {CommitTarget} input.calendar
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.resourceHeaderContent]
 * @returns {DocumentFragment}
 */
export function renderTimeGrid({
  dates,
  resources,
  events,
  backgrounds,
  options,
  calendar,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
}) {
  const fragment = document.createDocumentFragment();
  const root = document.createElement("div");
  root.className = "cv-grid";

  const axis = document.createElement("div");
  axis.className = "cv-axis";
  root.append(axis);

  const startMinutes = minutesFromMidnight(options.slotMin);
  const endMinutes = minutesFromMidnight(options.slotMax);
  const pxPerMinute = options.pxPerMinute;
  const timeZone = options.timeZone ?? "UTC";
  const snapStep = durationMinutes(options.snapDuration ?? { minutes: 15 });
  const defaultDuration = durationMinutes(options.defaultTimedEventDuration ?? { minutes: 30 });
  const totalHeight = (endMinutes - startMinutes) * pxPerMinute;
  axis.style.height = `${totalHeight}px`;

  // Single-pointer selection state shared by all columns of this render.
  // Range edges snap with floor (start) / ceil (end) so the dragged area is
  // always covered; a plain click proposes defaultTimedEventDuration.
  /** @type {ActiveSelection | null} */
  let selecting = null;
  let suppressClick = false;

  /**
   * @param {TimeGridColumn} column
   * @param {HTMLDivElement} body
   * @param {number} clientX
   * @param {number} clientY
   */
  function columnHit(column, body, clientX, clientY) {
    return hitTest({
      x: clientX,
      y: clientY,
      columns: [{ date: column.date, resource: column.resource, rect: body.getBoundingClientRect() }],
      slotMin: startMinutes,
      slotMax: endMinutes,
      pxPerMinute,
    });
  }

  /**
   * @param {HTMLDivElement} body
   * @param {TimeGridColumn} column
   * @param {number} start
   * @param {number} end
   * @param {Event} nativeEvent
   * @returns {void}
   */
  function dispatchSelect(body, column, start, end, nativeEvent) {
    body.dispatchEvent(
      new CustomEvent("calendar:select", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          start: zonedDateTimeAt(column.date, start, timeZone),
          end: zonedDateTimeAt(column.date, end, timeZone),
          resourceId: column.resource?.id ?? null,
          nativeEvent,
        },
      }),
    );
  }

  for (let minute = startMinutes; minute <= endMinutes; minute += 60) {
    const label = document.createElement("div");
    label.className = "cv-axis-label";
    label.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
    label.textContent = `${String(Math.floor(minute / 60)).padStart(2, "0")}:00`;
    axis.append(label);
  }

  const columns = resources.length
    ? resources.flatMap((resource) => dates.map((date) => ({ date, resource })))
    : dates.map((date) => ({ date, resource: null }));

  root.style.gridTemplateColumns = `3.5rem repeat(${Math.max(1, columns.length)}, minmax(var(--calendar-column-min), 1fr))`;

  /** @type {Array<{ column: TimeGridColumn, body: HTMLDivElement }>} */
  const bodies = [];

  /**
   * Grid-wide hit test across every rendered day column. Used by event drag
   * to resolve day and resource changes while the pointer moves.
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  function gridHit(clientX, clientY) {
    return hitTest({
      x: clientX,
      y: clientY,
      columns: bodies.map(({ column, body }) => ({
        date: column.date,
        resource: column.resource,
        rect: body.getBoundingClientRect(),
      })),
      slotMin: startMinutes,
      slotMax: endMinutes,
      pxPerMinute,
    });
  }

  for (const column of columns) {
    const day = document.createElement("section");
    day.className = "cv-day";
    day.dataset.date = column.date.toString();
    if (column.resource) day.dataset.resourceId = column.resource.id;

    const header = document.createElement("header");
    header.className = "cv-day-header";
    const headerContent = column.resource
      ? resourceHeaderContent?.({ date: column.date, resource: column.resource, element: header })
      : dayHeaderContent?.({ date: column.date, element: header });
    if (headerContent instanceof Node) header.append(headerContent);
    else if (headerContent != null) header.textContent = String(headerContent);
    else
      header.textContent = column.resource
        ? `${column.resource.title} · ${column.date.toString()}`
        : column.date.toString();
    day.append(header);

    const body = document.createElement("div");
    body.className = "cv-day-body";
    body.style.height = `${totalHeight}px`;

    for (let minute = startMinutes; minute <= endMinutes; minute += 60) {
      const line = document.createElement("div");
      line.className = "cv-hour-line";
      line.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
      body.append(line);
    }

    for (const background of backgrounds) {
      const sameResource =
        !column.resource || !background.resourceId || background.resourceId === column.resource.id;
      const sameDay = String(background.start).startsWith(column.date.toString());
      if (!sameResource || !sameDay) continue;
      const geometry = eventGeometry({
        startMinutes: eventMinutes(background.start),
        endMinutes: eventMinutes(background.end),
        dayStartMinutes: startMinutes,
        pxPerMinute,
        gap: 0,
      });
      const node = document.createElement("div");
      node.className = ["cv-background", ...(background.classNames ?? [])].join(" ");
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      body.append(node);
    }

    const dayEvents = events
      .filter((event) => {
        const sameDay = String(event.start).startsWith(column.date.toString());
        const sameResource = !column.resource || event.resourceId === column.resource.id;
        return sameDay && sameResource;
      })
      .map((event) => ({ event, start: eventMinutes(event.start), end: eventMinutes(event.end) }));

    for (const item of layoutEvents(dayEvents)) {
      const { event } = item;
      const geometry = eventGeometry({
        startMinutes: item.start,
        endMinutes: item.end,
        dayStartMinutes: startMinutes,
        pxPerMinute,
      });
      const node = document.createElement("button");
      node.type = "button";
      node.className = ["cv-event", ...(event.classNames ?? [])].join(" ");
      node.dataset.eventId = event.id;
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      node.style.left = `${item.left * 100}%`;
      node.style.width = `${item.width * 100}%`;
      node.setAttribute("aria-label", `${event.title ?? "Event"}, ${event.start} – ${event.end}`);

      const content = eventContent?.({ event, date: column.date, resource: column.resource, element: node });
      if (content instanceof Node) node.append(content);
      else node.textContent = content == null ? (event.title ?? "Event") : String(content);

      // Native <button> activation covers pointer click and Enter/Space equally.
      node.addEventListener("click", (nativeEvent) => {
        node.dispatchEvent(
          new CustomEvent("calendar:eventclick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { event, date: column.date, resource: column.resource, nativeEvent },
          }),
        );
      });

      // A drag or resize that moved must not leak an eventclick from its residual click.
      node.addEventListener(
        "click",
        (nativeEvent) => {
          if (!suppressClick) return;
          suppressClick = false;
          nativeEvent.stopPropagation();
          nativeEvent.preventDefault();
        },
        true,
      );

      const movable = isMovable(event, calendar.editable);
      const resizable = isResizable(event, calendar.editable);

      if (resizable) {
        for (const edge of /** @type {["start", "end"]} */ (["start", "end"])) {
          const handle = document.createElement("div");
          handle.className = `cv-resize-handle cv-resize-${edge === "start" ? "n" : "s"}`;
          node.append(handle);
          handle.addEventListener("pointerdown", (nativeEvent) => {
            beginResize(nativeEvent, edge);
          });
        }
      }

      if (movable) {
        node.addEventListener("pointerdown", beginDrag);
      }

      /**
       * @param {PointerEvent} nativeEvent
       * @param {"start" | "end"} edge
       * @returns {void}
       */
      function beginResize(nativeEvent, edge) {
        if (nativeEvent.button !== 0) return;
        nativeEvent.stopPropagation();
        nativeEvent.preventDefault();
        node.setPointerCapture(nativeEvent.pointerId);
        const savedTop = node.style.top;
        const savedHeight = node.style.height;
        const downX = nativeEvent.clientX;
        const downY = nativeEvent.clientY;
        let moved = false;
        /** @type {{ start: number, end: number } | null} */
        let pending = null;

        /** @param {PointerEvent} moveEvent @returns {void} */
        const onMove = (moveEvent) => {
          if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4) moved = true;
          if (!moved) return;
          const hit = columnHit(column, body, moveEvent.clientX, moveEvent.clientY);
          if (!hit) return;
          let start = item.start;
          let end = item.end;
          if (edge === "end") {
            end = Math.max(snapMinutes(hit.minutes, snapStep, "ceil"), start + snapStep);
          } else {
            start = Math.min(snapMinutes(hit.minutes, snapStep, "floor"), end - snapStep);
          }
          pending = { start, end };
          node.style.top = `${(start - startMinutes) * pxPerMinute}px`;
          node.style.height = `${(end - start) * pxPerMinute}px`;
        };

        /** @param {PointerEvent} upEvent @returns {void} */
        const onUp = (upEvent) => {
          node.removeEventListener("pointermove", onMove);
          node.removeEventListener("pointercancel", onCancel);
          if (!moved || !pending) return;
          suppressClick = true;
          const result = calendar._commitEventResize({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: {
              start: zonedDateTimeAt(column.date, pending.start, timeZone),
              end: zonedDateTimeAt(column.date, pending.end, timeZone),
              resourceId: event.resourceId ?? null,
            },
            nativeEvent: upEvent,
          });
          if (!result) {
            node.style.top = savedTop;
            node.style.height = savedHeight;
          }
        };

        /** @param {PointerEvent} _cancelEvent @returns {void} */
        const onCancel = (_cancelEvent) => {
          node.removeEventListener("pointermove", onMove);
          node.removeEventListener("pointerup", onUp);
          node.style.top = savedTop;
          node.style.height = savedHeight;
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerup", onUp);
        node.addEventListener("pointercancel", onCancel);
      }

      /**
       * Drag an event across time, days and resources. The original node
       * stays in place while a detached mirror follows the pointer; the
       * calendar commits optimistically on drop and re-renders.
       *
       * @param {PointerEvent} nativeEvent
       * @returns {void}
       */
      function beginDrag(nativeEvent) {
        if (nativeEvent.button !== 0) return;
        if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-resize-handle")) {
          return;
        }
        const downHit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
        if (!downHit) return;
        node.setPointerCapture(nativeEvent.pointerId);
        const duration = item.end - item.start;
        const grabOffset = downHit.minutes - item.start;
        const downX = nativeEvent.clientX;
        const downY = nativeEvent.clientY;
        const scroller = body.closest(".cv-scroller");
        const autoscroll = scroller ? createAutoscroller(scroller) : null;
        let moved = false;
        /** @type {HTMLButtonElement | null} */
        let mirror = null;
        /** @type {{ start: number, end: number, column: TimeGridColumn, droppable: boolean } | null} */
        let pending = null;

        /** @param {PointerEvent} moveEvent @returns {void} */
        const onMove = (moveEvent) => {
          if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4) moved = true;
          if (!moved) return;
          if (!mirror) {
            mirror = /** @type {HTMLButtonElement} */ (node.cloneNode(true));
            mirror.classList.add("cv-drag-mirror");
            mirror.classList.remove("cv-drag-source");
            mirror.tabIndex = -1;
            mirror.setAttribute("aria-hidden", "true");
            node.classList.add("cv-drag-source");
          }
          autoscroll?.update(moveEvent.clientY);
          const hit = gridHit(moveEvent.clientX, moveEvent.clientY);
          if (!hit) return;
          const start = Math.min(
            Math.max(snapMinutes(hit.minutes - grabOffset, snapStep, "floor"), startMinutes),
            endMinutes - duration,
          );
          const target = bodies[hit.column];
          const droppable = target.column.resource?.droppable !== false;
          pending = { start, end: start + duration, column: target.column, droppable };
          if (mirror.parentNode !== target.body) target.body.append(mirror);
          mirror.style.top = `${(start - startMinutes) * pxPerMinute}px`;
          mirror.style.height = `${duration * pxPerMinute}px`;
          mirror.classList.toggle("cv-invalid", !droppable);
        };

        const cleanup = () => {
          node.removeEventListener("pointermove", onMove);
          node.removeEventListener("pointerup", onUp);
          node.removeEventListener("pointercancel", onCancel);
          autoscroll?.stop();
          mirror?.remove();
          node.classList.remove("cv-drag-source");
        };

        /** @param {PointerEvent} upEvent @returns {void} */
        const onUp = (upEvent) => {
          const wasMoved = moved;
          const range = pending;
          cleanup();
          if (!wasMoved || !range) return;
          // A non-droppable target reverts silently: no dispatch, no state change.
          if (!range.droppable) return;
          suppressClick = true;
          calendar._commitEventMove({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: {
              start: zonedDateTimeAt(range.column.date, range.start, timeZone),
              end: zonedDateTimeAt(range.column.date, range.end, timeZone),
              resourceId: range.column.resource?.id ?? null,
            },
            nativeEvent: upEvent,
          });
        };

        /** @param {PointerEvent} _cancelEvent @returns {void} */
        const onCancel = (_cancelEvent) => {
          cleanup();
        };

        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerup", onUp);
        node.addEventListener("pointercancel", onCancel);
      }

      body.append(node);
    }

    const canSelect = column.resource?.selectable !== false;
    if (canSelect) {
      const hover = document.createElement("div");
      hover.className = "cv-hover";
      hover.setAttribute("aria-hidden", "true");
      hover.hidden = true;
      const hoverChip = document.createElement("span");
      hoverChip.className = "cv-hover-chip";
      hover.append(hoverChip);
      body.append(hover);

      /** @type {HTMLDivElement | null} */
      let ghost = null;
      /** @type {HTMLSpanElement | null} */
      let ghostChip = null;

      /** @param {PointerEvent} nativeEvent @returns {void} */
      const showHover = (nativeEvent) => {
        const target = nativeEvent.target;
        const overEvent = target instanceof Element && target.closest(".cv-event") !== null;
        if (selecting || nativeEvent.buttons !== 0 || overEvent) {
          hover.hidden = true;
          return;
        }
        const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
        if (!hit) {
          hover.hidden = true;
          return;
        }
        const snapped = snapMinutes(hit.minutes, snapStep, "floor");
        hover.style.top = `${(snapped - startMinutes) * pxPerMinute}px`;
        hover.style.height = `${defaultDuration * pxPerMinute}px`;
        hoverChip.textContent = `+ ${formatClock(snapped)}`;
        hover.hidden = false;
      };

      body.addEventListener("pointermove", showHover);
      body.addEventListener("pointerleave", () => {
        hover.hidden = true;
      });

      body.addEventListener("pointerdown", (nativeEvent) => {
        if (nativeEvent.button !== 0) return;
        if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-event")) return;
        const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
        if (!hit) return;
        hover.hidden = true;
        body.setPointerCapture(nativeEvent.pointerId);
        ghost = document.createElement("div");
        ghost.className = "cv-select-ghost";
        ghost.setAttribute("aria-hidden", "true");
        ghostChip = document.createElement("span");
        ghostChip.className = "cv-select-chip";
        ghost.append(ghostChip);
        body.append(ghost);
        const anchor = snapMinutes(hit.minutes, snapStep, "floor");
        selecting = {
          anchor,
          downX: nativeEvent.clientX,
          downY: nativeEvent.clientY,
          moved: false,
          start: anchor,
          end: anchor,
        };
      });

      body.addEventListener("pointermove", (nativeEvent) => {
        if (!selecting || !ghost || !ghostChip) return;
        if (Math.hypot(nativeEvent.clientX - selecting.downX, nativeEvent.clientY - selecting.downY) >= 4) {
          selecting.moved = true;
        }
        if (!selecting.moved) return;
        const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
        if (!hit) return;
        const start = snapMinutes(Math.min(selecting.anchor, hit.minutes), snapStep, "floor");
        const end = Math.max(
          snapMinutes(Math.max(selecting.anchor, hit.minutes), snapStep, "ceil"),
          start + snapStep,
        );
        selecting.start = start;
        selecting.end = end;
        ghost.style.top = `${(start - startMinutes) * pxPerMinute}px`;
        ghost.style.height = `${(end - start) * pxPerMinute}px`;
        ghostChip.textContent = `${formatClock(start)} - ${formatClock(end)}`;
      });

      /**
       * @param {PointerEvent} nativeEvent
       * @param {boolean} cancelled
       * @returns {void}
       */
      const finishSelection = (nativeEvent, cancelled) => {
        if (!selecting) return;
        const { anchor, moved, start, end } = selecting;
        selecting = null;
        ghost?.remove();
        ghost = null;
        if (cancelled) return;
        if (moved) {
          suppressClick = true;
          dispatchSelect(body, column, start, end, nativeEvent);
        } else {
          dispatchSelect(body, column, anchor, Math.min(anchor + defaultDuration, endMinutes), nativeEvent);
        }
      };

      body.addEventListener("pointerup", (nativeEvent) => finishSelection(nativeEvent, false));
      body.addEventListener("pointercancel", (nativeEvent) => finishSelection(nativeEvent, true));

      // A true drag-selection must not leak a second select from its residual click.
      body.addEventListener("click", (nativeEvent) => {
        if (!suppressClick) return;
        suppressClick = false;
        nativeEvent.stopPropagation();
        nativeEvent.preventDefault();
      });
    }

    const now = Temporal.Now.zonedDateTimeISO(timeZone);
    if (column.date.toString() === now.toPlainDate().toString()) {
      const nowMinutes = now.hour * 60 + now.minute + now.second / 60;
      if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
        const indicator = document.createElement("div");
        indicator.className = "cv-now";
        indicator.style.top = `${(nowMinutes - startMinutes) * pxPerMinute}px`;
        indicator.setAttribute("aria-hidden", "true");
        body.append(indicator);
      }
    }
    day.append(body);
    bodies.push({ column, body });
    root.append(day);
  }

  fragment.append(root);
  return fragment;
}
