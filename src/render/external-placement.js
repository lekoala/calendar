import { Temporal } from "temporal-polyfill";
import { durationMinutes, zonedDateTimeAt } from "../core/dates.js";
import { snapMinutes } from "../core/geometry.js";
import { createAutoscroller } from "./autoscroll.js";
import { elementAtPoint } from "./dom.js";
/** @typedef {import("./time-grid.js").TimeGridHost} TimeGridHost */

/**
 * Bind native drag events and return the pointer placement callbacks for
 * the same grid. Both routes resolve and validate the same placement.
 *
 * @param {object} input
 * @param {HTMLDivElement} input.root
 * @param {HTMLDivElement} input.lane
 * @param {import("../core/resources.js").TimeGridColumn[]} input.columns
 * @param {Array<{ body: HTMLDivElement }>} input.bodies
 * @param {(x: number) => number} input.columnIndexAtX
 * @param {(x: number, y: number) => ReturnType<typeof import("../core/hit.js").hitTest>} input.gridHit
 * @param {number} input.startMinutes
 * @param {number} input.endMinutes
 * @param {number} input.pxPerMinute
 * @param {number} input.defaultDuration
 * @param {number} input.snapStep
 * @param {string} input.timeZone
 * @param {Pick<TimeGridHost, "getExternalDrag" | "getInteractionRevision" | "checkInteraction" | "getRangeContext">} input.host
 * @returns {import("./time-grid.js").ExternalDropTarget}
 */
export function bindExternalPlacement({
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
}) {
  // --- External placement (drag from an application source) ----------------
  // The core knows geometry, never policy: it resolves the structural target
  // from the pointer, draws a ghost with the real duration, and hands the
  // anchor to the application on drop. `meta.validate` may forbid the target.
  /** @type {{ kind: "grid" | "lane", node: HTMLElement } | null} */
  let externalGhost = null;
  /** @type {{ source: ReturnType<TimeGridHost["getExternalDrag"]>, revision: number, key: string, placement: ReturnType<typeof resolveExternal> } | null} */
  let externalPreview = null;
  /** @type {HTMLElement | null} */
  let highlightedColumn = null;

  /**
   * Highlight the fallback day column of an all-day target. This column is
   * only used when no lane is rendered, so it is the only surface left and
   * must carry the refusal itself.
   *
   * @param {number} index
   * @param {{ ok: boolean, reason: string | null }} placement
   * @returns {void}
   */
  function highlightLaneColumn(index, placement) {
    const day = bodies[index]?.body.closest(".cv-day");
    if (!(day instanceof HTMLElement)) {
      clearLaneHighlight();
      return;
    }
    if (highlightedColumn !== day) {
      clearLaneHighlight();
      day.classList.add("cv-external-lane-target");
      highlightedColumn = day;
    }
    day.classList.toggle("cv-invalid", !placement.ok);
    if (placement.reason) day.dataset.reason = placement.reason;
    else delete day.dataset.reason;
  }

  /** @returns {void} */
  function clearLaneHighlight() {
    if (!highlightedColumn) return;
    highlightedColumn.classList.remove("cv-external-lane-target", "cv-invalid");
    delete highlightedColumn.dataset.reason;
    highlightedColumn = null;
  }

  /** @returns {void} */
  function removeExternalGhost() {
    externalGhost?.node.remove();
    externalGhost = null;
    externalPreview = null;
    clearLaneHighlight();
  }

  /**
   * Column exposed under the pointer, ignoring sticky headers and areas
   * clipped by the scroller. A declared all-day source may skip the lane,
   * but not the requirement that its target is a real day column.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {number}
   */
  function visibleColumnAtPoint(clientX, clientY) {
    const day = elementAtPoint(root, clientX, clientY)?.closest(".cv-day");
    if (!day) return -1;
    return bodies.findIndex(({ body }) => body.closest(".cv-day") === day);
  }

  /**
   * Lane column exposed under the pointer. Unlike a rect overlap check this
   * ignores the lane when sticky headers or the scroller clip it.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {number}
   */
  function laneColumnAtPoint(clientX, clientY) {
    if (!lane.isConnected) return -1;
    const hit = elementAtPoint(lane, clientX, clientY);
    if (!hit || !lane.contains(hit)) return -1;
    return columnIndexAtX(clientX);
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
   * @param {boolean} [refresh] force a fresh decision at drop, even for the last previewed slot
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
   *   highlight: boolean,
   * } | null}
   */
  function resolveExternal(clientX, clientY, refresh = false) {
    const external = host.getExternalDrag();
    if (!external) return null;
    const meta = external.meta;
    const revision = host.getInteractionRevision();
    /** @param {string} key */
    const cached = (key) =>
      !refresh &&
      externalGhost?.node.isConnected &&
      externalPreview?.source === external &&
      externalPreview.revision === revision &&
      externalPreview.key === key
        ? externalPreview.placement
        : null;
    /** @param {string} key @param {NonNullable<ReturnType<typeof resolveExternal>>} placement */
    const remember = (key, placement) => {
      externalPreview = { source: external, revision, key, placement };
      return placement;
    };
    // A declared all-day source may target a visibility-eligible day column
    // without requiring the lane to exist. A timed source only enters the
    // lane when the lane itself is exposed under the pointer.
    const laneIndex = laneColumnAtPoint(clientX, clientY);
    const allDayIndex =
      meta.allDay === true && laneIndex < 0 ? visibleColumnAtPoint(clientX, clientY) : laneIndex;
    if (meta.allDay === true || laneIndex >= 0) {
      const index = allDayIndex;
      if (index < 0) return null;
      // The column highlight is the fallback for a missing lane. A rendered
      // lane keeps hosting the ghost even when the pointer is over the timed
      // grid: the drop is still civil, and two competing affordances for the
      // same target read as two different destinations.
      const highlight = meta.allDay === true && laneIndex < 0 && !lane.isConnected;
      const key = `lane:${index}`;
      const previous = cached(key);
      if (previous) return previous;
      const column = columns[index];
      const resourceId = column.resource?.id ?? null;
      // Global interaction policy first, source-specific `validate` second;
      // the first refusal wins. A lane drop covers its civil day.
      const policy = host.checkInteraction({
        action: "external",
        event: null,
        start: column.date,
        end: column.date.add({ days: 1 }),
        resourceId,
        allDay: true,
      });
      if (!policy.ok) {
        return remember(key, {
          kind: "lane",
          index,
          target: { date: column.date, time: null, resourceId, allDay: true },
          ok: false,
          reason: policy.reason,
          highlight,
        });
      }
      const validity = externalTargetValidity(
        column.date,
        null,
        resourceId,
        true,
        column.resource?.droppable !== false,
      );
      return remember(key, {
        kind: "lane",
        index,
        target: { date: column.date, time: null, resourceId, allDay: true },
        ok: validity.ok,
        reason: validity.reason,
        highlight,
      });
    }
    const hit = gridHit(clientX, clientY);
    if (!hit) return null;
    const rawDuration = meta.duration;
    const duration =
      rawDuration == null
        ? defaultDuration
        : durationMinutes(typeof rawDuration === "number" ? { minutes: rawDuration } : rawDuration);
    if (duration > endMinutes - startMinutes) return null;
    const start = Math.max(
      startMinutes,
      Math.min(snapMinutes(hit.minutes, snapStep, "floor"), endMinutes - duration),
    );
    if (start < startMinutes) return null;
    const end = start + duration;
    const key = `grid:${hit.column}:${start}:${end}`;
    const previous = cached(key);
    if (previous) return previous;
    const column = columns[hit.column];
    const time = zonedDateTimeAt(column.date, start, timeZone);
    const resourceId = column.resource?.id ?? null;
    // Same chain as the lane: global policy, then source `validate`.
    const policy = host.checkInteraction({
      action: "external",
      event: null,
      start: time,
      end: time.add({ minutes: duration }),
      resourceId,
    });
    if (!policy.ok) {
      return remember(key, {
        kind: "grid",
        index: hit.column,
        start,
        end,
        time,
        target: { date: column.date, time, resourceId, allDay: false },
        ok: false,
        reason: policy.reason,
      });
    }
    const validity = externalTargetValidity(
      column.date,
      time,
      resourceId,
      false,
      column.resource?.droppable !== false,
    );
    return remember(key, {
      kind: "grid",
      index: hit.column,
      start,
      end,
      time,
      target: { date: column.date, time, resourceId, allDay: false },
      ok: validity.ok,
      reason: validity.reason,
    });
  }

  /**
   * Paint (or clear) the placement ghost. Structural or policy invalidity
   * marks it `cv-invalid` instead of hiding the target.
   *
   * @param {ReturnType<typeof resolveExternal>} placement
   * @returns {void}
   */
  function paintExternalGhost(placement) {
    if (!placement) {
      removeExternalGhost();
      return;
    }
    const external = host.getExternalDrag();
    if (placement.kind === "lane" && placement.highlight) {
      highlightLaneColumn(placement.index, placement);
    } else {
      clearLaneHighlight();
    }
    let node = externalGhost?.node;
    if (!node?.isConnected || externalGhost?.kind !== placement.kind) {
      node?.remove();
      node = document.createElement("div");
      node.className = "cv-external-ghost";
      node.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "cv-external-ghost-label";
      node.append(label);
      externalGhost = { kind: placement.kind, node };
    }
    const label = /** @type {HTMLElement} */ (node.firstElementChild);
    const title = external?.meta.title ?? "";
    if (label.textContent !== title) label.textContent = title;
    if (placement.kind === "grid") {
      node.style.top = `${(placement.start - startMinutes) * pxPerMinute}px`;
      node.style.height = `${(placement.end - placement.start) * pxPerMinute}px`;
      const body = bodies[placement.index].body;
      if (node.parentNode !== body) body.append(node);
    } else {
      node.classList.add("cv-external-ghost-lane");
      label.className = "";
      node.style.gridColumn = `${placement.index + 2} / ${placement.index + 3}`;
      node.style.gridRow = "1 / -1";
      if (!placement.highlight && lane.isConnected && node.parentNode !== lane) lane.append(node);
    }
    node.classList.toggle("cv-invalid", !placement.ok);
    if (placement.reason) node.dataset.reason = placement.reason;
    else delete node.dataset.reason;
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

  /** @param {DragEvent | PointerEvent} event */
  function dropExternal(event) {
    const external = host.getExternalDrag();
    if (!external) return;
    event.preventDefault();
    const placement = resolveExternal(event.clientX, event.clientY, true);
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
  }
  root.addEventListener("drop", dropExternal);

  /** @type {ReturnType<typeof createAutoscroller> | null} */
  let externalAutoscroll = null;
  /** @param {number} x @param {number} y */
  function pointerOverGrid(x, y) {
    const element = elementAtPoint(root, x, y);
    return element != null && root.contains(element);
  }
  return {
    move(x, y) {
      if (!pointerOverGrid(x, y)) {
        externalAutoscroll?.stop();
        removeExternalGhost();
        return;
      }
      const scroller = root.closest(".cv-scroller");
      if (!externalAutoscroll && scroller) externalAutoscroll = createAutoscroller(scroller);
      externalAutoscroll?.update(x, y);
      paintExternalGhost(resolveExternal(x, y));
    },
    drop(event) {
      if (pointerOverGrid(event.clientX, event.clientY)) dropExternal(event);
    },
    clear() {
      externalAutoscroll?.stop();
      removeExternalGhost();
    },
  };
}
