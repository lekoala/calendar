import { Temporal } from "temporal-polyfill";
import { layoutDaySegments } from "../core/layout.js";
import { isMovable, isResizable } from "../core/model.js";
import { backgroundAppliesToColumn, eventBelongsToColumn, getDaySpans } from "../core/resources.js";
import { describeEvent, eventOverlapsDate } from "../core/slicing.js";
import { applyContent, dispatchContextMenu, elementAtPoint } from "./dom.js";
import { startPointerGesture } from "./pointer-gesture.js";

/**
 * All-day lane: the civil plane above the timed grid. It mirrors the time
 * grid's columns, so a bar spans civil days inside one resource block and
 * never crosses into the neighbouring room.
 *
 * The lane is rebuilt with the grid in 0.5. Structural all-day changes
 * (appearance, removal, lane visibility) fall back to a full render, which
 * keeps this module free of an update contract it does not need yet.
 *
 * @param {object} input
 * @param {import("../core/resources.js").TimeGridColumn[]} input.columns
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {boolean} input.resourceView
 * @param {string} input.timeZone
 * @param {import("../core/labels.js").CalendarLabels} input.labels
 * @param {string} input.gridTemplate
 * @param {import("./time-grid.js").TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(event: import("../core/model.js").NormalizedEvent) => import("../core/temporal.js").TemporalState} input.stateOf
 * @param {{ suppressClick: boolean, longPressConsumed: boolean }} input.interaction
 * @param {(clientX: number) => number} input.columnIndexAtX
 * @param {(target: HTMLElement, onFire: (press: PointerEvent) => void) => void} input.watchLongPress
 * @returns {{ lane: HTMLDivElement, hasContent: boolean, dispose: () => void }}
 */
export function createAllDayLane({
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
}) {
  /**
   * @param {{ start: unknown, end: unknown, allDay?: boolean }} range
   * @returns {boolean}
   */
  const overVisibleDays = (range) => dates.some((date) => eventOverlapsDate(range, date, timeZone));

  /**
   * @param {{ start: unknown, end: unknown, resourceId?: string | null }} range
   * @param {typeof eventBelongsToColumn} applies
   */
  const daySpans = (range, applies) => getDaySpans(columns, range, applies, timeZone);

  const allDaySegments = events
    .filter((event) => event.allDay === true && overVisibleDays(event))
    .flatMap((event) =>
      daySpans(event, eventBelongsToColumn).map((span) => ({
        event,
        resourceId: resourceView ? (event.resourceId ?? null) : null,
        ...span,
      })),
    );
  const allDayBackgroundSegments = backgrounds
    .filter((background) => background.allDay === true && overVisibleDays(background))
    .flatMap((background) =>
      daySpans(background, backgroundAppliesToColumn).map((span) => ({
        background,
        ...span,
      })),
    );

  const hasContent = allDaySegments.length > 0 || allDayBackgroundSegments.length > 0;
  /** @type {Map<HTMLElement, () => void>} */
  const gestureDisposers = new Map();
  const lane = document.createElement("div");
  lane.className = "cv-allday";
  lane.style.gridTemplateColumns = gridTemplate;
  lane.style.gridColumn = "1 / -1";
  lane.style.gridRow = "2";

  /**
   * Whether a rendered segment is cut by the visible range. The civil day
   * just outside the segment is checked instead of the event boundary, so a
   * bar cut by the viewport and a bar cut by a hidden weekday report the same
   * thing, and a bar that merely fills the range reports nothing.
   *
   * @param {import("../core/model.js").NormalizedEvent} event
   * @param {number} startDay
   * @param {number} endDay
   * @returns {{ before: boolean, after: boolean }}
   */
  function cutEdges(event, startDay, endDay) {
    return {
      before: eventOverlapsDate(event, columns[startDay].date.subtract({ days: 1 }), timeZone),
      after: eventOverlapsDate(event, columns[endDay - 1].date.add({ days: 1 }), timeZone),
    };
  }

  /** @param {number} clientX */
  const columnAtX = (clientX) => columns[columnIndexAtX(clientX)] ?? columns[0];

  /** @param {number} x @param {number} y */
  function allDayColumnAtPoint(x, y) {
    const hit = elementAtPoint(lane, x, y);
    return hit && lane.contains(hit) ? columnIndexAtX(x) : -1;
  }

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
   * @param {PointerEvent} nativeEvent
   * @returns {void}
   */
  function beginAllDayDrag(bar, event, startDay, nativeEvent) {
    if (nativeEvent.button !== 0) return;
    if (nativeEvent.target instanceof Element && nativeEvent.target.closest(".cv-resize-handle")) {
      return;
    }
    // A refused start never arms a drag: no mirror, no capture.
    if (event.start instanceof Temporal.PlainDate && event.end instanceof Temporal.PlainDate) {
      const startGate = host.checkInteraction({
        action: "move",
        event,
        start: event.start,
        end: event.end,
        resourceId: event.resourceId ?? null,
        allDay: true,
      });
      if (!startGate.ok) return;
    }
    const downX = nativeEvent.clientX;
    /** @type {HTMLButtonElement | null} */
    let mirror = null;
    // Last evaluated destination (day index) and its policy decision.
    // Seeded with the entry day so the first identical snap skips.
    const grabbedColumn = columnIndexAtX(downX);
    const origin = columns[grabbedColumn < 0 ? startDay : grabbedColumn];
    /** @type {number | null} */
    let laneKey = grabbedColumn;
    let laneRevision = host.getInteractionRevision();
    let laneOk = true;

    const gesture = startPointerGesture({
      target: bar,
      event: nativeEvent,
      onMove(moveEvent) {
        if (interaction.longPressConsumed) return;
        const index = allDayColumnAtPoint(moveEvent.clientX, moveEvent.clientY);
        if (index < 0) {
          mirror?.remove();
          return;
        }
        if (!mirror) {
          mirror = /** @type {HTMLButtonElement} */ (bar.cloneNode(true));
          mirror.classList.add("cv-drag-mirror");
          mirror.tabIndex = -1;
          mirror.setAttribute("aria-hidden", "true");
          bar.classList.add("cv-drag-source");
        }
        if (!mirror.isConnected) lane.append(mirror);
        const droppable = columns[index].resource?.droppable !== false;
        const days = columns[index].date.since(origin.date).days;
        const resourceId = columns[index].resource?.id ?? event.resourceId ?? null;
        const spans = daySpans(
          {
            start: /** @type {Temporal.PlainDate} */ (event.start).add({ days }),
            end: /** @type {Temporal.PlainDate} */ (event.end).add({ days }),
            resourceId,
          },
          eventBelongsToColumn,
        );
        const span = spans.find((entry) => index >= entry.startDay && index < entry.endDay);
        mirror.style.gridColumn = span ? `${span.startDay + 2} / ${span.endDay + 2}` : `${index + 2}`;
        mirror.style.gridRow = String(Number.parseFloat(bar.style.gridRow) || 1);
        const revision = host.getInteractionRevision();
        if (revision !== laneRevision) {
          laneRevision = revision;
          laneKey = null;
        }
        if (index !== laneKey) {
          laneKey = index;
          const dayDelta = columns[index].date.since(origin.date).days;
          const nextResourceId = columns[index].resource?.id ?? event.resourceId ?? null;
          /** @type {import("../core/policy.js").PolicyDecision} */
          let decision = { ok: true, reason: null };
          if (event.start instanceof Temporal.PlainDate && event.end instanceof Temporal.PlainDate) {
            decision = host.checkInteraction({
              action: "move",
              event,
              start: event.start.add({ days: dayDelta }),
              end: event.end.add({ days: dayDelta }),
              resourceId: nextResourceId,
              allDay: true,
            });
          }
          laneOk = decision.ok;
          if (decision.reason) mirror.dataset.reason = decision.reason;
          else delete mirror.dataset.reason;
        }
        mirror.classList.toggle("cv-invalid", !droppable || !laneOk);
      },
      onEnd(upEvent, { moved }) {
        if (interaction.longPressConsumed || !moved) return;
        interaction.suppressClick = true;
        const index = allDayColumnAtPoint(upEvent.clientX, upEvent.clientY);
        if (index < 0 || columns[index].resource?.droppable === false) return;
        const dayDelta = columns[index].date.since(origin.date).days;
        // A column with no resource carries no new assignment: the bar keeps
        // its current resource instead of being silently unassigned.
        const resourceId = columns[index].resource?.id ?? event.resourceId ?? null;
        const next = commitAllDayMove(event, dayDelta, resourceId, upEvent);
        if (next) {
          host.announce(describeEvent(next, timeZone, labels.untitledEvent));
          host.refocusEvent(event.id);
        }
      },
      onCancel() {
        interaction.longPressConsumed = false;
        interaction.suppressClick = false;
      },
      onCleanup() {
        mirror?.remove();
        bar.classList.remove("cv-drag-source");
      },
    });
    gestureDisposers.set(bar, () => gesture.dispose());
  }

  /**
   * Resize one visible edge of an all-day bar. The event keeps its resource
   * and civil bounds; the pointer only changes the visible start or the
   * exclusive end. Edges hidden by the visible window or by hidden days are
   * not reachable here.
   *
   * @param {HTMLButtonElement} bar
   * @param {import("../core/model.js").NormalizedEvent} event
   * @param {"start" | "end"} edge
   * @param {PointerEvent} nativeEvent
   * @returns {void}
   */
  function beginAllDayResize(bar, event, edge, nativeEvent) {
    if (nativeEvent.button !== 0) return;
    if (!(event.start instanceof Temporal.PlainDate) || !(event.end instanceof Temporal.PlainDate)) return;
    const startDate = event.start;
    const endDate = event.end;
    const pressGate = host.checkInteraction({
      action: "resize",
      event,
      start: startDate,
      end: endDate,
      resourceId: event.resourceId ?? null,
      allDay: true,
    });
    if (!pressGate.ok) return;
    nativeEvent.stopPropagation();
    nativeEvent.preventDefault();
    const savedGridColumn = bar.style.gridColumn;
    /** @type {string | null} */
    let resizeKey = null;
    let resizeRevision = host.getInteractionRevision();

    /**
     * Grid span for a civil range, clamped to the visible columns. All-day
     * columns are contiguous within one resource block, so the first and
     * last overlapping columns are enough.
     *
     * @param {Temporal.PlainDate} start
     * @param {Temporal.PlainDate} end
     * @returns {string | null}
     */
    const spanFor = (start, end) => {
      let first = -1;
      let last = -1;
      for (let index = 0; index < columns.length; index += 1) {
        if (!belongsToEventBlock(columns[index])) continue;
        const date = columns[index].date;
        if (first < 0 && Temporal.PlainDate.compare(date, start) >= 0) first = index;
        if (Temporal.PlainDate.compare(date, end) < 0) last = index;
      }
      if (first < 0 || last < first) return null;
      return `${first + 2} / ${last + 3}`;
    };

    /** @param {{ date: Temporal.PlainDate, resource?: { id: string } | null }} column */
    const belongsToEventBlock = (column) =>
      !resourceView || event.resourceId == null || column.resource?.id === event.resourceId;

    /**
     * Last visible day before a civil bound, used when the pointer moves
     * past the event end. Clamping to `end - 1` could land on a hidden day
     * with no column and no reachable handle.
     *
     * @param {Temporal.PlainDate} bound
     * @returns {Temporal.PlainDate | null}
     */
    const lastVisibleBefore = (bound) => {
      let found = null;
      for (const column of columns) {
        if (belongsToEventBlock(column) && Temporal.PlainDate.compare(column.date, bound) < 0) {
          found = column.date;
        }
      }
      return found;
    };

    /** @param {PointerEvent} pointer */
    const resizeTarget = (pointer) => {
      const index = allDayColumnAtPoint(pointer.clientX, pointer.clientY);
      if (index < 0) return null;
      // A resize never changes resources. Ignore columns outside the
      // event's own resource block instead of silently reassigning it.
      if (!belongsToEventBlock(columns[index])) return null;
      const pointerDate = columns[index].date;
      let nextStart = startDate;
      let nextEnd = endDate;
      if (edge === "start") {
        if (Temporal.PlainDate.compare(pointerDate, endDate) >= 0) {
          const last = lastVisibleBefore(endDate);
          if (!last) return null;
          nextStart = last;
        } else {
          nextStart = pointerDate;
        }
      } else {
        const endFromDay = pointerDate.add({ days: 1 });
        nextEnd =
          Temporal.PlainDate.compare(endFromDay, startDate.add({ days: 1 })) < 0
            ? startDate.add({ days: 1 })
            : endFromDay;
      }
      const span = spanFor(nextStart, nextEnd);
      if (!span) return null;
      return { span, range: { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null } };
    };

    const resetPreview = () => {
      bar.style.gridColumn = savedGridColumn;
      bar.classList.remove("cv-invalid");
      delete bar.dataset.reason;
      resizeKey = null;
    };

    const gesture = startPointerGesture({
      target: bar,
      event: nativeEvent,
      onMove(moveEvent) {
        if (interaction.longPressConsumed) return;
        const target = resizeTarget(moveEvent);
        if (!target) {
          resetPreview();
          return;
        }
        const { span, range } = target;
        bar.style.gridColumn = span;
        const key = `${range.start}:${range.end}`;
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
            allDay: true,
          });
          bar.classList.toggle("cv-invalid", !decision.ok);
          if (decision.reason) bar.dataset.reason = decision.reason;
          else delete bar.dataset.reason;
        }
      },
      onEnd(upEvent, { moved }) {
        if (interaction.longPressConsumed || !moved) {
          resetPreview();
          return;
        }
        interaction.suppressClick = true;
        const target = resizeTarget(upEvent);
        resetPreview();
        if (!target) return;
        const result = host.commitEventResize({
          event,
          previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
          current: target.range,
          nativeEvent: upEvent,
        });
        if (!result) return;
        host.announce(describeEvent(result, timeZone, labels.untitledEvent));
        host.refocusEvent(event.id);
      },
      onCancel() {
        resetPreview();
        interaction.longPressConsumed = false;
        interaction.suppressClick = false;
      },
    });
    gestureDisposers.set(bar, () => gesture.dispose());
  }

  if (hasContent) {
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
      const cut = cutEdges(event, startDay, endDay);
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = [
        "cv-allday-event",
        ...(event.classNames ?? []),
        ...(cut.before ? ["cv-continues-before"] : []),
        ...(cut.after ? ["cv-continues-after"] : []),
      ].join(" ");
      bar.dataset.eventId = event.id;
      bar.dataset.focusKey = JSON.stringify([event.id, "allday", event.resourceId ?? null]);
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
      if (!applyContent(bar, content)) bar.textContent = event.title ?? labels.untitledEvent;
      lane.append(bar);

      // --- All-day interactions (v1) ---------------------------------------
      // Native <button> activation covers pointer click and Enter/Space; a
      // single capture-phase handler both dispatches eventclick and drops the
      // residual click after a drag, resize or long-press. Creation inside
      // the lane and timed<->all-day conversion stay deferred.
      bar.addEventListener(
        "click",
        (nativeEvent) => {
          if (interaction.suppressClick) {
            interaction.suppressClick = false;
            interaction.longPressConsumed = false;
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
      const resizable = isResizable(event, host.editable);

      bar.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.ctrlKey || keyboardEvent.metaKey) return;
        const key = keyboardEvent.key;
        if (keyboardEvent.shiftKey) {
          if (key !== "ArrowLeft" && key !== "ArrowRight") return;
          if (!movable) return;
          keyboardEvent.preventDefault();
          const days = key === "ArrowRight" ? 1 : -1;
          if (event.start instanceof Temporal.PlainDate && event.end instanceof Temporal.PlainDate) {
            const gate = host.checkInteraction({
              action: "move",
              event,
              start: event.start.add({ days }),
              end: event.end.add({ days }),
              resourceId: event.resourceId ?? null,
              allDay: true,
            });
            if (!gate.ok) {
              if (gate.reason) host.announce(gate.reason);
              return;
            }
          }
          const next = commitAllDayMove(event, days, event.resourceId ?? null, keyboardEvent);
          if (next) host.announce(describeEvent(next, timeZone, labels.untitledEvent));
          return;
        }
        if (!keyboardEvent.altKey || !resizable) return;
        if (!(event.start instanceof Temporal.PlainDate) || !(event.end instanceof Temporal.PlainDate))
          return;
        const adjustsStart = key === "ArrowUp" || key === "ArrowDown";
        const adjustsEnd = key === "ArrowLeft" || key === "ArrowRight";
        if (!adjustsStart && !adjustsEnd) return;
        keyboardEvent.preventDefault();
        let nextStart = event.start;
        let nextEnd = event.end;
        if (key === "ArrowUp") nextStart = nextStart.subtract({ days: 1 });
        else if (key === "ArrowDown") nextStart = nextStart.add({ days: 1 });
        else if (key === "ArrowLeft") nextEnd = nextEnd.subtract({ days: 1 });
        else nextEnd = nextEnd.add({ days: 1 });
        if (Temporal.PlainDate.compare(nextEnd, nextStart) <= 0) return;
        const gate = host.checkInteraction({
          action: "resize",
          event,
          start: nextStart,
          end: nextEnd,
          resourceId: event.resourceId ?? null,
          allDay: true,
        });
        if (!gate.ok) {
          if (gate.reason) host.announce(gate.reason);
          return;
        }
        const result = host.commitEventResize({
          event,
          previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
          current: { start: nextStart, end: nextEnd, resourceId: event.resourceId ?? null },
          nativeEvent: keyboardEvent,
        });
        if (!result) return;
        host.announce(describeEvent(result, timeZone, labels.untitledEvent));
        host.refocusEvent(event.id);
      });

      if (resizable) {
        const resizeAllowed = host.checkInteraction({
          action: "resize",
          event,
          start: event.start,
          end: event.end,
          resourceId: event.resourceId ?? null,
          allDay: true,
        }).ok;
        const startEdgeVisible =
          event.start instanceof Temporal.PlainDate &&
          Temporal.PlainDate.compare(columns[startDay].date, event.start) === 0;
        const endEdgeVisible =
          event.end instanceof Temporal.PlainDate &&
          Temporal.PlainDate.compare(columns[endDay - 1].date.add({ days: 1 }), event.end) === 0;
        if (resizeAllowed) {
          for (const edge of /** @type {["start", "end"]} */ (["start", "end"])) {
            if (edge === "start" && !startEdgeVisible) continue;
            if (edge === "end" && !endEdgeVisible) continue;
            const handle = document.createElement("div");
            handle.className = `cv-resize-handle cv-resize-${edge === "start" ? "w" : "e"}`;
            bar.append(handle);
            handle.addEventListener("pointerdown", (nativeEvent) => {
              beginAllDayResize(bar, event, edge, nativeEvent);
            });
          }
        }
      }

      if (movable) {
        bar.addEventListener("pointerdown", (nativeEvent) =>
          beginAllDayDrag(bar, event, startDay, nativeEvent),
        );
      }
    }
  }

  return {
    lane,
    hasContent,
    dispose() {
      for (const disposeGesture of gestureDisposers.values()) disposeGesture();
      gestureDisposers.clear();
    },
  };
}
