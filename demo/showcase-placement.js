// showcase-placement.js — move workbench, copy clipboard, calendar configuration and move/resize guard.
// Classic script (file:// compatible): shares scope with the other showcase-*.js
// files, so top-level bindings stay bare and cross-file calls need no imports.
// Extracted verbatim from demo/showcase.html; see .temp/split-showcase.mjs.
"use strict";

// --- Move workbench + copy clipboard --------------------------------------
// Moving across weeks cannot be a pointer drag: the target week is not
// rendered. Cut / park / bulk fill all converge on the workbench, and the
// sidebar IS the visible state of "what still waits to be placed" (the
// old cut banner is gone). The workbench emits its own `change` beat; the
// calendar only repaints the "parked" look of queued events on render.
const workbench = new globalThis.MoveWorkbench();

const workbenchPanel = document.getElementById("workbench-panel");

const workbenchList = document.getElementById("workbench-list");

const workbenchCount = document.getElementById("workbench-count");

/** Progressively built workbench rows currently registered as drop sources. @type {HTMLElement[]} */
let externalRows = [];

/** @type {{ view: string, dates: Array<{ toString(): string }>, resources: Array<{ id: string, title?: string }> }} */
let lastRender = { view: "", dates: [], resources: [] };

// Copy stays a plain clipboard (a duplicated booking is not "waiting to be
// placed"), so it never pollutes the workbench queue.
/** @type {{ id: string, title: string, durationMin: number } | null} */
let copyClipboard = null;

/** Last empty-slot intent, so `Ctrl+V` has a target. @type {{ date: string, minutes: number, resourceId: string | null } | null} */
let lastSlot = null;

const clipboardBar = document.getElementById("clipboard-bar");

/** Civil date plus `N` days, back to a `YYYY-MM-DD` string. @param {string} iso @param {number} days */
function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Application policy on one workbench placement target — shared by the
 * drag ghost (`meta.validate`) and the commit on drop/paste. Overlap
 * checks stay application-owned: the core never decides that itself.
 *
 * @param {string} eventId
 * @param {{ date: string, minutes: number | null, resourceId: string | null, allDay: boolean }} target
 * @returns {string | null} refusal reason, or null when the target is fine
 */
function workbenchTargetReason(eventId, target) {
  const item = calendar.getEventById(eventId);
  if (!item) return "The booking is gone.";
  const allDay = item.allDay === true;
  let start;
  let end;
  if (allDay) {
    const spanDays = /** @type {any} */ (item.end).since(item.start).days;
    start = target.date;
    end = addDays(target.date, spanDays);
  } else {
    const duration = Math.max(
      15,
      wallMinutesOf(String(item.end)) - wallMinutesOf(String(item.start)),
    );
    start = stamp(target.date, target.minutes ?? POLICY.opensAt);
    end = stamp(target.date, (target.minutes ?? POLICY.opensAt) + duration);
  }
  const context = calendar.getRangeContext({ start, end, resourceId: target.resourceId });
  const reason = violation(
    { start, end, resourceId: target.resourceId, allDay },
    context,
    eventId,
  );
  if (reason) return reason;
  // The slot the booking already holds is always a legal target: it may
  // sit on an occupied slot already (often the very reason it was
  // queued), and refusing its own position would freeze it there.
  const unchanged =
    String(item.start) === String(start) &&
    String(item.end) === String(end) &&
    (item.resourceId ?? null) === target.resourceId;
  if (unchanged) return null;
  return occupancyReason(context, {
    allDay,
    room: target.resourceId ?? item.resourceId ?? null,
    excludeEventId: eventId,
  });
}

/**
 * Place one workbench item at a target (drag drop or paste): validate like
 * the ghost, then commit through the normal optimistic move. Successes
 * leave the queue and arm the next pending item; refusals keep the item.
 *
 * @param {string} eventId
 * @param {string} date civil `YYYY-MM-DD`
 * @param {number | null} minutes wall-clock minutes when timed, null for all-day
 * @param {string | null} resourceId
 * @returns {void}
 */
function placeWorkbenchItem(eventId, date, minutes, resourceId) {
  const item = calendar.getEventById(eventId);
  if (!item) {
    workbench.remove(eventId);
    return;
  }
  const allDay = item.allDay === true;
  const target = { date, minutes, resourceId, allDay };
  const reason = workbenchTargetReason(eventId, target);
  if (reason) {
      record(`placement refused: ${reason}`);
    toast(reason);
    workbench.activate(eventId);
    return;
  }
  const moved = calendar.moveEvent(eventId, {
    start: allDay ? date : stamp(date, minutes ?? POLICY.opensAt),
    end: allDay
      ? addDays(date, /** @type {any} */ (item.end).since(item.start).days)
      : stamp(date, (minutes ?? POLICY.opensAt) + Math.max(15, wallMinutesOf(String(item.end)) - wallMinutesOf(String(item.start)))),
    resourceId,
  });
  if (!moved) return; // guard() already explained and `revert()` kept it
  const title = String(item.title ?? "Booking");
  workbench.complete(eventId);
  // The spent target goes with the placement; the next armed item (if any)
  // has no target until the next empty-slot intent.
  setLastSlot(null);
    record(`placed ${eventId} → ${allDay ? date : `${date} ${clock(minutes ?? POLICY.opensAt)}`}`);
  if (workbench.size === 0) {
    toast("All queued bookings placed.", "success");
  } else {
      toast(`Moved “${title}” — ${workbench.size} left in the queue.`, "success");
  }
}

function renderWorkbench() {
  const items = workbench.items;
  workbenchPanel.hidden = items.length === 0;
  workbenchCount.textContent = items.length === 0 ? "" : String(items.length);
  // Rows are rebuilt on every change, so old registrations must go first.
  for (const element of externalRows) calendar.removeExternalDrop(element);
  externalRows = [];
  workbenchList.replaceChildren();
  for (const item of items) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.eventId = item.eventId;
    if (workbench.activeId === item.eventId) button.setAttribute("aria-current", "true");
    const title = document.createElement("strong");
    title.textContent = String(item.original?.title ?? "Booking");
    const meta = document.createElement("small");
    const origin = item.original ?? {};
    const originStart = String(origin.start ?? "");
    const originResource = origin.resourceId
        ? ` · ${roomTitle(String(origin.resourceId))}`
      : "";
      meta.textContent = `${originStart.length > 10 ? wallClock(originStart) : "all day"}${originResource}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      if (workbench.activeId === item.eventId) workbench.activate(null);
      else workbench.activate(item.eventId);
    });
    row.append(button);
    workbenchList.append(row);

    // Dragging a row onto the grid is the same placement as paste: the
    // core delivers an anchor, the application runs its own policy.
    const originAllDay = origin.allDay === true;
    calendar.addExternalDrop(
      button,
      { kind: "reschedule", eventId: item.eventId },
      {
        duration: originAllDay ? undefined : Math.max(15, wallMinutesOf(String(origin.end ?? "")) - wallMinutesOf(originStart)),
        allDay: originAllDay,
        title: String(origin.title ?? "Booking"),
        validate: (target) =>
          workbenchTargetReason(item.eventId, {
            date: target.date.toString(),
            minutes: target.allDay ? null : wallMinutesOf(String(target.time)),
            resourceId: target.resourceId,
            allDay: target.allDay,
          }) ?? true,
      },
    );
    externalRows.push(button);
  }
}

/**
 * Jump to one civil day in the day view - the same navigation
 * `calendar:moreclick` performs, and the one read-only verb the past-time
 * menus can still offer.
 * @param {string} iso
 */
function openDay(iso) {
  calendar.gotoDate(iso.slice(0, 10));
  calendar.setView("day");
    record(`opened day ${iso.slice(0, 10)}`);
}

/** @param {any} item */
function parkEvent(item) {
  const queued = workbench.add(item);
  workbench.activate(String(item.id));
    record(queued ? `parked: ${item.id}` : `armed: ${item.id}`);
  hideTip();
}

/** Add every current booking of one civil day to the workbench. @param {string} iso */
function parkDay(iso) {
  const frozen = frozenDayReason(iso);
  if (frozen) {
    // Still the authority for the day rule: the menus only stop offering
    // the verb, they do not enforce it. Every other entry point (the
    // tools shelf, a keyboard command) arrives here.
      record(`replanify refused: ${iso.slice(0, 10)} is in the past`);
    toast(frozen, "warning");
    return;
  }
  const inDay = calendar.events.filter(
    (event) => String(event.start).slice(0, 10) === iso.slice(0, 10),
  );
  const added = workbench.addMany(inDay);
    record(`workbench +${added} from ${iso}`);
}

/** Add the bookings of one resource on one civil day. @param {string} iso @param {string} resourceId */
function parkDayFor(iso, resourceId) {
  const frozen = frozenDayReason(iso);
  if (frozen) {
    // Still the authority for the day rule: the menus only stop offering
    // the verb, they do not enforce it. Every other entry point (the
    // tools shelf, a keyboard command) arrives here.
      record(`replanify refused: ${iso.slice(0, 10)} is in the past`);
    toast(frozen, "warning");
    return;
  }
  const inDay = calendar.events.filter(
    (event) =>
      event.resourceId === resourceId && String(event.start).slice(0, 10) === iso.slice(0, 10),
  );
  const added = workbench.addMany(inDay);
    record(`workbench +${added} from ${iso} (${resourceId})`);
}

/**
 * Re-apply the "parked" look after any calendar render: queued events keep
 * their place in the grid but read as waiting. `data-parked="true"` so the
 * attribute reads as a flag, not an empty string.
 */
function syncWorkbenchMarkers() {
  for (const node of calendar.querySelectorAll("[data-event-id]")) {
    const id = node.dataset.eventId ?? "";
    if (id !== "" && workbench.has(id)) node.setAttribute("data-parked", "true");
    else node.removeAttribute("data-parked");
  }
}

/**
 * Repaints the placement preview for the current target + payload pair.
 * The target (`lastSlot`) and the payload (`workbench.active` winning
 * over the copy clipboard, exactly like `Ctrl+V`) change independently,
 * so every change to either re-runs this — never just the slot setter.
 * Armed wins even when it cannot preview (all-day): the preview must
 * mirror the action `Ctrl+V` would run, not the fallback clipboard.
 *
 * @returns {void}
 */
function syncPlacementPreview() {
  if (!lastSlot) {
    calendar.clearPreview();
    return;
  }
  const armed = workbench.active;
  if (armed) {
    const live = calendar.getEventById(String(armed.eventId));
    if (!live || live.allDay === true) {
      calendar.clearPreview();
      return;
    }
    const durationMin = Math.max(15, wallMinutesOf(String(live.end)) - wallMinutesOf(String(live.start)));
    // The ghost speaks the placement's own verdict: the reason Paste
    // would refuse with rides the preview, so a refused target reads as
    // refused before the gesture exists — same visual contract as the
    // drag mirror.
    calendar.previewRange({
      start: stamp(lastSlot.date, lastSlot.minutes),
      end: stamp(lastSlot.date, lastSlot.minutes + durationMin),
      resourceId: lastSlot.resourceId,
      reason: workbenchTargetReason(String(armed.eventId), {
        date: lastSlot.date,
        minutes: lastSlot.minutes,
        resourceId: lastSlot.resourceId,
        allDay: false,
      }),
    });
    return;
  }
  if (copyClipboard) {
    const start = stamp(lastSlot.date, lastSlot.minutes);
    const end = stamp(lastSlot.date, lastSlot.minutes + copyClipboard.durationMin);
    const context = calendar.getRangeContext({ start, end, resourceId: lastSlot.resourceId });
    calendar.previewRange({
      start,
      end,
      resourceId: lastSlot.resourceId,
      reason:
        violation({ start, end, resourceId: lastSlot.resourceId }, context) ??
        occupancyReason(context, { room: lastSlot.resourceId, excludeEventId: copyClipboard.id }),
    });
    return;
  }
  calendar.clearPreview();
}

/** @param {{ date: string, minutes: number, resourceId: string | null } | null} slot */
function setLastSlot(slot) {
  lastSlot = slot;
  syncPlacementPreview();
}

function renderClipboard() {
  if (!copyClipboard) {
    clipboardBar.hidden = true;
    clipboardBar.replaceChildren();
    return;
  }
  clipboardBar.hidden = false;
  clipboardBar.replaceChildren();
  const text = document.createElement("span");
    text.textContent = `Copying “${copyClipboard.title}” — paste it into a slot to duplicate.`;
  const actions = document.createElement("span");
  actions.className = "sc-clipboard-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn sm neutral ghost";
  cancel.textContent = "Cancel (Esc)";
  cancel.addEventListener("click", () => clearCopyClipboard("cancelled from the banner"));
  actions.append(cancel);
  clipboardBar.append(icon("copy"), text, actions);
}

/** @param {{ id: string, title: string, durationMin: number }} entry */
function setCopyClipboard(entry) {
  copyClipboard = entry;
  renderClipboard();
  syncPlacementPreview();
    record(`copy: ${entry.id} ready to paste`);
}

/** @param {string} [reason] */
function clearCopyClipboard(reason = "cancelled") {
  if (!copyClipboard) return;
  copyClipboard = null;
  renderClipboard();
  syncPlacementPreview();
    record(`copy clipboard ${reason}`);
}

/**
 * Commit a copy at an empty-slot target. Failures keep the clipboard and
 * explain why; only a committed paste clears it.
 *
 * @param {{ date: string, minutes: number, resourceId: string | null }} slot
 */
function pasteCopy(slot) {
  if (!copyClipboard) return;
  const item = calendar.getEventById(copyClipboard.id);
  const start = stamp(slot.date, slot.minutes);
  const end = stamp(slot.date, slot.minutes + copyClipboard.durationMin);
  const context = calendar.getRangeContext({ start, end, resourceId: slot.resourceId });
  const reason =
    violation({ start, end, resourceId: slot.resourceId }, context) ??
    // The source stays in place but never refuses its own copy: a paste
    // on the source's slot duplicates the booking there on purpose.
    occupancyReason(context, { room: slot.resourceId, excludeEventId: copyClipboard.id });
  if (reason) {
      record(`paste refused: ${reason}`);
    toast(reason);
    return;
  }
    const id = `copy-${Date.now()}`;
  const source = store.find((entry) => entry.id === copyClipboard?.id);
  const created = {
    id,
      title: `${copyClipboard.title} (copy)`,
    start,
    end,
    ...(slot.resourceId ? { resourceId: slot.resourceId } : {}),
    extendedProps: { ...(source?.extendedProps ?? item?.extendedProps ?? {}) },
  };
  store.push(created);
  markFresh(id);
  calendar.addEvent(created);
    record(`pasted a copy of ${copyClipboard.id} → ${id}`);
  refreshChrome();
  clearCopyClipboard("pasted");
  setLastSlot(null);
}

// --- Move and resize: the application refuses what it cannot honour -----
/**
 * @param {CustomEvent} event
 * @param {"move" | "resize"} kind
 */
function guard(event, kind) {
  const detail = event.detail;
  const start = String(detail.current.start);
  const end = String(detail.current.end);
  const resourceId = detail.current.resourceId ?? detail.event?.resourceId ?? null;
  // All-day moves carry civil bounds; the normalized event says so, since
  // `current` itself only holds `start`/`end`/`resourceId`.
  const allDay = detail.event?.allDay === true;
  // Occupancy applies to the new slot only when the booking actually
  // moves: its previous slot is never refused, matching the hover
  // policy's unchanged exemption for a slot already occupied.
  const movedSlot =
    String(detail.previous.start) !== start ||
    String(detail.previous.end) !== end ||
    (detail.previous.resourceId ?? null) !== resourceId;
  const reason =
    violation({ start, end, resourceId, allDay }, detail.context, detail.event?.id ?? null) ??
    (movedSlot
      ? occupancyReason(detail.context, {
          allDay,
          room: resourceId,
          excludeEventId: detail.event?.id ?? null,
        })
      : null);
  if (reason) {
    // Synchronous refusal: the core reverts the optimistic change itself.
    event.preventDefault();
      record(`event${kind} refused: ${reason}`);
    toast(reason);
    return;
  }

  const stored = store.find((item) => item.id === detail.event?.id);
  if (stored) {
    stored.start = start;
    stored.end = end;
    if (resourceId) stored.resourceId = resourceId;
  }
  // A queued booking placed by a straight drag is placed: the pointer
  // move is a placement like Paste or the sidebar drop, so it leaves the
  // workbench instead of keeping its waiting look.
  const queuedId = String(detail.event?.id ?? "");
  const wasQueued = kind === "move" && queuedId !== "" && workbench.has(queuedId);
  if (wasQueued) workbench.complete(queuedId);
  // All-day boundaries are civil dates without a wall clock, so the log
  // names the span by its dates instead of reading minutes out of thin air.
  const label = (iso) => (iso.length > 10 ? wallClock(iso) : iso.slice(0, 10));
    record(`event${kind}: ${detail.event?.id} → ${label(start)}–${label(end)}`);

  // The asynchronous half of the same contract: accepted optimistically,
  // then rolled back with `revert()` once the round-trip answers. The
  // core does not need to know the answer took time.
  const kindName = detail.event?.extendedProps?.kind ?? "review";
  if (POLICY.reviewedKinds.includes(kindName)) {
    const previousStart = String(detail.previous.start);
    const previousEnd = String(detail.previous.end);
    const previousRoom = detail.previous.resourceId;
    window.setTimeout(() => {
      detail.revert();
      if (stored) {
        stored.start = previousStart;
        stored.end = previousEnd;
        if (previousRoom) stored.resourceId = previousRoom;
      }
      // The desk refused the placement after all: a dequeued booking goes
      // back to waiting, like a refused paste would have kept it.
      if (wasQueued) {
        const live = calendar.getEventById(queuedId);
        if (live) {
          workbench.add(live);
          workbench.activate(queuedId);
        }
      }
        record(`event${kind} rolled back by the desk: ${detail.event?.id}`);
      toast("The scheduling desk did not confirm that deadline — reverted.", "warning");
      refreshChrome();
    }, POLICY.reviewDelay);
    return;
  }
  refreshChrome();
}
function placementInitEarly() {

    // Drag from the sidebar row onto the grid commits through the same path.
    calendar.addEventListener("calendar:externaldrop", (event) => {
      const detail = event.detail;
      const payload = detail.payload;
      if (payload?.kind !== "reschedule") return;
      event.preventDefault();
      placeWorkbenchItem(
        String(payload.eventId),
        String(detail.date),
        detail.allDay === true ? null : wallMinutesOf(String(detail.time)),
        detail.resourceId ?? null,
      );
    });

    // Dragging an event out of the calendar parks it — the mirror existence of
    // the external drop, feeding the same queue.
    calendar.addEventListener("calendar:eventdropout", (event) => {
      event.preventDefault();
      const item = /** @type {any} */ (event.detail?.event);
      if (item && !isLocked(item)) {
        parkEvent(item);
      toast(`“${String(item.title ?? "Booking")}” parked — find it a new slot.`, "warning");
      }
    });

    workbench.addEventListener("change", () => {
      renderWorkbench();
      // Painted in place: queued events keep their position in the grid but
      // immediately read as waiting, no calendar re-render needed.
      syncWorkbenchMarkers();
      // Arming, disarming, completing or emptying changes the paste payload,
      // so the preview for the current target (if any) is re-derived.
      syncPlacementPreview();
    });

    document.getElementById("workbench-clear").addEventListener("click", () => {
      workbench.clear();
      record("workbench emptied");
    });

    calendar.addEventListener("calendar:render", (event) => {
      lastRender = event.detail;
    });

    /**
     * Right-click a day header to queue that whole day: the header is core
     * DOM without its own intent, so the application delegates to it — same
     * pattern as event cards. In resource views the day header carries its
     * resource column, so the action can be scoped to one room.
     *
     * A day that is over is not a replanning target, so it gets the same
     * treatment a past booking gets: a distinct menu naming the rule, not the
     * live menu with an action that a click would only be refused for.
     */
    calendar.addEventListener("contextmenu", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".cv-event") !== null) return;
      const header = target.closest(".cv-day-header");
      if (!header) return;
      const index = [...calendar.querySelectorAll(".cv-day-header")].indexOf(header);
      if (index < 0) return;
      const resourceView = String(lastRender.view).startsWith("resource");
      const columns = resourceView
        ? lastRender.resources.flatMap((resource) =>
            lastRender.dates.map((date) => ({ date, resource })),
          )
        : lastRender.dates.map((date) => ({ date, resource: null }));
      const column = columns[index];
      if (!column) return;
      event.preventDefault();
      const date = column.date.toString();
      const resource = column.resource ?? null;
      const frozen = frozenDayReason(date);
      openContextMenu(
        [
          ...(frozen ? [{ note: "Already over", icon: "history" }] : []),
          { label: "Open this day", icon: "columns-1", run: () => openDay(date) },
          resource
            ? {
              label: `Replanify this day · ${resource.title ?? resource.id}`,
                icon: "arrows-shuffle",
                disabled: frozen !== null,
                run: () => parkDayFor(date, String(resource.id)),
              }
            : {
                label: "Replanify all bookings of this day",
                icon: "arrows-shuffle",
                disabled: frozen !== null,
                run: () => parkDay(date),
              },
        ],
        event.clientX,
        event.clientY,
      );
    record(`day contextmenu: ${date}${resource ? ` · ${resource.id}` : ""}${frozen ? " (over)" : ""}`);
    });

    calendar.addEventListener("calendar:render", syncWorkbenchMarkers);
}
function placementConfigureCalendar() {

    calendar.configure({
      pxPerMinute: 1.5,
      // This shell operates in Brussels: pin the zone instead of relying on
      // the neutral UTC default, like every other Brussels-dated fixture.
      timeZone: ZONE,
      // This shell does not take Sunday bookings, and it pins the week to
      // Monday rather than letting the locale suggest one: both are
      // application policy handed to the core, and both are undoable from
      // Tools, which is where the precedence rule becomes visible.
      firstDay: 1,
      hiddenDays: [7],
      // Prevention, not correction. `violation()` used to run only once the
      // gesture had already committed: the booking was accepted, snapped
      // back and explained by a toast. As an interaction policy the very
      // same function runs while the pointer is still down, so the mirror,
      // the resized card and the selection ghost turn red on the first
      // refused destination and the drop never happens. The commit-time
      // guard stays: it is the authority for programmatic moves, and it
      // owns the asynchronous half nobody can answer synchronously.
      interactionPolicy({ action, event, target, context }) {
        const allDay = target.allDay === true;
        // A booking queued in the workbench obeys the queue's own placement
        // rules: the same verdict its sidebar ghost and Paste return, so a
        // pointer drag over an occupied or blocked slot reads as refused
        // before it is ever dropped. The verdict judges destinations only:
        // the booking may sit on a slot that is occupied or blocked already
        // (often the very reason it was queued), and refusing its current
        // position would freeze it there instead of letting the pointer
        // carry it out.
        if (action === "move" && event && workbench.has(String(event.id))) {
          if (sameSlot(target, event, allDay)) return true;
          return (
            workbenchTargetReason(String(event.id), {
              date: String(target.date),
              minutes: allDay ? null : wallMinutesOf(String(target.start)),
              resourceId: target.resourceId,
              allDay,
            }) ?? true
          );
        }
        // The slot the event already holds is always a legal destination:
        // it may sit on an occupied or blocked slot already (often the very
        // reason it is being moved), and refusing its current position
        // would freeze it in place instead of letting the pointer carry it
        // out. Same exemption the workbench branch gives its queued items.
        if (event != null && sameSlot(target, event, allDay)) return true;
        // All-day bounds are civil dates with no wall clock; `violation()`
        // applies the day-level rules (past day, viewing-only Saturday) to
        // them and skips the wall-clock ones, matching the commit guard.
        const reason = violation(
          {
            start: String(target.start),
            end: String(target.end),
            resourceId: target.resourceId,
            allDay,
          },
          context,
          event?.id ?? null,
        );
        if (reason) return reason;
        // Occupancy is the same rule the workbench applies to a placement:
        // a slot another same-room booking occupies refuses a move, a
        // resize and a selection alike. An external drop is exempt here: the
        // generic policy sees `event: null` and cannot tell the dragged
        // payload apart from an occupant, so occupancy stays the source's
        // own `validate` contract — the workbench row's validate already
        // runs the identical verdict with the event id it knows.
        if (action === "external") return true;
        return (
          occupancyReason(context, {
            allDay,
            room: target.resourceId ?? event?.resourceId ?? null,
            excludeEventId: event?.id ?? null,
          }) ?? true
        );
      },
      eventContent({ event, element }) {
        const kind = event.extendedProps?.kind ?? "review";
        // The core hands the application its own node: the tone is set as
        // a data attribute, no post-render pass and no mutation observer.
        element.dataset.kind = kind;
        const locked = POLICY.lockedKinds.includes(kind);
        if (locked) element.dataset.locked = "true";
        if (beforeToday(String(event.end))) element.dataset.archived = "true";
        if (fresh.has(event.id)) element.dataset.fresh = "true";
        // Parked state is applied by `syncWorkbenchMarkers()` after the
        // render; the card itself never duplicates the queue's knowledge of
        // what is waiting.

        const start = String(event.start);
        const end = String(event.end);

        if (calendar.view === "list") {
          const row = document.createElement("span");
          row.className = "sc-row";
          const time = document.createElement("span");
          time.className = "sc-time";
        time.textContent = `${wallClock(start)}–${wallClock(end)}`;
          const title = document.createElement("span");
          title.textContent = event.title ?? "Booking";
          const room = document.createElement("span");
          room.className = "sc-time";
          room.textContent = roomTitle(String(event.resourceId ?? ""));
          const tag = document.createElement("span");
          tag.className = "sc-tag";
          tag.textContent = kind;
          row.append(icon(KIND_ICONS[kind] ?? "calendar"), time, title, room, tag);
          return row;
        }

        if (calendar.view === "month") {
          const chip = document.createElement("span");
        chip.textContent = `${wallClock(start)} ${event.title ?? "Booking"}`;
          return chip;
        }

        const wrap = document.createElement("span");
        wrap.className = "sc-card";
        const when = document.createElement("span");
        when.className = "sc-when";
        // Two nodes, not one string: the end of the range is the first thing
        // worth dropping when the card gets narrow, because the card's own
        // height already states the duration. Splitting it here lets a
        // container query decide, which a single text node could not.
        if (event.allDay === true) {
          when.textContent = "All day";
        } else {
          const from = document.createElement("span");
          from.className = "sc-from";
          from.textContent = wallClock(start);
          const to = document.createElement("span");
          to.className = "sc-to";
        to.textContent = `–${wallClock(end)}`;
          when.append(from, to);
        }
        const title = document.createElement("strong");
        if (locked) title.append(icon("lock"));
        // The kind glyph is emitted unconditionally and shown by CSS only
        // under `soft`, which needs a second cue for the kind because a wash
        // separates hues less than a fill. Emitting it either way is what
        // lets the skin switch be a single attribute: no re-render, and no
        // card whose markup depends on which skin was active when it was
        // built.
        const kindGlyph = icon(KIND_ICONS[kind] ?? "calendar");
        kindGlyph.classList.add("sc-kind");
        title.append(kindGlyph);
        const label = document.createElement("span");
        label.textContent = event.title ?? "Booking";
        title.append(label);
        const meta = document.createElement("span");
        meta.className = "sc-meta";
        // The kind used to lead this line and was said twice on every card,
        // once here in words and once in the chip below it. The chip is now a
        // badge in the clock line, so the meta line carries only what nothing
        // else does: a resource initial (a tiny avatar, soft-only in CSS) and
        // the room's short name - useful where no column header names it.
        const room = roomTitle(String(event.resourceId ?? ""));
      let metaText = `${event.extendedProps?.seats ?? "?"} seats`;
        if (room) {
          const [code, name] = room.split("·").map((part) => part.trim());
          const avatar = document.createElement("span");
          avatar.className = "sc-avatar";
          avatar.textContent = code.slice(-1);
          meta.append(avatar);
        metaText = `${name ?? room} · ${metaText}`;
        }
        const metaLabel = document.createElement("span");
        metaLabel.className = "sc-meta-text";
        metaLabel.textContent = metaText;
        meta.append(metaLabel);
        const tag = document.createElement("span");
        tag.className = "sc-tag";
        tag.textContent = kind;
        wrap.append(when, title, meta, tag);
        // Trailing flag cluster, pinned top-end of the card itself (which is
        // the positioned `.cv-event` node the core handed over).
        const glyphs = [];
        if (event.extendedProps?.remote) glyphs.push("video");
        if (event.extendedProps?.priority) glyphs.push("star");
        if (glyphs.length > 0) {
          const cluster = document.createElement("span");
          cluster.className = "sc-icons";
          for (const name of glyphs) cluster.append(icon(name));
          element.append(cluster);
        }
        return wrap;
      },
      dayHeaderContent({ date, resource, element }) {
        const iso = date.toString();
        const count = calendar.events.filter(
          (item) => String(item.start).slice(0, 10) === iso && (!resource || item.resourceId === resource.id),
        ).length;
        if (iso === todayIso()) element.dataset.today = "true";
        if (date.dayOfWeek > 5) element.dataset.weekend = "true";

        const node = document.createDocumentFragment();
        const dow = document.createElement("span");
        dow.className = "sc-dow";
        dow.textContent = fmt.day.format(asDate(iso));
        const dom = document.createElement("span");
        dom.className = "sc-dom";
        dom.textContent = String(date.day);
        const badge = document.createElement("span");
        badge.className = "sc-count";
        badge.textContent = String(count);
        node.append(dow, dom, badge);
        return node;
      },
      resourceGroupContent({ group, resources, element }) {
        element.dataset.group = group.id;
        const node = document.createDocumentFragment();
        node.append(icon("building"));
        const label = document.createElement("span");
        label.textContent = group.title;
        // The hook is handed the group's own resources, so the count is the
        // section's, not a second walk over `calendar.resources`.
        const ids = new Set(resources.map((item) => item.id));
        const count = document.createElement("span");
        count.className = "sc-count";
        count.textContent = String(
          inCurrentRange(calendar.events.filter((item) => ids.has(String(item.resourceId)))).length,
        );
        node.append(label, count);
        return node;
      },
      resourceHeaderContent({ resource }) {
        const node = document.createDocumentFragment();
        node.append(icon("door"));
        const label = document.createElement("span");
        label.textContent = resource.title;
        const count = document.createElement("span");
        count.className = "sc-count";
        count.textContent = String(
          inCurrentRange(calendar.events.filter((item) => item.resourceId === resource.id)).length,
        );
        node.append(label, count);
        return node;
      },
    });
}
function placementInitGuards() {

    calendar.addEventListener("calendar:eventmove", (event) => guard(event, "move"));

    calendar.addEventListener("calendar:eventresize", (event) => guard(event, "resize"));

    // A pointer drop the policy refuses commits nothing and dispatches
    // nothing, so `guard` never sees it: the gesture just ends. The painted
    // ghost still carries its `data-reason` in the capture phase - before the
    // core's own pointerup removes it - which is the one place the shell can
    // read why the card snapped back and say it out loud. Two releases are not
    // refusals even with a stale reason on the ghost: a drop out of the grid
    // is a parking intent (`data-dropout` on the source), and a release
    // outside the calendar commits nothing at all.
    window.addEventListener(
      "pointerup",
      (event) => {
        const refused = calendar.querySelector(
          ".cv-drag-mirror[data-reason], .cv-select-ghost[data-reason], .cv-external-ghost[data-reason], .cv-event.cv-invalid[data-reason]",
        );
        if (!refused || calendar.querySelector("[data-dropout]")) return;
        const under = document.elementFromPoint(event.clientX, event.clientY);
        if (!under || !calendar.contains(under)) return;
        toast(/** @type {HTMLElement} */ (refused).dataset.reason ?? "Placement refused.", "warning");
      },
      { capture: true },
    );
}
globalThis.ShowcasePlacement = { addDays, workbenchTargetReason, placeWorkbenchItem, renderWorkbench, openDay, parkEvent, parkDay, parkDayFor, syncWorkbenchMarkers, syncPlacementPreview, setLastSlot, renderClipboard, setCopyClipboard, clearCopyClipboard, pasteCopy, guard };
