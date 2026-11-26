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
import { isMovable, isResizable } from "../core/model.js";
import {
  eventBelongsToColumn,
  getResourceColumns,
  getTimeGridColumns,
  groupResources,
} from "../core/resources.js";
import { describeEvent, sliceTimedEventForDay, toZonedDateTime } from "../core/slicing.js";
import { temporalState } from "../core/temporal.js";
import { deriveTimedColumn } from "../core/time-grid-model.js";
import { createAllDayLane } from "./all-day-lane.js";
import { createAutoscroller } from "./autoscroll.js";
import { applyContent, dispatchContextMenu, elementAtPoint, emitCalendarEvent } from "./dom.js";
import { bindExternalPlacement } from "./external-placement.js";
import { startNowIndicator } from "./now-indicator.js";
import { startPointerGesture } from "./pointer-gesture.js";

/**
 * @typedef {object} ExternalDropTarget
 * @property {(x: number, y: number) => void} move
 * @property {(event: PointerEvent) => void} drop
 * @property {() => void} clear
 */

/**
 * Narrow host seam between the element and the renderer. The grid never
 * touches element internals: the class injects bound callbacks, so its own
 * state and helpers can stay truly private (`#field`).
 *
 * @typedef {object} TimeGridHost
 * @property {(cleanup: () => void) => void} setNowIndicatorCleanup
 * @property {boolean} [editable]
 * @property {() => boolean} isConnected
 * @property {(message: string) => void} announce
 * @property {(id: string) => void} refocusEvent
 * @property {(range: { start: unknown, end: unknown, resourceId?: string | null }) => import("../core/overlaps.js").RangeContext} getRangeContext canonical range context for the proposed range
 * @property {(input: {
 *   action: "select" | "move" | "resize" | "external",
 *   event: import("../core/model.js").NormalizedEvent | null,
 *   start: unknown,
 *   end: unknown,
 *   resourceId: string | null,
 *   allDay?: boolean,
 * }) => import("../core/policy.js").PolicyDecision} checkInteraction synchronous policy gate for user-originated interactions
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
 * @property {() => number} getInteractionRevision changes when canonical state or configuration changes
 * @property {(target: ExternalDropTarget) => void} setExternalDropTarget register pointer placement callbacks for this rendered grid
 * @property {() => { start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime, resourceId: string | null, reason: string | null } | null} getPreview application-proposed range overlay, or null
 */

/** @typedef {import("../core/resources.js").TimeGridColumn} TimeGridColumn */

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
 */

/**
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").CalendarResource[]} input.resources
 * @param {string} [input.view] view name; resource columns derive only when it is a resource view
 * @param {import("../core/model.js").CalendarResourceGroup[]} [input.resourceGroups] one-level visual grouping; group order wins over the `resources` array order
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {TimeGridOptions} input.options
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @param {TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.resourceHeaderContent]
 * @param {(info: object) => unknown} [input.resourceGroupContent]
 * @param {(info: object) => unknown} [input.slotLabelContent]
 * @returns {{ fragment: DocumentFragment, update: (events: import("../core/model.js").NormalizedEvent[], now: Temporal.ZonedDateTime) => boolean, dispose: () => void }}
 */
export function renderTimeGrid({
  dates,
  resources,
  view = "week",
  resourceGroups,
  events,
  backgrounds,
  options,
  now,
  host,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
  resourceGroupContent,
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
  // Grouping is a visual derivation, never canonical state: sections and the
  // ordered resource list are computed once here and consumed by both the
  // group/resource rows and the column list, so headers and hit testing
  // always agree on the rendered order.
  const sections = resourceView ? groupResources(resources, resourceGroups) : [];
  const orderedResources =
    resourceView && sections.length > 0 ? sections.flatMap((section) => section.resources) : resources;
  const columns = resourceView ? getResourceColumns(orderedResources, dates) : getTimeGridColumns(dates);
  // One axis track plus one per date column, so the all-day lane can mirror
  // the exact same tracks when it spans them. The axis width is authored CSS
  // (`--calendar-axis-size`); the renderer only names the track.
  const gridTemplate = `var(--calendar-axis-size) repeat(${Math.max(1, columns.length)}, minmax(var(--calendar-column-min), 1fr))`;

  /** @param {number} clientX @returns {number} */
  const columnIndexAtX = (clientX) => {
    for (let index = 0; index < bodies.length; index += 1) {
      const rect = bodies[index].body.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return index;
    }
    return -1;
  };

  // Grouped resource headers row: one header per group spanning its member
  // columns, above the resource row. Rendered only when at least one real
  // (non-empty) group exists — ungrouped trailing columns get no header, and
  // `resourceGroups` configured with no matching resource reserves no space.
  // Solo views render no group or resource row at all.
  if (resourceView) {
    const declaredSections = sections.filter((section) => section.group != null);
    if (declaredSections.length > 0) {
      const groupRow = document.createElement("div");
      groupRow.className = "cv-group-row";
      groupRow.style.gridTemplateColumns = gridTemplate;
      const corner = document.createElement("div");
      corner.className = "cv-group-corner";
      corner.setAttribute("aria-hidden", "true");
      groupRow.append(corner);
      for (const section of declaredSections) {
        const group = /** @type {{ id: string, title?: string }} */ (section.group);
        const header = document.createElement("div");
        header.className = "cv-group-header";
        header.dataset.groupId = group.id;
        header.style.gridColumn = `span ${Math.max(1, section.resources.length * dates.length)}`;
        const custom = resourceGroupContent?.({ group, resources: section.resources, element: header });
        if (!applyContent(header, custom)) header.textContent = group.title ?? group.id;
        groupRow.append(header);
      }
      fragment.append(groupRow);
    }
    const resourceRow = document.createElement("div");
    resourceRow.className = "cv-resource-row";
    resourceRow.style.gridTemplateColumns = gridTemplate;
    const corner = document.createElement("div");
    corner.className = "cv-resource-corner";
    corner.setAttribute("aria-hidden", "true");
    resourceRow.append(corner);
    for (const resource of orderedResources) {
      const header = document.createElement("div");
      header.className = "cv-resource-header";
      header.dataset.resourceId = resource.id;
      header.style.gridColumn = `span ${Math.max(1, dates.length)}`;
      const custom = resourceHeaderContent?.({ resource, dates, element: header });
      if (!applyContent(header, custom)) header.textContent = resource.title ?? resource.id;
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
  let renderNow = now ?? Temporal.Now.zonedDateTimeISO(timeZone);
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
  // Shared by timed and all-day interactions so a long press or a committed
  // gesture suppresses exactly one residual click across both planes.
  const interaction = { suppressClick: false, longPressConsumed: false };

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
        interaction.longPressConsumed = true;
        interaction.suppressClick = true;
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
    target.addEventListener("lostpointercapture", clear);
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
    if (!host.checkInteraction({ action: "select", event: null, ...range }).ok) return;
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
    if (!applyContent(label, content)) label.textContent = formatSlotLabel(minute, locale);
    axis.append(label);
  }

  root.style.gridTemplateColumns = gridTemplate;

  if (columns.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cv-empty";
    empty.textContent = labels.noResources;
    root.append(empty);
    fragment.append(root);
    return { fragment, update: () => false, dispose: () => {} };
  }

  // --- All-day lane -------------------------------------------------------
  // Timed events and civil all-day events are separate planes. The lane uses
  // the same columns as the time grid, so a bar spans civil days inside its
  // resource block and never crosses into the neighbouring room.
  const allDay =
    options.allDaySlot === false
      ? { lane: document.createElement("div"), hasContent: false, dispose: () => {} }
      : createAllDayLane({
          columns,
          dates,
          events,
          backgrounds,
          resourceView,
          timeZone,
          labels,
          gridTemplate,
          host,
          eventContent,
          stateOf,
          interaction,
          columnIndexAtX,
          watchLongPress,
        });
  const lane = allDay.lane;
  const showAllDay = options.allDaySlot !== false && allDay.hasContent;

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
    if (!applyContent(header, content)) header.textContent = formatDayHeader(column.date, locale);
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
  /** @type {Array<ReturnType<typeof deriveTimedColumn>>} */
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
   * Resolve the day body that the browser exposes at this point. A body's
   * client rect also covers areas clipped by the scroller or hidden under
   * sticky headers. Those areas cannot receive a timed drop.
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  function gridHit(clientX, clientY) {
    const body = elementAtPoint(root, clientX, clientY)?.closest(".cv-day-body");
    const index = bodies.findIndex((entry) => entry.body === body);
    if (index < 0) return null;
    const target = bodies[index];
    const hit = columnHit(target.column, target.body, clientX, clientY);
    return hit ? { ...hit, column: index } : null;
  }

  /** @type {Map<string, { node: HTMLButtonElement, event: import("../core/model.js").NormalizedEvent, state: import("../core/temporal.js").TemporalState }>} */
  let eventNodes = new Map();
  /** @type {Map<HTMLElement, () => void>} */
  const gestureDisposers = new Map();
  let previousEvents = events;

  /**
   * @param {import("../core/model.js").NormalizedEvent} event
   * @param {import("../core/resources.js").TimeGridColumn} column
   */
  const segmentKey = (event, column) =>
    JSON.stringify([event.id, column.date.toString(), column.resource?.id ?? null]);

  /**
   * Build one timed segment node and its interaction handlers. The caller
   * owns insertion and reconciliation so a kept node can update geometry
   * without losing focus or custom content.
   *
   * @param {HTMLDivElement} body
   * @param {import("../core/resources.js").TimeGridColumn} column
   * @param {number} columnIndex
   * @param {{ event: import("../core/model.js").NormalizedEvent, start: number, end: number, left: number, width: number, geometry: { top: number, height: number } }} item
   * @returns {HTMLButtonElement}
   */
  function createTimedEventNode(body, column, columnIndex, item) {
    const { event, geometry } = item;
    const node = document.createElement("button");
    node.type = "button";
    node.className = ["cv-event", ...(event.classNames ?? [])].join(" ");
    node.dataset.eventId = event.id;
    node.dataset.focusKey = JSON.stringify([event.id, column.date.toString(), column.resource?.id ?? null]);
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
    if (!applyContent(node, content)) node.textContent = event.title ?? labels.untitledEvent;

    // Native <button> activation covers pointer click and Enter/Space equally.
    // A single capture-phase handler both dispatches eventclick and drops
    // the residual click after a drag, resize or long-press.
    node.addEventListener(
      "click",
      (nativeEvent) => {
        if (interaction.suppressClick) {
          interaction.suppressClick = false;
          interaction.longPressConsumed = false;
          nativeEvent.stopPropagation();
          nativeEvent.preventDefault();
          return;
        }
        emitCalendarEvent(
          node,
          "calendar:eventclick",
          { event, date: column.date, resource: column.resource, nativeEvent },
          { cancelable: true },
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
        const nextStart = startZoned.add({ days: key === "ArrowRight" ? 1 : -1 });
        const duration = Temporal.Duration.from({
          milliseconds: endZoned.epochMilliseconds - startZoned.epochMilliseconds,
        });
        const nextEnd = nextStart.add(duration);
        current = { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null };
      }
      // Keyboard moves obey the policy like pointer drags: a refusal
      // announces its reason when it has one, and commits nothing.
      const moveGate = host.checkInteraction({
        action: "move",
        event,
        start: current.start,
        end: current.end,
        resourceId: current.resourceId ?? null,
        allDay: event.allDay === true,
      });
      if (!moveGate.ok) {
        if (moveGate.reason) host.announce(moveGate.reason);
        return;
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
      const resizeGate = host.checkInteraction({
        action: "resize",
        event,
        start: nextStart,
        end: nextEnd,
        resourceId: event.resourceId ?? null,
        allDay: event.allDay === true,
      });
      if (!resizeGate.ok) {
        if (resizeGate.reason) host.announce(resizeGate.reason);
        return;
      }
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

    // No resize handle when the policy refuses the event where it stands:
    // the gate doubles as the destination checker's entry point.
    const resizeAllowed =
      resizable &&
      host.checkInteraction({
        action: "resize",
        event,
        start: event.start,
        end: event.end,
        resourceId: event.resourceId ?? null,
        allDay: event.allDay === true,
      }).ok;
    if (resizeAllowed) {
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
      const startZoned = toZonedDateTime(event.start, timeZone);
      const endZoned = toZonedDateTime(event.end, timeZone);
      // Only the day owning the real edge may resize it; continuation
      // slices must never truncate the full event.
      const isFirstDay = Temporal.PlainDate.compare(column.date, startZoned.toPlainDate()) === 0;
      const isLastDay = Temporal.PlainDate.compare(column.date, endZoned.toPlainDate()) === 0;
      if ((edge === "start" && !isFirstDay) || (edge === "end" && !isLastDay)) return;
      // Handles only render when allowed, but the policy may read state
      // the calendar never re-renders on: re-check at press time.
      const pressGate = host.checkInteraction({
        action: "resize",
        event,
        start: event.start,
        end: event.end,
        resourceId: event.resourceId ?? null,
        allDay: event.allDay === true,
      });
      if (!pressGate.ok) return;
      nativeEvent.stopPropagation();
      nativeEvent.preventDefault();
      const savedTop = node.style.top;
      const savedHeight = node.style.height;
      // Last evaluated destination (`start:end`) and its policy decision.
      // The first destination may differ from a clipped original edge.
      /** @type {string | null} */
      let resizeKey = null;
      let resizeRevision = host.getInteractionRevision();

      /** @param {PointerEvent} pointer */
      const resizeTarget = (pointer) => {
        const hit = gridHit(pointer.clientX, pointer.clientY);
        if (hit?.column !== columnIndex) return null;
        const edges = columnEdges(columnIndex, event.id);
        let start = item.start;
        let end = item.end;
        if (edge === "end") {
          end = Math.max(magnetOrSnap(hit.minutes, "ceil", edges), start + snapStep);
        } else {
          start = Math.min(magnetOrSnap(hit.minutes, "floor", edges), end - snapStep);
        }
        const range = {
          start: edge === "start" ? zonedDateTimeAt(column.date, start, timeZone) : startZoned,
          end: edge === "end" ? zonedDateTimeAt(column.date, end, timeZone) : endZoned,
          resourceId: event.resourceId ?? null,
        };
        return { start, end, range };
      };

      const resetPreview = () => {
        node.style.top = savedTop;
        node.style.height = savedHeight;
        node.classList.remove("cv-invalid");
        delete node.dataset.reason;
        resizeKey = null;
      };

      const gesture = startPointerGesture({
        target: node,
        event: nativeEvent,
        onMove(moveEvent) {
          if (interaction.longPressConsumed) return;
          const target = resizeTarget(moveEvent);
          if (!target) {
            resetPreview();
            return;
          }
          const { start, end, range } = target;
          node.style.top = `${(start - startMinutes) * pxPerMinute}px`;
          node.style.height = `${(end - start) * pxPerMinute}px`;
          const key = `${start}:${end}`;
          const revision = host.getInteractionRevision();
          if (revision !== resizeRevision) {
            resizeRevision = revision;
            resizeKey = null;
          }
          if (key !== resizeKey) {
            resizeKey = key;
            const decision = host.checkInteraction({
              action: "resize",
              event,
              ...range,
            });
            node.classList.toggle("cv-invalid", !decision.ok);
            if (decision.reason) node.dataset.reason = decision.reason;
            else delete node.dataset.reason;
          }
        },
        onEnd(upEvent, { moved }) {
          const target = moved && !interaction.longPressConsumed ? resizeTarget(upEvent) : null;
          resetPreview();
          if (interaction.longPressConsumed || !moved) return;
          interaction.suppressClick = true;
          if (!target || Temporal.ZonedDateTime.compare(target.range.end, target.range.start) <= 0) {
            return;
          }
          host.commitEventResize({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: target.range,
            nativeEvent: upEvent,
          });
        },
        onCancel() {
          resetPreview();
          // No click follows a cancel: drop both suppression flags.
          interaction.longPressConsumed = false;
          interaction.suppressClick = false;
        },
      });
      gestureDisposers.set(node, () => gesture.dispose());
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
      // A refused start never arms a drag: no mirror, no capture.
      const startGate = host.checkInteraction({
        action: "move",
        event,
        start: event.start,
        end: event.end,
        resourceId: event.resourceId ?? null,
        allDay: event.allDay === true,
      });
      if (!startGate.ok) return;
      const duration = item.end - item.start;
      const grabOffset = downHit.minutes - item.start;
      let pointerX = nativeEvent.clientX;
      let pointerY = nativeEvent.clientY;
      const scroller = body.closest(".cv-scroller");
      const autoscroll = scroller ? createAutoscroller(scroller, { onScroll: paintDragTarget }) : null;
      /** @type {HTMLButtonElement | null} */
      let mirror = null;
      // Last evaluated destination (`column:start`) and its policy
      // decision: re-evaluated only when the snapped target changes.
      // Seeded with the entry target so the first identical snap skips.
      /** @type {string | null} */
      let dragKey = `${columnIndex}:${item.start}`;
      let dragRevision = host.getInteractionRevision();
      let dragOk = true;

      /** @param {NonNullable<ReturnType<typeof gridHit>>} hit */
      function dragTarget(hit) {
        const raw = hit.minutes - grabOffset;
        const target = bodies[hit.column];
        const start = Math.min(
          Math.max(magnetOrSnap(raw, "floor", columnEdges(hit.column, event.id)), startMinutes),
          endMinutes - duration,
        );
        return { ...target, start, droppable: target.column.resource?.droppable !== false };
      }

      function paintDragTarget() {
        if (interaction.longPressConsumed || !mirror) return;
        const hit = gridHit(pointerX, pointerY);
        // Outside every column the drag arms "drop out of the calendar":
        // the application lights its parking target while the pointer
        // hovers the grid edge (axis strip included).
        if (hit) node.removeAttribute("data-dropout");
        else node.setAttribute("data-dropout", "true");
        if (!hit) return;
        const target = dragTarget(hit);
        const { start, droppable } = target;
        if (mirror.parentNode !== target.body) target.body.append(mirror);
        mirror.style.top = `${(start - startMinutes) * pxPerMinute}px`;
        mirror.style.height = `${duration * pxPerMinute}px`;
        const key = `${hit.column}:${start}`;
        const revision = host.getInteractionRevision();
        if (revision !== dragRevision) {
          dragRevision = revision;
          dragKey = null;
        }
        if (key !== dragKey) {
          dragKey = key;
          // The policy judges what the commit writes: the whole event
          // shifted by the column day delta plus the slice's minute
          // delta — not the slice's own target, which would disagree
          // for a clipped slice (event starting off-range, multi-day
          // span). Two separate adds keep the duration sign-consistent.
          const dayDelta = target.column.date.since(column.date).days;
          const minuteDelta = start - item.start;
          const decision = host.checkInteraction({
            action: "move",
            event,
            start: toZonedDateTime(event.start, timeZone)
              .add({ days: dayDelta })
              .add({ minutes: minuteDelta }),
            end: toZonedDateTime(event.end, timeZone).add({ days: dayDelta }).add({ minutes: minuteDelta }),
            resourceId: target.column.resource?.id ?? event.resourceId ?? null,
          });
          dragOk = decision.ok;
          if (decision.reason) mirror.dataset.reason = decision.reason;
          else delete mirror.dataset.reason;
        }
        mirror.classList.toggle("cv-invalid", !droppable || !dragOk);
      }

      const gesture = startPointerGesture({
        target: node,
        event: nativeEvent,
        onMove(moveEvent) {
          if (interaction.longPressConsumed) return;
          if (!mirror) {
            mirror = /** @type {HTMLButtonElement} */ (node.cloneNode(true));
            mirror.classList.add("cv-drag-mirror");
            mirror.classList.remove("cv-drag-source");
            mirror.tabIndex = -1;
            mirror.setAttribute("aria-hidden", "true");
            node.classList.add("cv-drag-source");
          }
          pointerX = moveEvent.clientX;
          pointerY = moveEvent.clientY;
          autoscroll?.update(pointerX, pointerY);
          paintDragTarget();
        },
        onEnd(upEvent, { moved }) {
          // A fired long-press owns the gesture: no commit, and the residual
          // click stays suppressed for its own capture-phase handler.
          if (interaction.longPressConsumed) return;
          if (!moved) return;
          // Released outside every column: the event leaves the grid — that
          // is a parking intent the application may feed its workbench
          // ("drag out of the calendar"). The commit below only runs when
          // the release itself is over a column.
          const hit = gridHit(upEvent.clientX, upEvent.clientY);
          if (!hit) {
            // Same as a committed drop: the residual click on the source card
            // must not fall through to `calendar:eventclick`.
            interaction.suppressClick = true;
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
          // A moved press never leaks a click, even on a refused target.
          const range = dragTarget(hit);
          if (!range.droppable) {
            interaction.suppressClick = true;
            return;
          }
          interaction.suppressClick = true;
          // The mirror shows the dragged slice, but the commit shifts the
          // whole event so multi-day spans keep their total duration (same
          // contract as the keyboard move path). The day and minute deltas
          // apply as two separate adds: combined in one bag they can
          // disagree in sign (a day backward, hours forward), which is not
          // a valid Temporal.Duration.
          const dayDelta = range.column.date.since(column.date).days;
          const minuteDelta = range.start - item.start;
          const startZoned = toZonedDateTime(event.start, timeZone);
          const endZoned = toZonedDateTime(event.end, timeZone);
          host.commitEventMove({
            event,
            previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
            current: {
              start: startZoned.add({ days: dayDelta }).add({ minutes: minuteDelta }),
              end: endZoned.add({ days: dayDelta }).add({ minutes: minuteDelta }),
              // A column with no resource carries no new assignment: the
              // event keeps its current resource instead of being silently
              // unassigned by a move inside a resource-less grid.
              resourceId: range.column.resource?.id ?? event.resourceId ?? null,
            },
            nativeEvent: upEvent,
          });
        },
        onCancel() {
          // No click follows a cancel: drop both suppression flags.
          interaction.longPressConsumed = false;
          interaction.suppressClick = false;
        },
        onCleanup() {
          autoscroll?.stop();
          mirror?.remove();
          node.classList.remove("cv-drag-source");
          node.removeAttribute("data-dropout");
        },
      });
      gestureDisposers.set(node, () => gesture.dispose());
    }

    return node;
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

    const model = deriveTimedColumn(column, events, backgrounds, {
      timeZone,
      slotMin: startMinutes,
      slotMax: endMinutes,
      pxPerMinute,
    });
    columnSlices.push(model);

    for (const { background, geometry } of model.backgrounds) {
      const node = document.createElement("div");
      node.className = ["cv-background", ...(background.classNames ?? [])].join(" ");
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      body.append(node);
    }

    for (const item of model.events) {
      const node = createTimedEventNode(body, column, columnIndex, item);
      body.append(node);
      eventNodes.set(segmentKey(item.event, column), {
        node,
        event: item.event,
        state: stateOf(item.event),
      });
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
      // Last evaluated select destination (`start:end`) and its policy
      // decision: re-evaluated only when the snapped target changes.
      /** @type {string | null} */
      let selectKey = null;
      let selectRevision = host.getInteractionRevision();

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
        const anchor = magnetOrSnap(hit.minutes, "floor", columnEdges(columnIndex));
        // A refused start never arms a selection: no ghost, no capture.
        const anchorStart = zonedDateTimeAt(column.date, anchor, timeZone);
        const gate = host.checkInteraction({
          action: "select",
          event: null,
          start: anchorStart,
          end: anchorStart.add({ minutes: defaultDuration }),
          resourceId: column.resource?.id ?? null,
        });
        if (!gate.ok) return;
        // The calendar owns this mouse gesture. Native text selection can
        // autoscroll the viewport underneath the captured pointer.
        if (nativeEvent.pointerType === "mouse") nativeEvent.preventDefault();
        // Seeded with the entry target so the first identical snap skips.
        selectKey = `${anchor}:${anchor + defaultDuration}`;
        hover.hidden = true;
        tryCapture(body, nativeEvent.pointerId);
        ghost = document.createElement("div");
        ghost.className = "cv-select-ghost";
        ghost.setAttribute("aria-hidden", "true");
        ghostChip = document.createElement("span");
        ghostChip.className = "cv-select-chip";
        ghost.append(ghostChip);
        body.append(ghost);
        selecting = {
          anchor,
          downX: nativeEvent.clientX,
          downY: nativeEvent.clientY,
          moved: false,
        };
      });

      /** @param {number} anchor @param {number} minutes */
      function selectionRange(anchor, minutes) {
        const edges = columnEdges(columnIndex);
        const start = magnetOrSnap(Math.min(anchor, minutes), "floor", edges);
        const end = Math.max(magnetOrSnap(Math.max(anchor, minutes), "ceil", edges), start + snapStep);
        return { start, end };
      }

      body.addEventListener("pointermove", (nativeEvent) => {
        if (!selecting || !ghost || !ghostChip) return;
        if (Math.hypot(nativeEvent.clientX - selecting.downX, nativeEvent.clientY - selecting.downY) >= 4) {
          selecting.moved = true;
        }
        if (!selecting.moved) return;
        const hit = gridHit(nativeEvent.clientX, nativeEvent.clientY);
        ghost.hidden = hit?.column !== columnIndex;
        if (hit?.column !== columnIndex) return;
        const { start, end } = selectionRange(selecting.anchor, hit.minutes);
        ghost.style.top = `${(start - startMinutes) * pxPerMinute}px`;
        ghost.style.height = `${(end - start) * pxPerMinute}px`;
        ghostChip.textContent = `${formatClock(start)} - ${formatClock(end)}`;
        const key = `${start}:${end}`;
        const revision = host.getInteractionRevision();
        if (revision !== selectRevision) {
          selectRevision = revision;
          selectKey = null;
        }
        if (key !== selectKey) {
          selectKey = key;
          const decision = host.checkInteraction({
            action: "select",
            event: null,
            start: zonedDateTimeAt(column.date, start, timeZone),
            end: zonedDateTimeAt(column.date, end, timeZone),
            resourceId: column.resource?.id ?? null,
          });
          ghost.classList.toggle("cv-invalid", !decision.ok);
          if (decision.reason) ghost.dataset.reason = decision.reason;
          else delete ghost.dataset.reason;
        }
      });

      /**
       * @param {PointerEvent} nativeEvent
       * @param {boolean} cancelled
       * @returns {void}
       */
      const finishSelection = (nativeEvent, cancelled) => {
        // A fired long-press owns the gesture: drop the pending selection and
        // keep the residual click suppressed for its own handler below.
        const wasLongPress = interaction.longPressConsumed;
        interaction.longPressConsumed = false;
        if (!selecting) return;
        const { anchor, moved } = selecting;
        selecting = null;
        ghost?.remove();
        ghost = null;
        ghostChip = null;
        if (cancelled || wasLongPress) return;
        if (moved) interaction.suppressClick = true;
        const hit = gridHit(nativeEvent.clientX, nativeEvent.clientY);
        if (hit?.column !== columnIndex) return;
        if (moved) {
          const { start, end } = selectionRange(anchor, hit.minutes);
          dispatchSelect(body, column, start, end, nativeEvent);
        } else {
          dispatchSelect(body, column, anchor, Math.min(anchor + defaultDuration, endMinutes), nativeEvent);
        }
      };

      body.addEventListener("pointerup", (nativeEvent) => finishSelection(nativeEvent, false));
      body.addEventListener("pointercancel", (nativeEvent) => finishSelection(nativeEvent, true));
      body.addEventListener("lostpointercapture", (nativeEvent) => finishSelection(nativeEvent, true));

      // A true drag-selection must not leak a second select from its residual click.
      body.addEventListener("click", (nativeEvent) => {
        if (!interaction.suppressClick) return;
        interaction.suppressClick = false;
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

    day.append(body);
    bodies.push({ column, body });
    root.append(day);
  }

  // --- Incremental update (updateEvent-only renders) -----------------------
  // The shell, headers, lane, now indicator and external placement stay put.
  // Only timed segments reconcile; any structural all-day change falls back
  // to a full render instead of growing a second DOM diff.
  /**
   * @param {HTMLButtonElement} node
   * @param {{ event: import("../core/model.js").NormalizedEvent, start: number, end: number, left: number, width: number, geometry: { top: number, height: number } }} item
   */
  function applyTimedGeometry(node, item) {
    const top = `${item.geometry.top}px`;
    const height = `${item.geometry.height}px`;
    const start = `${item.left * 100}%`;
    const width = `${item.width * 100}%`;
    if (node.style.top !== top) node.style.top = top;
    if (node.style.height !== height) node.style.height = height;
    if (node.style.insetInlineStart !== start) node.style.insetInlineStart = start;
    if (node.style.width !== width) node.style.width = width;
    const state = stateOf(item.event);
    if (node.dataset.temporalState !== state) node.dataset.temporalState = state;
    const label = describeEvent(item.event, timeZone, labels.untitledEvent);
    if (node.getAttribute("aria-label") !== label) node.setAttribute("aria-label", label);
  }

  /** @param {HTMLButtonElement} node */
  function removeTimedNode(node) {
    gestureDisposers.get(node)?.();
    gestureDisposers.delete(node);
    node.remove();
  }

  /**
   * Keep event nodes in model order before overlays, while moving only the
   * nodes whose position actually differs.
   *
   * @param {HTMLDivElement} body
   * @param {HTMLButtonElement[]} nodes
   * @param {Element | null} anchor
   */
  function reorderTimedNodes(body, nodes, anchor) {
    let expected = anchor;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      if (node.nextSibling !== expected) body.insertBefore(node, expected);
      expected = node;
    }
  }

  /**
   * @param {import("../core/model.js").NormalizedEvent[]} nextEvents
   * @param {Temporal.ZonedDateTime} nextNow
   * @returns {boolean} false when a full render is required
   */
  function update(nextEvents, nextNow) {
    const previousAllDay = new Map(
      previousEvents.filter((item) => item.allDay === true).map((item) => [item.id, item]),
    );
    const nextAllDay = new Map(
      nextEvents.filter((item) => item.allDay === true).map((item) => [item.id, item]),
    );
    if (previousAllDay.size !== nextAllDay.size) return false;
    for (const [id, item] of nextAllDay) {
      if (previousAllDay.get(id) !== item) return false;
    }

    previousEvents = nextEvents;
    renderNow = nextNow;
    const nextNodes = new Map();

    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const body = bodies[index].body;
      // The anchor keeps the event block before hover, preview and gesture
      // overlays even when a segment is recreated.
      const anchor =
        body.querySelector(
          ":scope > :is(.cv-hover, .cv-select-ghost, .cv-preview, .cv-external-ghost, .cv-drag-mirror)",
        ) ?? null;
      const model = deriveTimedColumn(column, nextEvents, backgrounds, {
        timeZone,
        slotMin: startMinutes,
        slotMax: endMinutes,
        pxPerMinute,
      });
      // Handlers already installed read this array for neighbor magnetism, so
      // an in-place update must refresh it instead of capturing stale edges.
      columnSlices[index] = model;

      /** @type {HTMLButtonElement[]} */
      const columnNodes = [];
      for (const item of model.events) {
        const { event } = item;
        const key = segmentKey(event, column);
        const existing = eventNodes.get(key);
        const state = stateOf(event);
        let node;
        if (existing && existing.event === event && existing.state === state) {
          node = existing.node;
          applyTimedGeometry(node, item);
        } else {
          if (existing) removeTimedNode(existing.node);
          node = createTimedEventNode(body, column, index, item);
          if (anchor?.parentNode === body) body.insertBefore(node, anchor);
          else body.append(node);
        }
        columnNodes.push(node);
        nextNodes.set(key, { node, event, state });
      }
      reorderTimedNodes(body, columnNodes, anchor);
    }

    for (const [key, entry] of eventNodes) {
      if (!nextNodes.has(key)) removeTimedNode(entry.node);
    }
    eventNodes = nextNodes;
    return true;
  }

  /** @returns {void} */
  function dispose() {
    for (const disposeGesture of gestureDisposers.values()) disposeGesture();
    gestureDisposers.clear();
    allDay.dispose?.();
  }

  // --- Range preview (application-proposed placement target) ---------------
  // Read-only render state, not a synthetic drag: one overlay per column the
  // range touches, painted with the same slice/geometry primitives as
  // events. No dispatch, no policy check, no focus; interaction ghosts paint
  // above it. Columns the range does not belong to (hidden resources,
  // out-of-range days) simply paint nothing.
  paintPreview();

  /** @returns {void} */
  function paintPreview() {
    const preview = host.getPreview();
    if (!preview) return;
    const sliceOptions = { timeZone, slotMin: startMinutes, slotMax: endMinutes };
    for (const { column, body } of bodies) {
      if (!eventBelongsToColumn(preview, column)) continue;
      const slice = sliceTimedEventForDay(preview, column.date, sliceOptions);
      if (!slice) continue;
      const geometry = eventGeometry({
        startMinutes: slice.start,
        endMinutes: slice.end,
        dayStartMinutes: startMinutes,
        pxPerMinute,
        gap: 0,
      });
      const node = document.createElement("div");
      node.className = "cv-preview";
      // A refused proposal reads like a refused gesture: invalid styling
      // plus the reason chip every ghost carries.
      if (preview.reason !== null) {
        node.classList.add("cv-invalid");
        node.dataset.reason = preview.reason;
      }
      node.setAttribute("aria-hidden", "true");
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      body.append(node);
    }
  }

  host.setExternalDropTarget(
    bindExternalPlacement({
      root,
      lane,
      columns,
      bodies,
      columnIndexAtX,
      gridHit,
      startMinutes,
      endMinutes,
      pxPerMinute,
      defaultDuration,
      snapStep,
      timeZone,
      host,
    }),
  );

  host.setNowIndicatorCleanup(
    startNowIndicator({
      bodies,
      timeZone,
      slotMin: startMinutes,
      slotMax: endMinutes,
      pxPerMinute,
    }),
  );
  fragment.append(root);
  return { fragment, update, dispose };
}
