// showcase-overlays.js — anchored popovers, toast, creation and detail sheets, context menu and hover tooltip.
// Classic script (file:// compatible): shares scope with the other showcase-*.js
// files, so top-level bindings stay bare and cross-file calls need no imports.
// Extracted verbatim from demo/showcase.html; see .temp/split-showcase.mjs.
"use strict";

// Positioning engine from @lekoala/floating. Assigned by
// CalendarShowcase.init() after the dynamic import (classic scripts cannot
// import statically and stay file:// compatible); read at event time only.
let autoUpdate, reposition, repositionAt;

const toolsMenu = document.getElementById("tools-menu");

const accountMenu = document.getElementById("account-menu");

// --- Toast: a refusal has to say why ------------------------------------
const toastNode = document.getElementById("toast");

let toastTimer = 0;

// --- Creation sheet ------------------------------------------------------
const createDialog = document.getElementById("create-dialog");

/** @type {{ start: string, end: string, resourceId: string | null, location: { location: string, locationId: string, mode: string } | null } | null} */
let pendingSlot = null;

// --- Detail sheet --------------------------------------------------------
const detailDialog = document.getElementById("detail-dialog");

/** @type {string | null} */
let detailId = null;

// --- Context menu (core intent, app menu) --------------------------------
const contextMenu = document.getElementById("context-menu");

const contextMenuList = contextMenu;

// A drag suppresses the hover tooltip.
let dragging = false;

// Whether a pointer is currently pressed, captured once for the overlays
// that have to cooperate with the platform's own dismissal.
let pointerDown = false;

// --- Hover intent --------------------------------------------------------
// Short cards drop their tag and their meta line; the tooltip is where
// the application gives that detail back. No core hook is involved:
// events carry `data-event-id`, and that is enough.
const tip = document.getElementById("event-tip");

/** @type {(() => void) | undefined} */
let tipStop;

let tipTimer = 0;

let tipId = "";

// --- Overlays: platform first, geometry second ---------------------------
/**
 * Wires one anchored popover. `popovertarget` opens it, the platform
 * closes it (light dismiss and Escape), and `floating` places it while
 * it is open - including while the calendar scroller moves under it.
 *
 * @param {HTMLElement} menu
 * @param {HTMLElement} trigger
 * @param {object} [options] floating placement options
 */
function anchorPopover(menu, trigger, options = {}) {
  const place = { placement: "bottom-end", distance: 6, ...options };
  /** @type {(() => void) | undefined} */
  let stop;
  menu.addEventListener("toggle", (event) => {
    const open = event.newState === "open";
    trigger.setAttribute("aria-expanded", String(open));
    stop?.();
    stop = undefined;
    if (!open) return;
    const run = () => reposition(trigger, menu, place);
    run();
    stop = autoUpdate(trigger, menu, run);
  });
}

/**
 * @param {string} message
 * @param {"danger" | "warning" | "success"} [intent]
 */
function toast(message, intent = "danger") {
  window.clearTimeout(toastTimer);
    toastNode.className = `status-bar sc-toast is-open ${intent}`;
  toastNode.replaceChildren(
    icon(intent === "success" ? "circle-check" : "alert-triangle"),
    document.createTextNode(message),
  );
  toastTimer = window.setTimeout(() => toastNode.classList.remove("is-open"), 4200);
}

/**
 * @param {string} startIso
 * @param {string} endIso
 * @param {string | null} resourceId
 * @param {any} [context] range context of the slot, when the caller has one
 */
function openCreate(startIso, endIso, resourceId, context = null) {
  const availability = availabilityLocation(
    context ?? calendar.getRangeContext({ start: startIso, end: endIso, resourceId }),
  );
  const location = availability
    ? {
        location: String(availability.extendedProps.location),
        locationId: String(availability.extendedProps.locationId),
        mode: String(availability.extendedProps.mode),
      }
    : null;
  pendingSlot = { start: startIso, end: endIso, resourceId, location };
  document.getElementById("create-date").textContent = fmt.long.format(asDate(startIso));
    document.getElementById("create-range").textContent = `${wallClock(startIso)} – ${wallClock(endIso)}`;
  const minutes = wallMinutes(startIso, endIso);
  document.getElementById("create-duration").textContent =
      `${minutes} min${resourceId ? ` · ${roomTitle(resourceId)}` : ""}${location ? ` · ${location.location}` : ""}`;
  createDialog.showModal();
}

/**
 * A new booking gets an aura for a few seconds. The flag lives in the
 * application, and `eventContent` puts it on the node, so re-renders in
 * between keep it without a second source of truth.
 * @param {string} id
 */
function markFresh(id) {
  fresh.add(id);
  window.setTimeout(() => {
    fresh.delete(id);
      const node = calendar.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
    if (node instanceof HTMLElement) delete node.dataset.fresh;
  }, 4600);
}

/** @param {any} item */
function openDetail(item) {
  detailId = item.id;
  const frozen = frozenReason(item);
  document.getElementById("detail-title").textContent = item.title ?? "Booking";
  const when =
    item.allDay === true
        ? `${fmt.long.format(asDate(String(item.start)))} · all day`
        : `${fmt.long.format(asDate(String(item.start)))} · ${wallClock(String(item.start))}–${wallClock(String(item.end))}`;
  document.getElementById("detail-meta").textContent =
    when +
      `${item.resourceId ? ` · ${roomTitle(String(item.resourceId))}` : ""} · ${item.extendedProps?.seats ?? "?"} seats` +
      `${frozen ? ` · ${frozen.label.toLocaleLowerCase()}` : ""}`;
  // The sheet obeys the same gate as the menus, and obeys it for both
  // verbs: a booking nobody may move is not a booking anybody may delete
  // either, which is what the sheet used to imply for locked kinds.
  document.getElementById("detail-shift").disabled = frozen !== null;
  document.getElementById("detail-delete").disabled = frozen !== null;
  detailDialog.showModal();
}

/**
 * Wall-clock +1h on the ISO string keeps the demo free of date math;
 * a real application would use Temporal here.
 * @param {string} iso
 */
function shiftHour(iso) {
    return iso.replace(/T(\d{2}):/, (_, hour) => `T${String((Number(hour) + 1) % 24).padStart(2, "0")}:`);
}

/** @param {string} id */
function shiftById(id) {
  const item = calendar.getEventById(id);
  if (!item) return false;
  // The same optimistic commit as a drag, so the same rules apply: a
  // refused command reports itself through `calendar:eventmove`.
  return Boolean(
    calendar.moveEvent(id, {
      start: shiftHour(String(item.start)),
      end: shiftHour(String(item.end)),
    }),
  );
}

/** Move an all-day booking forward by one civil day. @param {string} id */
function shiftDay(id) {
  const item = calendar.getEventById(id);
  if (item?.allDay !== true) return false;
  // Boundaries are canonical `Temporal.PlainDate`, so the day arithmetic
  // stays civil and the move walks through the same optimistic commit.
  const start = /** @type {any} */ (item.start).add({ days: 1 });
  const end = /** @type {any} */ (item.end).add({ days: 1 });
  return Boolean(calendar.moveEvent(id, { start, end }));
}

/**
 * `popover=auto` light dismiss closes on the pointer *release*, measured
 * against the element the press started on. Engines disagree on whether
 * `contextmenu` is dispatched before or after that release, so a menu
 * opened during the press is closed again by it. Waiting for the release
 * keeps the platform's dismissal instead of re-implementing it.
 *
 * @param {() => void} run
 */
function afterPointerRelease(run) {
  if (!pointerDown) {
    run();
    return;
  }
  document.addEventListener("pointerup", () => window.setTimeout(run, 0), { once: true });
}

/**
 * One menu, two kinds of row: an action, or a `note` that names a rule.
 * The note is what makes a disabled row honest - "Already over" over four
 * greyed verbs says why in one line, where four identical tooltips would
 * repeat themselves and a shorter menu would hide the verbs entirely.
 *
 * @param {Array<{ note: string, icon?: string } | { label: string, icon: string, danger?: boolean, disabled?: boolean, run: () => void }>} rows
 * @param {number} x
 * @param {number} y
 */
function openContextMenu(rows, x, y) {
  contextMenuList.replaceChildren();
  for (const row of rows) {
    if ("note" in row) {
      // Same shape as the grouped headings in the view menu: a
      // presentational `li` so the menu's own roles stay clean.
      const heading = document.createElement("li");
      heading.setAttribute("role", "presentation");
      const label = document.createElement("h3");
      label.className = "menu-label";
      if (row.icon) label.append(icon(row.icon), document.createTextNode(" "));
      label.append(document.createTextNode(row.note));
      heading.append(label);
      contextMenuList.append(heading);
      continue;
    }
    const action = row;
    const item = document.createElement("li");
    item.setAttribute("role", "none");
    const button = document.createElement("button");
    button.type = "button";
      button.className = `menu-item${action.danger ? " danger" : ""}`;
    button.setAttribute("role", "menuitem");
    button.disabled = Boolean(action.disabled);
    const iconSlot = document.createElement("span");
    iconSlot.className = "menu-item-icon";
    iconSlot.append(icon(action.icon));
    const text = document.createElement("span");
    text.className = "menu-item-text";
    text.textContent = action.label;
    button.append(iconSlot, text);
    button.addEventListener("click", () => {
      contextMenu.hidePopover();
      action.run();
    });
    item.append(button);
    contextMenuList.append(item);
  }
  afterPointerRelease(() => {
    if (contextMenu.matches(":popover-open")) contextMenu.hidePopover();
    contextMenu.showPopover();
    // Coordinate-driven placement: no reference element exists, and the
    // menu clamps itself to the viewport instead of guessing its own size.
    repositionAt(x, y, contextMenu, { placement: "bottom-start", distance: 2 });
  });
}

/** @param {any} item */
function duplicate(item) {
    const id = `copy-${Date.now()}`;
  const created = {
    id,
      title: `${item.title} (copy)`,
    start: String(item.start),
    end: String(item.end),
    ...(item.resourceId ? { resourceId: String(item.resourceId) } : {}),
    ...(item.allDay === true ? { allDay: true } : {}),
    extendedProps: { ...item.extendedProps },
  };
  store.push(created);
  markFresh(id);
  calendar.addEvent(created);
    record(`duplicated ${item.id} → ${id}`);
  refreshChrome();
}

function hideTip() {
  window.clearTimeout(tipTimer);
  tipStop?.();
  tipStop = undefined;
  tipId = "";
  if (tip.matches(":popover-open")) tip.hidePopover();
}

/**
 * @param {HTMLElement} node
 * @param {any} item
 */
function showTip(node, item) {
  const kind = item.extendedProps?.kind ?? "review";
  const start = String(item.start);
  const end = String(item.end);
  tip.replaceChildren();
  tip.dataset.kind = kind;

  const title = document.createElement("strong");
  title.textContent = item.title ?? "Booking";
  const rows = document.createElement("dl");
  /** @param {string} label @param {string} value */
  const row = (label, value) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    rows.append(dt, dd);
  };
    row("When", `${fmt.long.format(asDate(start))}, ${wallClock(start)}–${wallClock(end)}`);
  row("Room", roomTitle(String(item.resourceId ?? "")));
  row("Kind", kind);
  row("Seats", String(item.extendedProps?.seats ?? "?"));
  tip.append(title, rows);

  // The same verdict the menus grey their rows from, in the surface that
  // explains it before the user reaches for a verb - and with the same
  // label and marker, because they come from the same place.
  const frozen = frozenReason(item);
  if (frozen) {
    const note = document.createElement("p");
    note.className = "sc-tip-note";
    note.style.margin = "0";
    note.append(icon(frozen.icon));
    note.append(document.createTextNode(frozen.label));
    tip.append(note);
  } else if (POLICY.reviewedKinds.includes(kind)) {
    const note = document.createElement("p");
    note.className = "sc-tip-note";
    note.style.margin = "0";
    note.append(icon("clipboard-check"));
    note.append(document.createTextNode("Moves need desk confirmation"));
    tip.append(note);
  }

  tip.showPopover();
  const place = () => reposition(node, tip, { placement: "right-start", distance: 8 });
  place();
  // The calendar scroller moves independently of the page, so an overlay
  // anchored to an event has to follow the scroller, not the document.
  tipStop = autoUpdate(node, tip, place);
}
function overlaysInitHead() {

    anchorPopover(viewMenu, viewToggle);

    anchorPopover(toolsMenu, document.getElementById("tools-toggle"));

    anchorPopover(accountMenu, document.getElementById("account-toggle"));
}
function overlaysInit() {

    calendar.addEventListener("calendar:select", (event) => {
      const detail = event.detail;
      const start = String(detail.start);
      const end = String(detail.end);
      const resourceId = detail.resourceId;
      // A slot that cannot take a drop cannot take a booking either: the same
      // rule answers both, so the shell never offers what it will refuse.
      const reason =
        violation({ start, end, resourceId }, detail.context) ??
        occupancyReason(detail.context, {
          allDay: detail.allDay === true,
          room: resourceId,
        });
      if (reason) {
        event.preventDefault();
      record(`select refused: ${reason}`);
        toast(reason);
        return;
      }
    record(`select ${start.slice(0, 16)} → ${end.slice(0, 16)}${resourceId ? ` · ${resourceId}` : ""}`);
      openCreate(start, end, resourceId, detail.context);
    });

    document.getElementById("new-booking").addEventListener("click", () => {
      const room = ROOMS.find((item) => activeRooms.has(item.id));
      const resourceId = calendar.view.startsWith("resource") ? (room?.id ?? null) : null;
      if (sidebar.matches(":popover-open")) sidebar.hidePopover();
      const day = visibleDay();
      openCreate(stamp(day, 9 * 60), stamp(day, 9 * 60 + 30), resourceId);
    });

    createDialog.addEventListener("click", (event) => {
      const kind = event.target.closest("[data-create]")?.dataset?.create;
      if (!kind || !pendingSlot) return;
    const id = `${kind}-${Date.now()}`;
      if (kind === "background") {
        addExtraBackground({
          id,
          title: "Blocked range",
          start: pendingSlot.start,
          end: pendingSlot.end,
          classNames: ["sc-blocked"],
          ...(pendingSlot.resourceId ? { resourceId: pendingSlot.resourceId } : {}),
        });
        record("background created from selection");
      } else {
        const created = {
          id,
          title: kind === "blocked" ? "Blocked — do not book" : "New booking",
          start: pendingSlot.start,
          end: pendingSlot.end,
          ...(pendingSlot.resourceId ? { resourceId: pendingSlot.resourceId } : {}),
          extendedProps: {
            kind: kind === "blocked" ? "blocked" : "review",
            seats: 2,
            // The covering availability range donates its location: the slot
            // says where the booking would naturally happen, the form keeps it.
            ...(pendingSlot.location ? { ...pendingSlot.location } : {}),
          },
        };
        store.push(created);
        markFresh(id);
        calendar.addEvent(created);
      record(`event created: ${id}`);
        refreshChrome();
      }
      pendingSlot = null;
      createDialog.close();
    });

    calendar.addEventListener("calendar:eventclick", (event) => {
      const item = event.detail.event;
      openDetail(item);
    record(`eventclick: ${item.id}`);
    });

    document.getElementById("detail-shift").addEventListener("click", () => {
      if (detailId) shiftById(detailId);
      detailDialog.close();
    });

    document.getElementById("detail-delete").addEventListener("click", () => {
      if (detailId && calendar.removeEvent(detailId)) {
        if (copyClipboard?.id === detailId) clearCopyClipboard("lost its event");
        store = store.filter((item) => item.id !== detailId);
      record(`removed: ${detailId}`);
        refreshChrome();
      }
      detailId = null;
      detailDialog.close();
    });

    document.addEventListener("pointerdown", () => {
      pointerDown = true;
    }, true);

    document.addEventListener("pointerup", () => {
      pointerDown = false;
      dragging = false;
    }, true);

    calendar.addEventListener("calendar:eventcontextmenu", (event) => {
      event.preventDefault();
      const detail = event.detail;
      hideTip();
      const item = detail.event;
      const x = detail.clientX ?? detail.nativeEvent?.clientX ?? 0;
      const y = detail.clientY ?? detail.nativeEvent?.clientY ?? 0;

      if (item) {
        const frozen = frozenReason(item);
        const allDay = item.allDay === true;
        // Wall-clock duration travels with the copy clipboard; the paste target
        // supplies the new start. All-day bookings are civil and keep out of
        // the timed copy clipboard, but any kind of event can be parked.
        const durationMin = allDay
          ? 0
          : Math.max(
              15,
              wallMinutesOf(String(item.end)) - wallMinutesOf(String(item.start)),
            );

        // One menu shape, two reasons a verb can be refused: the booking is
        // over, or facilities own it. Both keep every row where it was and
        // grey out what they forbid, so the user reads what they would have
        // had and why, instead of a shorter menu that quietly omits it. The
        // heading names the rule; `editable: false` already told the core the
        // same thing, which is why no drag arms either.
        const frozenHere = frozen !== null;
        // "Move +1h" proposes a destination, so the destination rule is what
        // answers for it: `checkInteraction()` runs the very policy a pointer
        // drag runs, on the range this click would commit. The menu is then
        // honest before the click instead of accepting the move and explaining
        // a snap-back afterwards. The commit path keeps its own guard - this
        // is the menu telling the truth, not a new authority.
        const live = calendar.getEventById(String(item.id));
        const shifted = live
          ? allDay
            ? {
                start: /** @type {any} */ (live.start).add({ days: 1 }),
                end: /** @type {any} */ (live.end).add({ days: 1 }),
              }
            : { start: shiftHour(String(live.start)), end: shiftHour(String(live.end)) }
          : null;
        const shiftRefused =
          shifted !== null &&
          !calendar.checkInteraction({
            action: "move",
            event: live,
            start: shifted.start,
            end: shifted.end,
            resourceId: item.resourceId ?? null,
            allDay,
          }).ok;
        openContextMenu([
          ...(frozen ? [{ note: frozen.label, icon: frozen.icon }] : []),
          { label: "Open booking", icon: "arrow-up-right", run: () => openDetail(item) },
          allDay
            ? { label: "Move +1 day", icon: "calendar-repeat", disabled: frozenHere || shiftRefused, run: () => shiftDay(String(item.id)) }
            : { label: "Move +1h", icon: "clock-play", disabled: frozenHere || shiftRefused, run: () => shiftById(String(item.id)) },
          {
            label: "Cut",
            icon: "scissors",
            disabled: frozenHere,
            run: () => parkEvent(item),
          },
          {
            // Copy survives the archive rule on purpose: it carries a title
            // and a duration, and the paste target is a slot the policy still
            // has a say about. Rebooking last week's stand-up for next week is
            // the one replanning verb the past does allow.
            label: "Copy",
            icon: "copy",
            disabled: allDay,
            run: () => setCopyClipboard({
              id: String(item.id),
              title: String(item.title ?? "Booking"),
              durationMin,
            }),
          },
          {
            // Duplicate lands on the booking's own range, so a past one would
            // create a booking in the past - refused everywhere else.
            label: "Duplicate",
            icon: "copy-plus",
            disabled: frozen?.code === "archived",
            run: () => duplicate(item),
          },
          {
            label: "Delete",
            icon: "trash",
            danger: true,
            disabled: frozenHere,
            run: () => {
              if (copyClipboard?.id === String(item.id)) clearCopyClipboard("lost its event");
              workbench.remove(String(item.id));
              if (!calendar.removeEvent(item.id)) return;
              store = store.filter((entry) => entry.id !== item.id);
            record(`removed via menu: ${item.id}`);
              refreshChrome();
            },
          },
        ], x, y);
      record(`eventcontextmenu: ${item.id}${frozen ? ` (${frozen.code})` : ""}`);
        return;
      }

      // Empty slot: `time` is already slot-snapped, so the menu can propose a
      // real range instead of telling the user to drag.
      const date = String(detail.date);
      // `detail.time` is a zoned ISO string, so wall minutes read straight
      // off positions 11-16 (`wallClock` relies on the same layout).
      const minutes = detail.time ? wallMinutesOf(String(detail.time)) : POLICY.opensAt;
      const resourceId = detail.resourceId ?? null;

      // A day that is over greys out every verb below rather than dropping
      // them, exactly like a booking that is over. The last-slot target is the
      // one thing that is not merely greyed: it drives the placement preview
      // and `Ctrl+V`, neither of which should point into the past.
      const frozenDay = frozenDayReason(date);
      setLastSlot(frozenDay ? null : { date, minutes, resourceId });
      const slotActions = [];
      // Paste places the armed workbench item into this slot — the keyboard
      // twin of dragging the sidebar row onto the grid. Both run the same
      // `workbenchTargetReason` policy and `moveEvent` commit.
      const activeItem = workbench.active;
      if (activeItem) {
        const activeReason = workbenchTargetReason(String(activeItem.eventId), {
          date,
          minutes,
          resourceId,
          allDay: activeItem.original?.allDay === true,
        });
        slotActions.push({
        label: `Paste “${String(activeItem.original?.title ?? "Booking")}” here`,
          icon: "arrows-shuffle",
          disabled: frozenDay !== null || activeReason !== null,
          run: () => placeWorkbenchItem(String(activeItem.eventId), date, minutes, resourceId),
        });
      }
      if (copyClipboard) {
        const pasteStart = stamp(date, minutes);
        const pasteEnd = stamp(date, minutes + copyClipboard.durationMin);
        const pasteContext = calendar.getRangeContext({ start: pasteStart, end: pasteEnd, resourceId });
        const pasteReason =
          violation({ start: pasteStart, end: pasteEnd, resourceId }, pasteContext) ??
          occupancyReason(pasteContext, { room: resourceId, excludeEventId: copyClipboard.id });
        slotActions.push({
        label: `Paste a copy of “${copyClipboard.title}” here`,
          icon: "clipboard",
          disabled: frozenDay !== null || pasteReason !== null,
          run: () => pasteCopy({ date, minutes, resourceId }),
        });
      }
      // A slot inside an existing blocked range feeds the queue with the
      // bookings that overlap it — the "room/bay is closed" entry point.
      const blockedHere = blockedRangesOn(resourceId, date).filter(
        (range) => minutes < range.to && minutes + POLICY.maxMinutes > range.from,
      );
      if (blockedHere.length > 0) {
        slotActions.push({
          label: "Replanify bookings affected by this block",
          icon: "ban",
          disabled: frozenDay !== null,
          run: () => {
            const inBlock = calendar.events.filter((event) => {
              if (resourceId !== null && event.resourceId !== resourceId) return false;
              return blockedHere.some((range) => {
                const from = stamp(date, range.from);
                const to = stamp(date, range.to);
                return calendar
                  .getEventOverlaps({ start: from, end: to }, { resourceIds: resourceId ? [resourceId] : [] })
                  .some((entry) => String(entry.id) === String(event.id));
              });
            });
            const added = workbench.addMany(inBlock);
          record(`workbench +${added} overlapping blocked range (${date})`);
            if (added === 0) toast("No bookings overlap that block.", "warning");
          },
        });
      }
      openContextMenu([
        ...(frozenDay ? [{ note: "Already over", icon: "history" }] : []),
        ...slotActions,
        {
          label: "Book 30 minutes here",
          icon: "calendar-plus",
          disabled: frozenDay !== null,
          run: () => {
            const start = stamp(date, minutes);
            const end = stamp(date, minutes + 30);
            const context = calendar.getRangeContext({ start, end, resourceId });
            const reason =
              violation({ start, end, resourceId }, context) ??
              occupancyReason(context, { room: resourceId });
            if (reason) {
            record(`create refused: ${reason}`);
              toast(reason);
              return;
            }
            openCreate(start, end, resourceId);
          },
        },
        {
          label: "Block this hour",
          icon: "ban",
          disabled: frozenDay !== null,
          run: () => {
          const id = `blocked-${Date.now()}`;
            addExtraBackground({
              id,
              title: "Blocked by the operator",
              start: stamp(date, minutes),
              end: stamp(date, minutes + 60),
              classNames: ["sc-blocked"],
              ...(resourceId ? { resourceId } : {}),
            });
          record(`blocked ${date} ${clock(minutes)} for an hour`);
          },
        },
      ], x, y);
    record(`eventcontextmenu: empty slot ${date} ${clock(minutes)}${frozenDay ? " (over)" : ""}`);
    });

    // The core reports that a month day has more than it can show; this
    // application answers by opening that day.
    calendar.addEventListener("calendar:moreclick", (event) => {
      const { date, hidden } = event.detail;
      calendar.gotoDate(String(date));
      calendar.setView("day");
    record(`moreclick: ${date} (+${hidden} not shown) - opened the day`);
    });

    calendar.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse" || dragging) return;
      const node = event.target instanceof Element ? event.target.closest("[data-event-id]") : null;
      if (!(node instanceof HTMLElement)) return;
      const id = node.dataset.eventId ?? "";
      if (!id || id === tipId) return;
      const item = calendar.getEventById(id);
      if (!item) return;
      hideTip();
      tipId = id;
      tipTimer = window.setTimeout(() => showTip(node, item), 140);
    });

    calendar.addEventListener("pointerout", (event) => {
      const node = event.target instanceof Element ? event.target.closest("[data-event-id]") : null;
      if (!node) return;
      const next = event.relatedTarget;
      if (next instanceof Node && node.contains(next)) return;
      hideTip();
    });

    calendar.addEventListener("pointerdown", () => {
      dragging = true;
      hideTip();
    });
}
globalThis.ShowcaseOverlays = { anchorPopover, toast, openCreate, markFresh, openDetail, shiftHour, shiftById, shiftDay, afterPointerRelease, openContextMenu, duplicate, hideTip, showTip };
