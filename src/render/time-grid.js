import { Temporal } from "temporal-polyfill";
import {
  durationMinutes,
  formatClock,
  isResourceView,
  minutesFromMidnight,
  zonedDateTimeAt,
} from "../core/dates.js";
import { eventGeometry, snapMinutes } from "../core/geometry.js";
import { hitTest } from "../core/hit.js";
import { layoutEvents } from "../core/layout.js";
import { isMovable, isResizable } from "../core/model.js";
import {
  backgroundAppliesToColumn,
  eventBelongsToColumn,
  getResourceColumns,
  getTimeGridColumns,
} from "../core/resources.js";
import { describeEvent, sliceTimedEventForDay, toZonedDateTime, wallMinutes } from "../core/slicing.js";
import { createAutoscroller } from "./autoscroll.js";

/**
 * Narrow host seam between the element and the renderer. The grid never
 * touches element internals: the class injects bound callbacks, so its own
 * state and helpers can stay truly private (`#field`).
 *
 * @typedef {object} TimeGridHost
 * @property {boolean} [editable]
 * @property {() => boolean} isConnected
 * @property {(message: string) => void} announce
 * @property {(id: string) => void} refocusEvent
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} commitEventMove
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} commitEventResize
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
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").CalendarResource[]} input.resources
 * @param {string} [input.view] view name; resource columns derive only when it is a resource view
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {TimeGridOptions} input.options
 * @param {TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.resourceHeaderContent]
 * @returns {DocumentFragment}
 */
export function renderTimeGrid({
  dates,
  resources,
  view = "week",
  events,
  backgrounds,
  options,
  host,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
}) {
  const fragment = document.createDocumentFragment();

  // Column derivation is view-driven, never inferred from resource count:
  // solo renders one column per date, resource views render resource x dates
  // (possibly zero columns when no resource is selected).
  const resourceView = isResourceView(view);
  const columns = resourceView ? getResourceColumns(resources, dates) : getTimeGridColumns(dates);
  const gridTemplate = `3.5rem repeat(${Math.max(1, columns.length)}, minmax(var(--calendar-column-min), 1fr))`;

  // Grouped resource header row: one header per resource spanning its date
  // columns. Solo views render no resource row at all.
  if (resourceView) {
    const resourceRow = document.createElement("div");
    resourceRow.className = "cv-resource-row";
    resourceRow.style.gridTemplateColumns = gridTemplate;
    const corner = document.createElement("div");
    corner.className = "cv-resource-corner";
    corner.setAttribute("aria-hidden", "true");
    resourceRow.append(corner);
    for (const resource of resources) {
      const header = document.createElement("div");
      header.className = "cv-resource-header";
      header.dataset.resourceId = resource.id;
      header.style.gridColumn = `span ${Math.max(1, dates.length)}`;
      const custom = resourceHeaderContent?.({ resource, dates, element: header });
      if (custom instanceof Node) header.append(custom);
      else if (custom != null) header.textContent = String(custom);
      else header.textContent = resource.title ?? resource.id;
      resourceRow.append(header);
    }
    fragment.append(resourceRow);
  }

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
  // Set when a press-and-hold fires: the pointer release that follows must
  // not start a drag, commit a move, or leak a click/select.
  let longPressConsumed = false;

  const LONG_PRESS_MS = 550;
  const LONG_PRESS_PX = 12;

  /**
   * Pointer capture is best-effort: a released or synthetic pointer throws,
   * and the interaction still works without capture.
   *
   * @param {HTMLElement} target
   * @param {number} pointerId
   * @returns {void}
   */
  function tryCapture(target, pointerId) {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Capture is an enhancement, not a requirement.
    }
  }

  /**
   * Dispatch a cancelable context intent. The core never calls
   * `preventDefault()` on the native event; the application suppresses the
   * browser menu when it handles the intent.
   *
   * @param {Element} target
   * @param {object} detail
   * @param {Event} nativeEvent
   * @returns {void}
   */
  function dispatchContextMenu(target, detail, nativeEvent) {
    target.dispatchEvent(
      new CustomEvent("calendar:eventcontextmenu", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { ...detail, nativeEvent },
      }),
    );
  }

  /**
   * Press-and-hold for touch/pen pointers. Mouse pointers use right-click
   * instead and never arm the timer, so mouse drags are unaffected. The
   * timer is dropped on movement, release, cancel, or disconnect.
   *
   * @param {HTMLElement} target
   * @param {(press: PointerEvent) => void} onFire
   * @param {(press: PointerEvent) => boolean} [shouldIgnore] skip presses handled elsewhere (e.g. event presses bubbling to the day body)
   * @returns {void}
   */
  function watchLongPress(target, onFire, shouldIgnore) {
    let timer = 0;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    const clear = () => {
      if (timer !== 0) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    target.addEventListener("pointerdown", (nativeEvent) => {
      if (nativeEvent.pointerType === "mouse" || nativeEvent.button !== 0) return;
      if (shouldIgnore?.(nativeEvent)) return;
      pointerId = nativeEvent.pointerId;
      startX = nativeEvent.clientX;
      startY = nativeEvent.clientY;
      clear();
      timer = window.setTimeout(() => {
        timer = 0;
        if (!host.isConnected()) return;
        longPressConsumed = true;
        suppressClick = true;
        onFire(nativeEvent);
      }, LONG_PRESS_MS);
    });
    target.addEventListener("pointermove", (nativeEvent) => {
      if (timer === 0 || nativeEvent.pointerId !== pointerId) return;
      if (Math.hypot(nativeEvent.clientX - startX, nativeEvent.clientY - startY) > LONG_PRESS_PX) {
        clear();
      }
    });
    target.addEventListener("pointerup", clear);
    target.addEventListener("pointercancel", clear);
  }

  /**
   * @param {HTMLDivElement} body
   * @returns {HTMLButtonElement[]}
   */
  function focusableEvents(body) {
    const nodes = /** @type {HTMLButtonElement[]} */ ([...body.querySelectorAll(".cv-event")]);
    return nodes.sort((a, b) => Number.parseFloat(a.style.top) - Number.parseFloat(b.style.top));
  }

  /**
   * Refocus an event after an optimistic commit re-rendered the grid.
   * Rendering is async, so the host resolves the fresh node itself.
   *
   * @param {string} id
   * @returns {void}
   */
  function refocusEvent(id) {
    host.refocusEvent(id);
  }

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

  root.style.gridTemplateColumns = gridTemplate;

  if (columns.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cv-empty";
    empty.textContent = "No resources selected.";
    root.append(empty);
    fragment.append(root);
    return fragment;
  }

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
    // Day headers render one date cell per column. In resource views the
    // resource name lives in the grouped row above; the day header keeps
    // only the date (plus optional resource context for hooks).
    const headerContent = dayHeaderContent?.({
      date: column.date,
      resource: column.resource,
      element: header,
    });
    if (headerContent instanceof Node) header.append(headerContent);
    else if (headerContent != null) header.textContent = String(headerContent);
    else header.textContent = column.date.toString();
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

    const sliceOptions = { timeZone, slotMin: startMinutes, slotMax: endMinutes };

    for (const background of backgrounds) {
      if (!backgroundAppliesToColumn(background, column)) continue;
      const slice = sliceTimedEventForDay(background, column.date, sliceOptions);
      if (!slice) continue;
      const geometry = eventGeometry({
        startMinutes: slice.start,
        endMinutes: slice.end,
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

    const dayEvents = [];
    for (const event of events) {
      if (!eventBelongsToColumn(event, column)) continue;
      const slice = sliceTimedEventForDay(event, column.date, sliceOptions);
      if (!slice) continue;
      dayEvents.push({ event, start: slice.start, end: slice.end });
    }

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
      node.setAttribute("aria-label", describeEvent(event, timeZone));

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

      // A drag, resize or long-press that moved must not leak an eventclick
      // from its residual click.
      node.addEventListener(
        "click",
        (nativeEvent) => {
          if (!suppressClick) return;
          suppressClick = false;
          longPressConsumed = false;
          nativeEvent.stopPropagation();
          nativeEvent.preventDefault();
        },
        true,
      );

      const movable = isMovable(event, host.editable);
      const resizable = isResizable(event, host.editable);

      node.addEventListener("contextmenu", (nativeEvent) => {
        dispatchContextMenu(
          node,
          {
            event,
            date: column.date,
            resourceId: column.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY,
          },
          nativeEvent,
        );
      });

      watchLongPress(node, (press) => {
        dispatchContextMenu(
          node,
          {
            event,
            date: column.date,
            resourceId: column.resource?.id ?? null,
            clientX: press.clientX,
            clientY: press.clientY,
          },
          press,
        );
      });

      /**
       * Focus navigation between events. Data-changing keys reuse the same
       * optimistic commit as pointer and commands; cross-resource moves stay
       * a command operation (`moveEvent` with `resourceId`).
       *
       * @param {KeyboardEvent} keyboardEvent
       * @returns {void}
       */
      function onEventKeyDown(keyboardEvent) {
        if (keyboardEvent.ctrlKey || keyboardEvent.metaKey) return;
        const key = keyboardEvent.key;
        const shift = keyboardEvent.shiftKey;
        const alt = keyboardEvent.altKey;
        if (!shift && !alt) {
          if (
            key === "ArrowUp" ||
            key === "ArrowDown" ||
            key === "ArrowLeft" ||
            key === "ArrowRight" ||
            key === "Home" ||
            key === "End"
          ) {
            keyboardEvent.preventDefault();
            moveEventFocus(key);
          }
          return;
        }
        if (shift && !alt && key.startsWith("Arrow")) {
          if (!movable) return;
          keyboardEvent.preventDefault();
          keyboardMoveEvent(key, keyboardEvent);
          return;
        }
        if (alt && !shift && key.startsWith("Arrow")) {
          if (!resizable) return;
          keyboardEvent.preventDefault();
          keyboardResizeEvent(key, keyboardEvent);
        }
      }

      /**
       * @param {string} key
       * @returns {void}
       */
      function moveEventFocus(key) {
        const currentBody = node.closest(".cv-day-body");
        if (!(currentBody instanceof HTMLDivElement)) return;
        if (key === "ArrowUp" || key === "ArrowDown" || key === "Home" || key === "End") {
          const peers = focusableEvents(currentBody);
          const index = peers.indexOf(node);
          if (index < 0) return;
          const target =
            key === "Home"
              ? peers[0]
              : key === "End"
                ? peers[peers.length - 1]
                : peers[index + (key === "ArrowDown" ? 1 : -1)];
          target?.focus();
          return;
        }
        const bodyIndex = bodies.findIndex((entry) => entry.body === currentBody);
        const target = bodies[bodyIndex + (key === "ArrowRight" ? 1 : -1)];
        if (!target) return;
        const peers = focusableEvents(target.body);
        if (peers.length === 0) return;
        const top = Number.parseFloat(node.style.top);
        let best = peers[0];
        for (const peer of peers) {
          if (
            Math.abs(Number.parseFloat(peer.style.top) - top) <
            Math.abs(Number.parseFloat(best.style.top) - top)
          ) {
            best = peer;
          }
        }
        best.focus();
      }

      /**
       * @param {string} key
       * @param {KeyboardEvent} nativeEvent
       * @returns {void}
       */
      function keyboardMoveEvent(key, nativeEvent) {
        const startZoned = toZonedDateTime(event.start, timeZone);
        const endZoned = toZonedDateTime(event.end, timeZone);
        const previous = { start: event.start, end: event.end, resourceId: event.resourceId ?? null };
        let current;
        if (key === "ArrowUp" || key === "ArrowDown") {
          const delta = key === "ArrowDown" ? snapStep : -snapStep;
          current = {
            start: startZoned.add({ minutes: delta }),
            end: endZoned.add({ minutes: delta }),
            resourceId: event.resourceId ?? null,
          };
        } else {
          const targetDate = column.date.add({ days: key === "ArrowRight" ? 1 : -1 });
          const nextStart = zonedDateTimeAt(targetDate, wallMinutes(startZoned), timeZone);
          const duration = Temporal.Duration.from({
            milliseconds: endZoned.epochMilliseconds - startZoned.epochMilliseconds,
          });
          const nextEnd = nextStart.add(duration);
          current = { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null };
        }
        const result = host.commitEventMove({ event, previous, current, nativeEvent });
        if (!result) return;
        host.announce(describeEvent(result, timeZone));
        refocusEvent(event.id);
      }

      /**
       * Alt + arrows resize: Up/Down adjust the start edge, Left/Right the
       * end edge, keeping at least one snap step of duration.
       *
       * @param {string} key
       * @param {KeyboardEvent} nativeEvent
       * @returns {void}
       */
      function keyboardResizeEvent(key, nativeEvent) {
        const startZoned = toZonedDateTime(event.start, timeZone);
        const endZoned = toZonedDateTime(event.end, timeZone);
        let nextStart = startZoned;
        let nextEnd = endZoned;
        if (key === "ArrowUp") nextStart = startZoned.subtract({ minutes: snapStep });
        else if (key === "ArrowDown") nextStart = startZoned.add({ minutes: snapStep });
        else if (key === "ArrowLeft") nextEnd = endZoned.subtract({ minutes: snapStep });
        else nextEnd = endZoned.add({ minutes: snapStep });
        if (nextEnd.epochMilliseconds - nextStart.epochMilliseconds < snapStep * 60 * 1000) return;
        const result = host.commitEventResize({
          event,
          previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
          current: { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null },
          nativeEvent,
        });
        if (!result) return;
        host.announce(describeEvent(result, timeZone));
        refocusEvent(event.id);
      }

      node.addEventListener("keydown", onEventKeyDown);

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
        tryCapture(node, nativeEvent.pointerId);
        const savedTop = node.style.top;
        const savedHeight = node.style.height;
        const downX = nativeEvent.clientX;
        const downY = nativeEvent.clientY;
        let moved = false;
        /** @type {{ start: number, end: number } | null} */
        let pending = null;

        /** @param {PointerEvent} moveEvent @returns {void} */
        const onMove = (moveEvent) => {
          if (longPressConsumed) return;
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
          if (longPressConsumed) {
            node.style.top = savedTop;
            node.style.height = savedHeight;
            return;
          }
          if (!moved || !pending) return;
          suppressClick = true;
          const result = host.commitEventResize({
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
          // No click follows a cancel: drop both suppression flags.
          longPressConsumed = false;
          suppressClick = false;
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
        tryCapture(node, nativeEvent.pointerId);
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
          if (longPressConsumed) return;
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
          // A fired long-press owns the gesture: no commit, and the residual
          // click stays suppressed for its own capture-phase handler.
          if (longPressConsumed) return;
          if (!wasMoved || !range) return;
          // A non-droppable target reverts silently: no dispatch, no state change.
          if (!range.droppable) return;
          suppressClick = true;
          host.commitEventMove({
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
          // No click follows a cancel: drop both suppression flags.
          longPressConsumed = false;
          suppressClick = false;
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
        tryCapture(body, nativeEvent.pointerId);
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
        // A fired long-press owns the gesture: drop the pending selection and
        // keep the residual click suppressed for its own handler below.
        const wasLongPress = longPressConsumed;
        longPressConsumed = false;
        if (!selecting) return;
        const { anchor, moved, start, end } = selecting;
        selecting = null;
        ghost?.remove();
        ghost = null;
        ghostChip = null;
        if (cancelled || wasLongPress) return;
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

      body.addEventListener("contextmenu", (nativeEvent) => {
        if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-event")) {
          return;
        }
        const hit = columnHit(column, body, nativeEvent.clientX, nativeEvent.clientY);
        if (!hit) return;
        const snapped = snapMinutes(hit.minutes, snapStep, "floor");
        dispatchContextMenu(
          body,
          {
            event: null,
            date: column.date,
            time: zonedDateTimeAt(column.date, snapped, timeZone),
            resourceId: column.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY,
          },
          nativeEvent,
        );
      });

      watchLongPress(
        body,
        (press) => {
          selecting = null;
          ghost?.remove();
          ghost = null;
          ghostChip = null;
          const hit = columnHit(column, body, press.clientX, press.clientY);
          if (!hit) return;
          const snapped = snapMinutes(hit.minutes, snapStep, "floor");
          dispatchContextMenu(
            body,
            {
              event: null,
              date: column.date,
              time: zonedDateTimeAt(column.date, snapped, timeZone),
              resourceId: column.resource?.id ?? null,
              clientX: press.clientX,
              clientY: press.clientY,
            },
            press,
          );
        },
        (press) => press.target instanceof Element && press.target.closest(".cv-event") !== null,
      );
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
