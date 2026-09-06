import { Temporal } from "temporal-polyfill";
import {
  durationMinutes,
  formatClock,
  formatDayHeader,
  formatSlotLabel,
  isResourceView,
  minutesFromMidnight,
  zonedDateTimeAt,
} from "../core/dates.js";
import { defaultSnapThreshold, eventGeometry, findSnapTarget, snapMinutes } from "../core/geometry.js";
import { hitTest } from "../core/hit.js";
import { DEFAULT_LABELS } from "../core/labels.js";
import { layoutDaySegments, layoutEvents } from "../core/layout.js";
import { isMovable, isResizable } from "../core/model.js";
import {
  backgroundAppliesToColumn,
  eventBelongsToColumn,
  getResourceColumns,
  getTimeGridColumns,
} from "../core/resources.js";
import {
  describeEvent,
  eventOverlapsDate,
  sliceTimedEventForDay,
  toZonedDateTime,
  wallMinutes,
} from "../core/slicing.js";
import { temporalState } from "../core/temporal.js";
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
 * @property {(range: { start: unknown, end: unknown, resourceId?: string | null }) => import("../core/overlaps.js").RangeContext} getRangeContext canonical range context for the proposed range
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
 * @property {() => { payload: unknown, meta: import("../calendar-view.js").ExternalDropMeta } | null} getExternalDrag
 * @property {() => void} clearExternalDrag
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
 * @property {string} [locale] BCP 47 tag for default header/axis formatting; hooks stay authoritative
 * @property {import("../core/labels.js").CalendarLabels} [labels] fixed UI strings, defaulting to English
 * @property {boolean} [editable]
 * @property {Temporal.Duration | { minutes: number }} [snapDuration]
 * @property {Temporal.Duration | { minutes: number }} [defaultTimedEventDuration]
 * @property {number} [slotLabelInterval] minutes between axis labels (default 60)
 * @property {boolean} [allDaySlot] show the all-day lane when it has content (default true)
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
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @param {TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.resourceHeaderContent]
 * @param {(info: object) => unknown} [input.slotLabelContent]
 * @returns {DocumentFragment}
 */
export function renderTimeGrid({
  dates,
  resources,
  view = "week",
  events,
  backgrounds,
  options,
  now,
  host,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
  slotLabelContent,
}) {
  const fragment = document.createDocumentFragment();

  // Presentation defaults: explicit content hooks win, `locale`/`labels`
  // only feed the fallbacks.
  const locale = options.locale;
  const labels = options.labels ?? DEFAULT_LABELS;

  // Column derivation is view-driven, never inferred from resource count:
  // solo renders one column per date, resource views render resource x dates
  // (possibly zero columns when no resource is selected).
  const resourceView = isResourceView(view);
  const columns = resourceView ? getResourceColumns(resources, dates) : getTimeGridColumns(dates);
  // One axis track plus one per date column, so the all-day lane can mirror
  // the exact same tracks when it spans them.
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
  // Shared render instant: the now indicator, temporal states and interaction
  // policy all read the same value, so one render never disagrees with itself.
  const renderNow = now ?? Temporal.Now.zonedDateTimeISO(timeZone);
  /**
   * @param {import("../core/model.js").NormalizedEvent} event
   * @returns {import("../core/temporal.js").TemporalState}
   */
  const stateOf = (event) => temporalState(event.start, event.end, renderNow, timeZone);
  const snapStep = durationMinutes(options.snapDuration ?? { minutes: 15 });
  const defaultDuration = durationMinutes(options.defaultTimedEventDuration ?? { minutes: 30 });
  // Neighbor snapping (magnetism): a moving edge within half a snap step
  // (capped at 5 minutes) of another boundary in the same column uses that
  // boundary instead of the grid snap. Compared against the raw pointer
  // position so near-misses still attract.
  const snapThreshold = defaultSnapThreshold(snapStep);
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
   * Dispatch a cancelable context intent. When the application handles the
   * intent (`preventDefault()` on the dispatched event), the native browser
   * menu is suppressed; otherwise it is left alone.
   *
   * @param {Element} target
   * @param {object} detail
   * @param {Event} nativeEvent
   * @returns {void}
   */
  function dispatchContextMenu(target, detail, nativeEvent) {
    const handled = !target.dispatchEvent(
      new CustomEvent("calendar:eventcontextmenu", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { ...detail, nativeEvent },
      }),
    );
    if (handled) nativeEvent.preventDefault?.();
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
    const range = {
      start: zonedDateTimeAt(column.date, start, timeZone),
      end: zonedDateTimeAt(column.date, end, timeZone),
      resourceId: column.resource?.id ?? null,
    };
    body.dispatchEvent(
      new CustomEvent("calendar:select", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          start: range.start,
          end: range.end,
          resourceId: range.resourceId,
          context: host.getRangeContext(range),
          nativeEvent,
        },
      }),
    );
  }

  // Axis density is a policy, not a format: the interval says how often a
  // label appears, `slotLabelContent` says what it reads.
  const labelInterval = Math.max(1, options.slotLabelInterval ?? 60);
  for (let minute = startMinutes; minute <= endMinutes; minute += labelInterval) {
    const label = document.createElement("div");
    label.className = "cv-axis-label";
    label.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
    const content = slotLabelContent?.({
      time: Temporal.PlainTime.from({
        hour: Math.floor(minute / 60),
        minute: Math.floor(minute % 60),
      }),
      minutes: minute,
      element: label,
    });
    if (content instanceof Node) label.append(content);
    else label.textContent = content == null ? formatSlotLabel(minute, locale) : String(content);
    axis.append(label);
  }

  root.style.gridTemplateColumns = gridTemplate;

  if (columns.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cv-empty";
    empty.textContent = labels.noResources;
    root.append(empty);
    fragment.append(root);
    return fragment;
  }

  // --- All-day lane -------------------------------------------------------
  // Timed events and civil all-day events are separate planes. The lane uses
  // the same columns as the time grid, so a bar spans civil days inside its
  // resource block and never crosses into the neighbouring room.
  /**
   * @param {{ start: unknown, end: unknown, allDay?: boolean }} range
   * @returns {boolean}
   */
  const overVisibleDays = (range) => dates.some((date) => eventOverlapsDate(range, date, timeZone));

  /**
   * Column span of one all-day range on the shared column grid.
   *
   * @param {{
   *   start: unknown, end: unknown, resourceId?: string | null,
   *   allDay?: boolean,
   * }} range
   * @returns {{ startDay: number, endDay: number } | null}
   */
  const daySpan = (range) => {
    let start = -1;
    let end = -1;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const applies =
        "resourceId" in range
          ? eventBelongsToColumn(range, column)
          : backgroundAppliesToColumn(range, column);
      if (!applies || !eventOverlapsDate(range, column.date, timeZone)) continue;
      if (start < 0) start = index;
      end = index;
    }
    if (start < 0) return null;
    return { startDay: start, endDay: end + 1 };
  };

  const allDaySegments = events
    .filter((event) => event.allDay === true && overVisibleDays(event))
    .map((event) => {
      const span = daySpan(event);
      return span === null
        ? null
        : { event, resourceId: event.resourceId ?? null, startDay: span.startDay, endDay: span.endDay };
    })
    .filter((segment) => segment !== null);
  const allDayBackgroundSegments = backgrounds
    .filter((background) => background.allDay === true && overVisibleDays(background))
    .map((background) => {
      const span = daySpan(background);
      return span === null ? null : { background, startDay: span.startDay, endDay: span.endDay };
    })
    .filter((segment) => segment !== null);

  const showAllDay =
    options.allDaySlot !== false && (allDaySegments.length > 0 || allDayBackgroundSegments.length > 0);
  /** @type {Array<{ bar: HTMLButtonElement, event: import("../core/model.js").NormalizedEvent, startDay: number, endDay: number }>} */
  const allDayBars = [];

  /**
   * Column under a pointer x-coordinate, or the first column when the pointer
   * is over the axis gutter. Read after render, when `bodies` is populated.
   *
   * @param {number} clientX
   * @returns {TimeGridColumn}
   */
  const columnAtX = (clientX) => {
    for (let index = 0; index < bodies.length; index += 1) {
      const rect = bodies[index].body.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return columns[index];
    }
    return columns[0];
  };

  /** @param {number} clientX @returns {number} */
  const columnIndexAtX = (clientX) => {
    for (let index = 0; index < bodies.length; index += 1) {
      const rect = bodies[index].body.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return index;
    }
    return -1;
  };

  /**
   * Day-preserving move of one all-day bar, shared by pointer drag and
   * Shift+arrows. Boundaries stay `Temporal.PlainDate`, so both commute
   * through the same optimistic commit as every other move.
   *
   * @param {import("../core/model.js").NormalizedEvent} evt
   * @param {number} days
   * @param {string | null} resourceId
   * @param {Event | null} nativeEvent
   * @returns {import("../core/model.js").NormalizedEvent | null}
   */
  const commitAllDayMove = (evt, days, resourceId, nativeEvent) => {
    if (!(evt.start instanceof Temporal.PlainDate)) return null;
    const start = /** @type {Temporal.PlainDate} */ (evt.start);
    const end = /** @type {Temporal.PlainDate} */ (evt.end);
    return host.commitEventMove({
      event: evt,
      previous: { start: evt.start, end: evt.end, resourceId: evt.resourceId ?? null },
      current: { start: start.add({ days }), end: end.add({ days }), resourceId },
      nativeEvent,
    });
  };

  /**
   * Pointer drag of an all-day bar: day-snapped, whole span preserved, can
   * cross resources. The original bar stays put while a mirror follows the
   * pointer; a non-droppable target reverts silently.
   *
   * @param {HTMLButtonElement} bar
   * @param {import("../core/model.js").NormalizedEvent} event
   * @param {number} startDay
   * @param {number} endDay
   * @param {PointerEvent} nativeEvent
   * @returns {void}
   */
  function beginAllDayDrag(bar, event, startDay, endDay, nativeEvent) {
    if (nativeEvent.button !== 0) return;
    tryCapture(bar, nativeEvent.pointerId);
    const downX = nativeEvent.clientX;
    const downY = nativeEvent.clientY;
    let moved = false;
    /** @type {HTMLButtonElement | null} */
    let mirror = null;
    /** @type {{ index: number, droppable: boolean } | null} */
    let pending = null;

    /** @param {PointerEvent} moveEvent @returns {void} */
    const onMove = (moveEvent) => {
      if (longPressConsumed) return;
      if (Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= 4) moved = true;
      if (!moved) return;
      if (!mirror) {
        mirror = /** @type {HTMLButtonElement} */ (bar.cloneNode(true));
        mirror.classList.add("cv-drag-mirror");
        mirror.tabIndex = -1;
        mirror.setAttribute("aria-hidden", "true");
        bar.classList.add("cv-drag-source");
        lane.append(mirror);
      }
      const index = columnIndexAtX(moveEvent.clientX);
      if (index < 0) return;
      const droppable = columns[index].resource?.droppable !== false;
      pending = { index, droppable };
      mirror.style.gridColumn = `${index + 2} / ${Math.min(columns.length, index + (endDay - startDay)) + 2}`;
      mirror.style.gridRow = String(Number.parseFloat(bar.style.gridRow) || 1);
      mirror.classList.toggle("cv-invalid", !droppable);
    };

    const cleanup = () => {
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
      bar.removeEventListener("pointercancel", onCancel);
      mirror?.remove();
      bar.classList.remove("cv-drag-source");
    };

    /** @param {PointerEvent} upEvent @returns {void} */
    const onUp = (upEvent) => {
      const wasMoved = moved;
      const range = pending;
      cleanup();
      if (longPressConsumed) return;
      if (!wasMoved || !range?.droppable) return;
      suppressClick = true;
      const dayDelta = range.index - startDay;
      const resourceId = columns[range.index].resource?.id ?? null;
      const next = commitAllDayMove(event, dayDelta, resourceId, upEvent);
      if (next) {
        host.announce(describeEvent(next, timeZone, labels.untitledEvent));
        host.refocusEvent(event.id);
      }
    };

    /** @param {PointerEvent} _cancelEvent @returns {void} */
    const onCancel = (_cancelEvent) => {
      cleanup();
      longPressConsumed = false;
      suppressClick = false;
    };

    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp);
    bar.addEventListener("pointercancel", onCancel);
  }

  const lane = document.createElement("div");
  lane.className = "cv-allday";
  lane.style.gridTemplateColumns = gridTemplate;
  lane.style.gridColumn = "1 / -1";
  lane.style.gridRow = "2";
  if (showAllDay) {
    const corner = document.createElement("span");
    corner.className = "cv-allday-corner";
    corner.textContent = labels.allDaySlotLabel;
    corner.setAttribute("aria-hidden", "true");
    lane.append(corner);
    for (const tint of allDayBackgroundSegments) {
      const node = document.createElement("div");
      node.className = ["cv-allday-background", ...(tint.background.classNames ?? [])].join(" ");
      node.style.gridColumn = `${tint.startDay + 2} / ${tint.endDay + 2}`;
      node.style.gridRow = "1 / -1";
      lane.append(node);
    }
    for (const segment of layoutDaySegments(allDaySegments)) {
      const { event, startDay, endDay } = segment;
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = ["cv-allday-event", ...(event.classNames ?? [])].join(" ");
      bar.dataset.eventId = event.id;
      const barState = stateOf(event);
      bar.dataset.temporalState = barState;
      bar.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));
      bar.style.gridColumn = `${startDay + 2} / ${endDay + 2}`;
      bar.style.gridRow = String(segment.row + 1);
      const column = columns[startDay];
      const content = eventContent?.({
        event,
        date: column.date,
        resource: column.resource,
        temporalState: barState,
        element: bar,
      });
      if (content instanceof Node) bar.append(content);
      else if (content != null) bar.textContent = String(content);
      else bar.textContent = event.title ?? labels.untitledEvent;
      lane.append(bar);
      allDayBars.push({ bar, event, startDay, endDay });

      // --- All-day interactions (v1) ---------------------------------------
      // Native <button> activation covers pointer click and Enter/Space; a
      // single capture-phase handler both dispatches eventclick and drops the
      // residual click after a drag or long-press. Day-edge resize, creation
      // inside the lane and timed<->all-day conversion stay deferred.
      bar.addEventListener(
        "click",
        (nativeEvent) => {
          if (suppressClick) {
            suppressClick = false;
            longPressConsumed = false;
            nativeEvent.stopPropagation();
            nativeEvent.preventDefault();
            return;
          }
          const target = columnAtX(nativeEvent.clientX);
          bar.dispatchEvent(
            new CustomEvent("calendar:eventclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { event, date: target.date, resource: target.resource, nativeEvent },
            }),
          );
        },
        true,
      );

      bar.addEventListener("contextmenu", (nativeEvent) => {
        const target = columnAtX(nativeEvent.clientX);
        dispatchContextMenu(
          bar,
          {
            event,
            date: target.date,
            resourceId: target.resource?.id ?? null,
            clientX: nativeEvent.clientX,
            clientY: nativeEvent.clientY,
          },
          nativeEvent,
        );
      });

      watchLongPress(bar, (press) => {
        const target = columnAtX(press.clientX);
        dispatchContextMenu(
          bar,
          {
            event,
            date: target.date,
            resourceId: target.resource?.id ?? null,
            clientX: press.clientX,
            clientY: press.clientY,
          },
          press,
        );
      });

      const movable = isMovable(event, host.editable);

      bar.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.ctrlKey || keyboardEvent.metaKey || !keyboardEvent.shiftKey) return;
        const key = keyboardEvent.key;
        if (key !== "ArrowLeft" && key !== "ArrowRight") return;
        if (!movable) return;
        keyboardEvent.preventDefault();
        const next = commitAllDayMove(
          event,
          key === "ArrowRight" ? 1 : -1,
          event.resourceId ?? null,
          keyboardEvent,
        );
        if (next) host.announce(describeEvent(next, timeZone, labels.untitledEvent));
      });

      if (movable) {
        bar.addEventListener("pointerdown", (nativeEvent) =>
          beginAllDayDrag(bar, event, startDay, endDay, nativeEvent),
        );
      }
    }
  }

  // --- Day header row -----------------------------------------------------
  // Headers are grid items of their own row so the lane can sit between the
  // sticky headers and the scrolling time bodies.
  let headerColumn = 2;
  for (const column of columns) {
    const header = document.createElement("header");
    header.className = "cv-day-header";
    header.style.gridColumn = String(headerColumn);
    header.style.gridRow = "1";
    headerColumn += 1;
    const content = dayHeaderContent?.({
      date: column.date,
      resource: column.resource,
      element: header,
    });
    if (content instanceof Node) header.append(content);
    else if (content != null) header.textContent = String(content);
    else header.textContent = formatDayHeader(column.date, locale);
    root.append(header);
  }

  if (showAllDay) root.append(lane);

  // Explicit row/column placement for the axis too, so it never auto-places
  // into the header or lane row.
  axis.style.gridColumn = "1";
  axis.style.gridRow = showAllDay ? "3" : "2";

  /** @type {Array<{ column: TimeGridColumn, body: HTMLDivElement }>} */
  const bodies = [];
  // Per-column slice boundaries feeding neighbor snapping. Parallel to
  // `columns`/`bodies`; filled during the column loop, consumed by pointer
  // handlers that all run after the loop finished.
  /** @type {Array<{ events: Array<{ event: import("../core/model.js").NormalizedEvent, start: number, end: number }>, backgrounds: Array<{ start: number, end: number }> }>} */
  const columnSlices = [];

  /**
   * Neighbor boundaries of one column, optionally excluding a dragged or
   * resized event's own edges so the gesture does not stick to its origin.
   *
   * @param {number} index
   * @param {string | null} [excludeId]
   * @returns {number[]}
   */
  function columnEdges(index, excludeId = null) {
    const slices = columnSlices[index];
    if (!slices) return [];
    const edges = [];
    for (const item of slices.events) {
      if (excludeId != null && item.event.id === excludeId) continue;
      edges.push(item.start, item.end);
    }
    for (const slice of slices.backgrounds) edges.push(slice.start, slice.end);
    return edges;
  }

  /**
   * Raw pointer position with neighbor magnetism, falling back to the grid
   * snap when nothing is close enough.
   *
   * @param {number} raw minutes from midnight at the pointer
   * @param {"round" | "floor" | "ceil"} mode grid snap fallback
   * @param {number[]} edges neighbor boundaries
   * @returns {number}
   */
  function magnetOrSnap(raw, mode, edges) {
    return findSnapTarget(raw, edges, snapThreshold) ?? snapMinutes(raw, snapStep, mode);
  }

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

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const day = document.createElement("section");
    day.className = "cv-day";
    day.dataset.date = column.date.toString();
    day.style.gridColumn = String(columnIndex + 2);
    day.style.gridRow = showAllDay ? "3" : "2";
    if (column.resource) day.dataset.resourceId = column.resource.id;

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

    /** @type {Array<{ start: number, end: number }>} */
    const backgroundSlices = [];
    for (const background of backgrounds) {
      if (background.allDay === true) continue;
      if (!backgroundAppliesToColumn(background, column)) continue;
      const slice = sliceTimedEventForDay(background, column.date, sliceOptions);
      if (!slice) continue;
      backgroundSlices.push(slice);
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
      if (event.allDay === true) continue;
      if (!eventBelongsToColumn(event, column)) continue;
      const slice = sliceTimedEventForDay(event, column.date, sliceOptions);
      if (!slice) continue;
      dayEvents.push({ event, start: slice.start, end: slice.end });
    }
    columnSlices.push({ events: dayEvents, backgrounds: backgroundSlices });

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
      const nodeState = stateOf(event);
      node.dataset.temporalState = nodeState;
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      node.style.insetInlineStart = `${item.left * 100}%`;
      node.style.width = `${item.width * 100}%`;
      node.setAttribute("aria-label", describeEvent(event, timeZone, labels.untitledEvent));

      const content = eventContent?.({
        event,
        date: column.date,
        resource: column.resource,
        temporalState: nodeState,
        element: node,
      });
      if (content instanceof Node) node.append(content);
      else node.textContent = content == null ? (event.title ?? labels.untitledEvent) : String(content);

      // Native <button> activation covers pointer click and Enter/Space equally.
      // A single capture-phase handler both dispatches eventclick and drops
      // the residual click after a drag, resize or long-press.
      node.addEventListener(
        "click",
        (nativeEvent) => {
          if (suppressClick) {
            suppressClick = false;
            longPressConsumed = false;
            nativeEvent.stopPropagation();
            nativeEvent.preventDefault();
            return;
          }
          node.dispatchEvent(
            new CustomEvent("calendar:eventclick", {
              bubbles: true,
              composed: true,
              cancelable: true,
              detail: { event, date: column.date, resource: column.resource, nativeEvent },
            }),
          );
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
        host.announce(describeEvent(result, timeZone, labels.untitledEvent));
        host.refocusEvent(event.id);
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
        host.announce(describeEvent(result, timeZone, labels.untitledEvent));
        host.refocusEvent(event.id);
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
          const edges = columnEdges(columnIndex, event.id);
          let start = item.start;
          let end = item.end;
          if (edge === "end") {
            end = Math.max(magnetOrSnap(hit.minutes, "ceil", edges), start + snapStep);
          } else {
            start = Math.min(magnetOrSnap(hit.minutes, "floor", edges), end - snapStep);
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
          // A slice edge clipped by a day boundary is not the true event
          // edge: resizing it would truncate the multi-day span. Only the
          // first day owns the start edge and only the last day owns the
          // end edge.
          const startZoned = toZonedDateTime(event.start, timeZone);
          const endZoned = toZonedDateTime(event.end, timeZone);
          const isFirstDay = Temporal.PlainDate.compare(column.date, startZoned.toPlainDate()) === 0;
          const isLastDay = Temporal.PlainDate.compare(column.date, endZoned.toPlainDate()) === 0;
          if ((edge === "start" && !isFirstDay) || (edge === "end" && !isLastDay)) {
            node.style.top = savedTop;
            node.style.height = savedHeight;
            return;
          }
          suppressClick = true;
          const nextStart =
            edge === "start" ? zonedDateTimeAt(column.date, pending.start, timeZone) : startZoned;
          const nextEnd = edge === "end" ? zonedDateTimeAt(column.date, pending.end, timeZone) : endZoned;
          if (Temporal.ZonedDateTime.compare(nextEnd, nextStart) <= 0) {
            node.style.top = savedTop;
            node.style.height = savedHeight;
            suppressClick = false;
            return;
          }
          const result = host.commitEventResize({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: {
              start: nextStart,
              end: nextEnd,
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
          // Outside every column the drag arms "drop out of the calendar":
          // the application lights its parking target while the pointer
          // hovers the grid edge (axis strip included).
          if (hit) node.removeAttribute("data-dropout");
          else node.setAttribute("data-dropout", "true");
          if (!hit) return;
          const raw = hit.minutes - grabOffset;
          const target = bodies[hit.column];
          const start = Math.min(
            Math.max(magnetOrSnap(raw, "floor", columnEdges(hit.column, event.id)), startMinutes),
            endMinutes - duration,
          );
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
          node.removeAttribute("data-dropout");
        };

        /** @param {PointerEvent} upEvent @returns {void} */
        const onUp = (upEvent) => {
          const wasMoved = moved;
          const range = pending;
          cleanup();
          // A fired long-press owns the gesture: no commit, and the residual
          // click stays suppressed for its own capture-phase handler.
          if (longPressConsumed) return;
          if (!wasMoved) return;
          // Released outside every column: the event leaves the grid — that
          // is a parking intent the application may feed its workbench
          // ("drag out of the calendar"). The commit below only runs when
          // the release itself is over a column.
          if (!gridHit(upEvent.clientX, upEvent.clientY)) {
            // Same as a committed drop: the residual click on the source card
            // must not fall through to `calendar:eventclick`.
            suppressClick = true;
            root.dispatchEvent(
              new CustomEvent("calendar:eventdropout", {
                bubbles: true,
                composed: true,
                cancelable: true,
                detail: { event, eventId: event.id, nativeEvent: upEvent },
              }),
            );
            return;
          }
          if (!range) return;
          if (!range.droppable) return;
          suppressClick = true;
          // The mirror shows the dragged slice, but the commit shifts the
          // whole event so multi-day spans keep their total duration (same
          // contract as the keyboard move path).
          const dayDelta = range.column.date.since(column.date).days;
          const minuteDelta = range.start - item.start;
          const startZoned = toZonedDateTime(event.start, timeZone);
          const endZoned = toZonedDateTime(event.end, timeZone);
          host.commitEventMove({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: {
              start: startZoned.add({ days: dayDelta, minutes: minuteDelta }),
              end: endZoned.add({ days: dayDelta, minutes: minuteDelta }),
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
        const anchor = magnetOrSnap(hit.minutes, "floor", columnEdges(columnIndex));
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
        const edges = columnEdges(columnIndex);
        const start = magnetOrSnap(Math.min(selecting.anchor, hit.minutes), "floor", edges);
        const end = Math.max(
          magnetOrSnap(Math.max(selecting.anchor, hit.minutes), "ceil", edges),
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

    const now = renderNow;
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

  // --- External placement (drag from an application source) ----------------
  // The core knows geometry, never policy: it resolves the structural target
  // from the pointer, draws a ghost with the real duration, and hands the
  // anchor to the application on drop. `meta.validate` may forbid the target.
  /** @type {{ kind: "grid" | "lane", node: HTMLElement } | null} */
  let externalGhost = null;

  /** @returns {void} */
  function removeExternalGhost() {
    externalGhost?.node.remove();
    externalGhost = null;
  }

  /**
   * Structural + application-policy validity of one external target. Only
   * incontestable geometry is judged by the core; `meta.validate` adds the
   * application's own refusal (`false` or a reason string).
   *
   * @param {Temporal.PlainDate} date
   * @param {Temporal.ZonedDateTime | null} time
   * @param {string | null} resourceId
   * @param {boolean} allDay
   * @param {boolean} droppable
   * @returns {{ ok: boolean, reason: string | null }}
   */
  function externalTargetValidity(date, time, resourceId, allDay, droppable) {
    if (!droppable) return { ok: false, reason: null };
    const external = host.getExternalDrag();
    const result = external?.meta.validate?.({ date, time, resourceId, allDay });
    if (result === false) return { ok: false, reason: null };
    if (typeof result === "string") return { ok: false, reason: result };
    return { ok: true, reason: null };
  }

  /**
   * Resolve an external placement from pointer coordinates.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{
   *   kind: "grid",
   *   index: number,
   *   start: number,
   *   end: number,
   *   time: Temporal.ZonedDateTime,
   *   target: { date: Temporal.PlainDate, time: Temporal.ZonedDateTime, resourceId: string | null, allDay: boolean },
   *   ok: boolean,
   *   reason: string | null,
   * } | {
   *   kind: "lane",
   *   index: number,
   *   target: { date: Temporal.PlainDate, time: null, resourceId: string | null, allDay: boolean },
   *   ok: boolean,
   *   reason: string | null,
   * } | null}
   */
  function resolveExternal(clientX, clientY) {
    const external = host.getExternalDrag();
    if (!external) return null;
    const meta = external.meta;
    if (meta.allDay === true || (columnIndexAtX(clientX) >= 0 && isOverLane(clientY))) {
      const index = columnIndexAtX(clientX);
      if (index < 0) return null;
      const column = columns[index];
      const resourceId = column.resource?.id ?? null;
      const validity = externalTargetValidity(
        column.date,
        null,
        resourceId,
        true,
        column.resource?.droppable !== false,
      );
      return {
        kind: "lane",
        index,
        target: { date: column.date, time: null, resourceId, allDay: true },
        ok: validity.ok,
        reason: validity.reason,
      };
    }
    const hit = gridHit(clientX, clientY);
    if (!hit) return null;
    const rawDuration = meta.duration ?? options.defaultTimedEventDuration ?? { minutes: 30 };
    const duration = durationMinutes(
      typeof rawDuration === "number" ? { minutes: rawDuration } : rawDuration,
    );
    if (duration > endMinutes - startMinutes) return null;
    const start = Math.max(
      startMinutes,
      Math.min(snapMinutes(hit.minutes, snapStep, "floor"), endMinutes - duration),
    );
    if (start < startMinutes) return null;
    const end = start + duration;
    const column = columns[hit.column];
    const time = zonedDateTimeAt(column.date, start, timeZone);
    const resourceId = column.resource?.id ?? null;
    const validity = externalTargetValidity(
      column.date,
      time,
      resourceId,
      false,
      column.resource?.droppable !== false,
    );
    return {
      kind: "grid",
      index: hit.column,
      start,
      end,
      time,
      target: { date: column.date, time, resourceId, allDay: false },
      ok: validity.ok,
      reason: validity.reason,
    };
  }

  /** @param {number} clientY */
  function isOverLane(clientY) {
    const rect = lane.getBoundingClientRect();
    return rect.height > 0 && clientY >= rect.top && clientY <= rect.bottom;
  }

  /**
   * Paint (or clear) the placement ghost. Structural or policy invalidity
   * marks it `cv-invalid` instead of hiding the target.
   *
   * @param {ReturnType<typeof resolveExternal>} placement
   * @returns {void}
   */
  function paintExternalGhost(placement) {
    removeExternalGhost();
    const external = host.getExternalDrag();
    if (!placement) return;
    let node;
    if (placement.kind === "grid") {
      node = document.createElement("div");
      node.className = "cv-external-ghost";
      node.setAttribute("aria-hidden", "true");
      node.style.top = `${(placement.start - startMinutes) * pxPerMinute}px`;
      node.style.height = `${(placement.end - placement.start) * pxPerMinute}px`;
      if (external?.meta.title) {
        const label = document.createElement("span");
        label.className = "cv-external-ghost-label";
        label.textContent = external.meta.title;
        node.append(label);
      }
      bodies[placement.index].body.append(node);
    } else {
      node = document.createElement("div");
      node.className = "cv-external-ghost cv-external-ghost-lane";
      node.setAttribute("aria-hidden", "true");
      node.style.gridColumn = `${placement.index + 2} / ${placement.index + 3}`;
      node.style.gridRow = "1 / -1";
      if (external?.meta.title) node.textContent = external.meta.title;
      lane.append(node);
    }
    if (!placement.ok) {
      node.classList.add("cv-invalid");
      if (placement.reason) node.dataset.reason = placement.reason;
    }
    externalGhost = { kind: placement.kind, node };
  }

  root.addEventListener("dragover", (event) => {
    if (!host.getExternalDrag()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    paintExternalGhost(resolveExternal(event.clientX, event.clientY));
  });

  root.addEventListener("dragleave", (event) => {
    if (!host.getExternalDrag()) return;
    const related = event.relatedTarget;
    if (related instanceof Node && root.contains(related)) return;
    removeExternalGhost();
  });

  root.addEventListener("drop", (event) => {
    const external = host.getExternalDrag();
    if (!external) return;
    event.preventDefault();
    const placement = resolveExternal(event.clientX, event.clientY);
    removeExternalGhost();
    if (!placement?.ok) return;
    // `context` covers the range the ghost previewed and validated: the real
    // external duration for timed drops, the civil day for lane drops. If a
    // lane drop ever gains a multi-day civil duration, this follows that
    // preview instead of staying one day.
    const contextRange =
      placement.kind === "grid"
        ? {
            start: placement.time,
            end: placement.time.add({ minutes: placement.end - placement.start }),
            resourceId: placement.target.resourceId,
          }
        : {
            start: placement.target.date,
            end: placement.target.date.add({ days: 1 }),
            resourceId: placement.target.resourceId,
          };
    root.dispatchEvent(
      new CustomEvent("calendar:externaldrop", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          payload: external.payload,
          date: placement.target.date,
          ...(placement.kind === "grid"
            ? { time: placement.target.time, resourceId: placement.target.resourceId }
            : { resourceId: placement.target.resourceId, allDay: true }),
          context: host.getRangeContext(contextRange),
          nativeEvent: event,
        },
      }),
    );
  });

  fragment.append(root);
  return fragment;
}
