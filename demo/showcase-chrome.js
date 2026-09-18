// showcase-chrome.js — activity log, views, toolbar and live strip, mini month, room and kind filters, boot and shell chrome.
// Classic script (file:// compatible): shares scope with the other showcase-*.js
// files, so top-level bindings stay bare and cross-file calls need no imports.
// Extracted verbatim from demo/showcase.html; see .temp/split-showcase.mjs.
"use strict";

const shell = document.getElementById("shell");

const sidebar = document.getElementById("sidebar");

const calendar = document.querySelector("calendar-view");

const log = document.getElementById("event-log");

const dockCount = document.getElementById("dock-count");

const cockpit = document.getElementById("cockpit");

// The element's own civil helpers, so the shell needs no date library and
// no second opinion on what a calendar day is.
const { toPlainDate } = /** @type {any} */ (calendar.constructor).dates;

let logged = 0;

let busy = false;

let lastIntent = "shell ready";

// --- Views --------------------------------------------------------------
/**
 * Seven views used to be seven buttons. One trigger naming the current
 * view is a fifth of the width, reads the same on a phone, and is where
 * the digit shortcuts are documented.
 */
const VIEWS = [
  { id: "day", label: "Day", short: "Day", icon: "columns-1", group: "Combined" },
  { id: "threeDays", label: "3 days", short: "3 days", icon: "columns-3", group: "Combined" },
  { id: "week", label: "Week", short: "Week", icon: "calendar-week", group: "Combined" },
  { id: "resourceDay", label: "Team day", short: "Team 1d", icon: "users", group: "By room" },
  { id: "resourceThreeDays", label: "Team 3 days", short: "Team 3d", icon: "users-group", group: "By room" },
  { id: "month", label: "Month", short: "Month", icon: "calendar-month", group: "Overview" },
  { id: "list", label: "List", short: "List", icon: "list-details", group: "Overview" },
];

const viewMenu = document.getElementById("view-menu");

// The popover is the menu itself: one element, one role, no wrapper that
// would need an `aria-label` it cannot carry.
const viewMenuList = viewMenu;

const viewToggle = document.getElementById("view-toggle");

const viewLabel = document.getElementById("view-label");

const viewIcon = document.getElementById("view-icon");

// --- Toolbar and chrome --------------------------------------------------
const anchorLabel = document.getElementById("anchor-label");

const anchorLong = document.getElementById("anchor-long");

const anchorShort = document.getElementById("anchor-short");

const anchorSub = document.getElementById("anchor-sub");

// --- Mini month: a navigator, not a date-picker -------------------------
// `<date-calendar selection="none">` owns the grid, the month/year header,
// the roving tabindex and the ARIA grid; this shell owns the policy alone.
// Every day stays activatable because `dateState` never returns `disabled`:
// `closed` and the markers answer "can I book this day", which is a
// different question from "can I navigate there".
const mini = document.getElementById("mini");

const miniLegend = document.getElementById("mini-legend");

/** Anchor ISO seen by the last render: a moved anchor re-follows it, while the component's own header browses freely until then. */
let lastAnchorIso = "";

/** First civil day of mini-month rows, mirroring the grid toggle. ISO 1-7, passed through as-is; `undefined` means "not pinned", which the component reads as Monday - it derives no first day from the locale, so the two agree by default. */
let miniFirstDay = 1;

/** The core's own month math, reached statically so the classic-script build (file:// friendly) shares it. */
const miniDates = /** @type {any} */ (calendar.constructor).dates;

/** The words behind each verdict, appended to the day's accessible name. */
const MINI_STATUS = {
  neutral: "no rooms selected",
  closed: "closed",
  full: "fully booked",
  soon: "nearly full",
  free: "free",
};

// --- Room checklist ------------------------------------------------------
const roomList = document.getElementById("room-list");

const roomSummary = document.getElementById("room-summary");

const roomAll = document.getElementById("room-all");

// --- Kind legend (also a filter) -----------------------------------------
const kindLegend = document.getElementById("kind-legend");

// --- Shell chrome ---------------------------------------------------------
// Below 64rem the sidebar is off-canvas. Making the same element a
// `popover` is what supplies the backdrop, the outside click and the
// Escape key, so the shell keeps no dismissal bookkeeping of its own.
const drawerQuery = window.matchMedia("(max-width: 63.999rem)");

const sidebarToggle = document.getElementById("sidebar-toggle");

const focusToggle = document.getElementById("focus-toggle");

const focusIcon = document.getElementById("focus-icon");

const activity = document.getElementById("activity");

const activityToggle = document.getElementById("activity-toggle");

const activityMenuItem = document.getElementById("activity-menu-item");

const shortcutsDialog = document.getElementById("shortcuts-dialog");

const SHORTCUTS = [
  [["T"], "today"],
  [["←", "→"], "previous / next range"],
  [["1", "…", "7"], "switch view"],
  [["/"], "search loaded bookings"],
  [["Ctrl+X"], "park the focused booking (workbench)"],
  [["Ctrl+C"], "copy the focused booking"],
  [["Ctrl+V"], "paste into the last right-clicked slot (previewed in the grid)"],
  [["Esc"], "disarm the workbench / clear the copy"],
  [["A"], "activity log"],
  [["F"], "focus mode (hide the side panel)"],
  [["?"], "this dialog"],
];

/** @param {string} message */
function record(message) {
  const item = document.createElement("li");
  item.textContent = message;
  log.prepend(item);
  while (log.children.length > 24) log.lastChild.remove();
  logged += 1;
  lastIntent = message;
  dockCount.textContent = String(logged);
  renderCockpit();
}

function renderViewMenu() {
  viewMenuList.replaceChildren();
  let group = null;
  VIEWS.forEach((view, index) => {
    if (view.group !== group) {
      group = view.group;
      const heading = document.createElement("li");
      heading.setAttribute("role", "presentation");
      const label = document.createElement("h3");
      label.className = "menu-label";
      label.textContent = group;
      heading.append(label);
      viewMenuList.append(heading);
    }
    const item = document.createElement("li");
    item.setAttribute("role", "none");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-item";
    button.setAttribute("role", "menuitemradio");
    button.dataset.view = view.id;
    const active = calendar.view === view.id;
    button.setAttribute("aria-checked", String(active));
    button.setAttribute("aria-pressed", String(active));
    const iconSlot = document.createElement("span");
    iconSlot.className = "menu-item-icon";
    iconSlot.append(icon(view.icon));
    const text = document.createElement("span");
    text.className = "menu-item-text";
    text.textContent = view.label;
    const end = document.createElement("span");
    end.className = "menu-item-end";
    const key = document.createElement("kbd");
    key.className = "key";
    key.textContent = String(index + 1);
    end.append(key, icon("check"));
    end.lastElementChild.classList.add("sc-tick");
    button.append(iconSlot, text, end);
    button.addEventListener("click", () => {
      viewMenu.hidePopover();
      calendar.setView(view.id);
    });
    item.append(button);
    viewMenuList.append(item);
  });

  const current = VIEWS.find((view) => view.id === calendar.view);
  viewLabel.textContent = current?.label ?? calendar.view;
    viewIcon.className = `ti ti-${current?.icon ?? "calendar-week"}`;
    viewToggle.title = `View: ${current?.label ?? calendar.view}`;
}

function refreshChrome() {
  const view = calendar.view;
  const { start, end } = calendar.getVisibleRange();
  const anchor = calendar.date.toString();
  // The label describes what is rendered, which is not the anchor: `week`
  // snaps to the civil week, and hidden days can move a range's first day.
  // The anchor stays on the element for anything that needs the exact day.
  const first = start.toString();
  const last = end.subtract({ days: 1 }).toString();
  anchorLabel.dataset.date = anchor;
  if (view === "month") {
    anchorLong.textContent = fmt.month.format(asDate(anchor));
    anchorShort.textContent = fmt.month.format(asDate(anchor));
  } else if (first === last) {
    anchorLong.textContent = fmt.long.format(asDate(first));
    anchorShort.textContent = fmt.range.format(asDate(first));
  } else {
      anchorLong.textContent = `${fmt.range.format(asDate(first))} – ${fmt.range.format(asDate(last))} ${last.slice(0, 4)}`;
      anchorShort.textContent = `${fmt.short.format(asDate(first))} – ${fmt.short.format(asDate(last))}`;
  }
  // `weekOfYear` is the ISO week, which is what a room schedule is
  // referred by; it needs no date library either.
  if (view === "month") {
      anchorSub.textContent = `${inCurrentRange(calendar.events).length} bookings`;
  } else {
    const zone = document.createElement("span");
    zone.className = "sc-wide";
      zone.textContent = ` · ${calendar.timeZone ?? ZONE}`;
    anchorSub.replaceChildren(
        document.createTextNode(`week ${start.weekOfYear} · ${effectiveLocale() ?? "auto"}`),
      zone,
    );
  }

  renderViewMenu();
  refreshBackgrounds();
  renderMiniMonth();
  renderRooms();
  renderLegend();
  renderCockpit();
}

/**
 * Bookings the core currently reports as running. The fact is read off
 * the rendered nodes rather than recomputed: every event node carries
  * `data-temporal-state`, one event can occupy several nodes when it
 * spans days, and the core re-renders by itself at the next start/end
 * boundary. So this counter ages on its own - the shell owns no clock,
 * no interval and no `now` of its own for it.
 */
function inProgressCount() {
  const ids = new Set();
  for (const node of calendar.querySelectorAll('[data-temporal-state="current"]')) {
    const id = /** @type {HTMLElement} */ (node).dataset.eventId;
    if (id) ids.add(id);
  }
  return ids.size;
}

function renderCockpit() {
  const inRange = inCurrentRange(calendar.events);
  const now = nowStamp();
  const upcoming = [...calendar.events]
      .map((item) => ({ item, key: `${String(item.start).slice(0, 10)} ${wallClock(String(item.start))}` }))
    .filter((entry) => entry.key >= now)
    .sort((a, b) => (a.key < b.key ? -1 : 1))[0];

  const busiest = ROOMS.map((room) => ({
    room,
    count: inRange.filter((item) => item.resourceId === room.id).length,
  })).sort((a, b) => b.count - a.count)[0];

  cockpit.replaceChildren();
  cockpit.append(
    chip(
      busy
        ? [dot(), strong("Loading"), " from the event source"]
        : [dot(), strong(String(inRange.length)), " bookings in view"],
    ),
    chip(upcoming
        ? ["Next: ", strong(String(upcoming.item.title)), ` ${whenLabel(String(upcoming.item.start))} · ${roomTitle(String(upcoming.item.resourceId ?? ""))}`]
      : ["Nothing scheduled after ", strong(now.slice(11))]),
      chip([strong(`${activeRooms.size}/${ROOMS.length}`), " rooms shown"]),
    chip(busiest?.count > 0 ? ["Busiest: ", strong(busiest.room.title)] : ["No room loaded"]),
    lastChip(),
  );
  const running = inProgressCount();
  if (running > 0) {
    const node = chip([dot(), strong(String(running)), " in progress"]);
    node.className = "sc-now-chip";
    cockpit.insertBefore(node, cockpit.children[1] ?? null);
  }
}

/** The newest intent, so the log can stay closed without looking dead. */
function lastChip() {
  const node = document.createElement("span");
  node.className = "sc-last";
  node.append(icon("history"));
  const text = document.createElement("span");
  text.textContent = lastIntent;
  node.append(text);
  return node;
}

/**
 * `at 14:00` for today, `Fri 4 Sept, 09:00` otherwise.
 * @param {string} iso
 */
function whenLabel(iso) {
  const day = iso.slice(0, 10);
  const time = wallClock(iso);
  // All-day boundaries carry no wall clock: the day is the whole story.
  if (!time) return fmt.range.format(asDate(day));
    if (day === todayIso()) return `at ${time}`;
    return `${fmt.day.format(asDate(day))} ${fmt.range.format(asDate(day))}, ${time}`;
}

/** @param {Array<string | Node>} parts */
function chip(parts) {
  const node = document.createElement("span");
  node.append(...parts);
  return node;
}

/** @param {string} text */
function strong(text) {
  const node = document.createElement("strong");
  node.textContent = text;
  return node;
}

function dot() {
  const node = document.createElement("span");
  node.className = "sc-dot";
  return node;
}

/** @param {string} label @param {string} [tone] */
function legendItem(label, tone = "") {
  const item = document.createElement("span");
  item.className = "sc-mini-legend-item";
  const marker = dot();
  if (tone) marker.classList.add(tone);
  const text = document.createElement("span");
  text.textContent = label;
  item.append(marker, text);
  return item;
}

/**
 * Free wall-clock parts of `window` after removing every covered range.
 * Ranges are minutes from midnight; adjacent ranges merge, so only
 * strictly positive intervals come back.
 *
 * @param {{ from: number, to: number }} window
 * @param {{ from: number, to: number }[]} covered
 */
function freeIntervals(window, covered) {
  const edges = covered
    .filter((range) => range.to > range.from)
    .map((range) => ({ from: Math.max(range.from, window.from), to: Math.min(range.to, window.to) }))
    .filter((range) => range.to > range.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  /** @type {{ from: number, to: number }[]} */
  const free = [];
  let cursor = window.from;
  for (const range of edges) {
    if (range.from > cursor) free.push({ from: cursor, to: range.from });
    cursor = Math.max(cursor, range.to);
  }
  if (window.to > cursor) free.push({ from: cursor, to: window.to });
  return free;
}

/** Whole civil days between two `YYYY-MM-DD` dates. */
function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
}

/**
 * Day state for one mini-month cell, from application data: blocked
 * ranges and booked time decide together whether a free interval
 * remains. Availability reflects the events currently shown, so filters
 * move the markers exactly like they move the grid.
 *
 * @param {string} iso civil date, `YYYY-MM-DD`
 * @param {number} weekday ISO day of week, 1 = Monday .. 7 = Sunday
 */
function miniDayState(iso, weekday) {
  const window = { from: POLICY.opensAt, to: POLICY.closesAt };
  const rooms = [...activeRooms];
  // No room selected is not a verdict: the day stays open and unmarked,
  // because turning "none" into "full" would lie about availability.
  if (rooms.length === 0) {
    return { closed: false, hasAvailability: false, bookable: false, soonFull: false, neutral: true };
  }
  const blocked = BLOCKED.filter(
    (range) => range.dayOfWeek === null || range.dayOfWeek === weekday,
  ).map((range) => ({ resourceId: range.resourceId, from: range.from, to: range.to }));
  const occupied = occupiedForMini(iso);
  const forRoom = (/** @type {string} */ room, /** @type {{ resourceId: string | null, from: number, to: number }[]} */ ranges) =>
    ranges
      .filter((range) => range.resourceId === null || range.resourceId === room)
      .map((range) => ({ from: range.from, to: range.to }));
  // `closed` is structural: blocked ranges can take a room off the day,
  // bookings cannot — a fully-booked day is open, just without a dot.
  const everyRoomBlocked =
    rooms.length > 0 &&
    rooms.every((room) => freeIntervals(window, forRoom(room, blocked)).length === 0);
  const closed = weekday === 7 || POLICY.closedWeekdays.includes(weekday) || everyRoomBlocked;
  const freePerRoom = rooms.map(
    (room) =>
      freeIntervals(window, [...forRoom(room, blocked), ...forRoom(room, occupied)]).reduce(
        (sum, interval) => sum + (interval.to - interval.from),
        0,
      ),
  );
  const maxFree = Math.max(...freePerRoom);
  const hasAvailability = !closed && maxFree > 0;
  const soonFull = hasAvailability && maxFree < POLICY.nearFullFreeMinutes;
  const ahead = daysBetween(todayIso(), iso);
  const inAdvanceWindow = ahead >= POLICY.minAdvanceDays && ahead <= POLICY.maxAdvanceDays;
  const bookable =
    hasAvailability && ahead >= 0 && (POLICY.viewer === "admin" || inAdvanceWindow);
  return { closed, hasAvailability, bookable, soonFull, neutral: false };
}

/**
 * Booked wall-clock minutes per room for one civil date, clipped to the
 * day. A range ending exactly at midnight does not occupy the next day.
 *
 * @param {string} iso civil date, `YYYY-MM-DD`
 */
function occupiedForMini(iso) {
  /** @type {Array<{ resourceId: string | null, from: number, to: number }>} */
  const ranges = [];
  for (const item of calendar.events) {
    // An all-day booking claims its whole civil day for the room.
    if (item.allDay === true) {
      const day = String(item.start).slice(0, 10);
      const last = String(item.end).slice(0, 10);
      if (iso >= day && iso < last) {
        ranges.push({ resourceId: item.resourceId ?? null, from: 0, to: 24 * 60 });
      }
      continue;
    }
    const start = String(item.start);
    const end = String(item.end);
    const startDay = start.slice(0, 10);
    const endDay = end.slice(0, 10);
    if (iso < startDay || iso > endDay) continue;
    const from = startDay === iso ? wallMinutesOf(start) : 0;
    const to = endDay === iso ? wallMinutesOf(end) : 24 * 60;
    if (to <= from || (endDay === iso && to <= 0)) continue;
    ranges.push({ resourceId: item.resourceId ?? null, from, to });
  }
  return ranges;
}

/**
 * `first-day` counts 0-6 with Sunday = 0 and takes ISO 7 as a Sunday alias
 * (date-picker 0.3.0), so the core's Temporal 1-7 goes straight through
 * and no pin at all reads as Monday on both sides.
 */
function applyMiniFirstDay() {
  const attribute = String(miniFirstDay ?? 1);
  // Guarded: `setAttribute` re-renders the component even when the value
  // is unchanged, and this runs on every render beat.
  if (mini.getAttribute("first-day") !== attribute) mini.setAttribute("first-day", attribute);
}

/** The legend follows the viewer, exactly like the markers do. */
function renderMiniLegend() {
  miniLegend.replaceChildren(
    legendItem(POLICY.viewer === "admin" ? "Free" : "Bookable for you"),
    legendItem("Nearly full", "is-warning"),
    legendItem("Fully booked", "is-danger"),
  );
}

function renderMiniMonth() {
  const anchorIso = calendar.date.toString();
  if (anchorIso !== lastAnchorIso) {
    lastAnchorIso = anchorIso;
    // The anchor is application state, not the component's: `focusedDate`
    // is dragged into whatever month `display` shows, so it can never hold
    // an anchor the user has browsed away from. Assigning the property
    // never steals focus, which the agenda needs to keep.
    mini.focusedDate = anchorIso;
  }
  applyMiniFirstDay();
  // Verdicts are re-derived per cell on render, so this one call is how a
  // filter, a booking or a viewer switch reaches the markers.
  mini.render();
  renderMiniLegend();
}

/**
 * The sidebar sections, following the same rule the core applies to the
 * columns: declared group order, `ROOMS` order inside a group, first
 * declaration of an id wins, and anything left over trails in a section
 * with no heading. The shell derives it itself because filtering by group
 * is application work - the core only ever receives `resourceIds`.
 *
 * @returns {Array<{ group: { id: string, title: string } | null, rooms: typeof ROOMS }>}
 */
function roomSections() {
  const seen = new Set();
  const sections = [];
  for (const group of groupRooms ? ROOM_GROUPS : []) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const rooms = ROOMS.filter((room) => room.groupId === group.id);
    if (rooms.length > 0) sections.push({ group, rooms });
  }
  const leftover = ROOMS.filter((room) => !room.groupId || !seen.has(room.groupId));
  if (leftover.length > 0) sections.push({ group: null, rooms: leftover });
  return sections;
}

/**
 * A whole group in one click. Nothing group-shaped reaches the core: this
 * only ever ends up as a different set of `resourceIds`.
 *
 * @param {{ id: string, title: string }} group
 * @param {typeof ROOMS} rooms
 */
function groupHeadingRow(group, rooms) {
  const item = document.createElement("li");
  const label = document.createElement("label");
  label.className = "sc-check sc-check-group";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "check";
  input.dataset.groupId = group.id;
  const active = rooms.filter((room) => activeRooms.has(room.id)).length;
  input.checked = active === rooms.length;
  input.indeterminate = active > 0 && active < rooms.length;
  input.addEventListener("change", () => {
    for (const room of rooms) {
      if (input.checked) activeRooms.add(room.id);
      else activeRooms.delete(room.id);
    }
      record(`rooms → ${group.title} ${input.checked ? "on" : "off"}`);
    applyFilters();
  });
  const text = document.createElement("span");
  text.textContent = group.title;
  label.append(input, text, icon("building"));
  item.append(label);
  return item;
}

/** @param {(typeof ROOMS)[number]} room */
function roomRow(room) {
  const item = document.createElement("li");
  const label = document.createElement("label");
  label.className = "sc-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "check";
  input.dataset.roomId = room.id;
  input.checked = activeRooms.has(room.id);
  input.addEventListener("change", () => {
    if (input.checked) activeRooms.add(room.id);
    else activeRooms.delete(room.id);
      record(`rooms → ${[...activeRooms].join(", ") || "none"}`);
    applyFilters();
  });
  const text = document.createElement("span");
  text.textContent = room.title;
  const count = document.createElement("span");
  count.className = "sc-count-mini";
  count.textContent = String(
    inCurrentRange(visibleStore().filter((event) => event.resourceId === room.id)).length,
  );
  label.append(input, text, count);
  item.append(label);
  return item;
}

function renderRooms() {
    roomSummary.textContent = `${activeRooms.size}/${ROOMS.length}`;
  roomAll.checked = activeRooms.size === ROOMS.length;
  roomAll.indeterminate = activeRooms.size > 0 && activeRooms.size < ROOMS.length;
  roomList.replaceChildren();
  for (const section of roomSections()) {
    if (section.group) roomList.append(groupHeadingRow(section.group, section.rooms));
    for (const room of section.rooms) roomList.append(roomRow(room));
  }
  roomList.dataset.grouped = String(roomSections().some((section) => section.group !== null));
}

function renderLegend() {
  kindLegend.replaceChildren();
  for (const kind of KINDS) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.kind = kind.id;
    button.setAttribute("aria-pressed", String(activeKinds.has(kind.id)));
    const swatch = document.createElement("span");
    swatch.className = "sc-swatch";
    const label = document.createElement("span");
    label.textContent = kind.label;
    const count = document.createElement("span");
    count.className = "sc-count-mini";
    count.textContent = String(
      inCurrentRange(store.filter((event) => event.extendedProps?.kind === kind.id)).length,
    );
    button.append(swatch, label, count);
    button.addEventListener("click", () => {
      if (activeKinds.has(kind.id)) activeKinds.delete(kind.id);
      else activeKinds.add(kind.id);
        record(`kinds → ${[...activeKinds].join(", ") || "none"}`);
      applyFilters();
    });
    item.append(button);
    kindLegend.append(item);
  }
}

// --- Booking rules, written from the constants the guard enforces --------
function renderRules() {
  const rules = [
      ["clock-hour-8", `Bookings run ${clock(POLICY.opensAt)} – ${clock(POLICY.closesAt)}; closed hours are shaded.`],
    ["sun", "Green bands are bookable hours; amber bands are extended desk hours, also bookable."],
      ["hourglass-low", `A booking cannot exceed ${POLICY.maxMinutes / 60} hours.`],
    ["ban", "Hatched ranges are non-bookable. A slot that names no room is only refused when every room is blocked."],
    ["beach", "Saturdays are view-only, Sundays are not rendered."],
    ["lock", "Maintenance is owned by facilities and cannot be dragged."],
    ["user-off", "Absences and external busy ranges block their own slots."],
    ["history", "Events that are over stay put — no drag, resize or rebooking into the past."],
    ["clipboard-check", "Deadlines are confirmed by the desk, and rolled back if refused."],
  ];
  const list = document.getElementById("rules");
  list.replaceChildren();
  for (const [name, text] of rules) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = text;
    item.append(icon(name), label);
    list.append(item);
  }
}

/**
 * Grouping is a declaration, not a reordering: `calendar.resources` keeps
 * this application's own order and the core derives the sections. A group
 * whose rooms are all filtered out produces no section at all, so nothing
 * here has to prune the list.
 */
function applyRoomGroups() {
  calendar.resourceGroups = groupRooms ? ROOM_GROUPS : [];
}

function applyFilters() {
  calendar.resources = ROOMS.filter((room) => activeRooms.has(room.id));
  calendar.events = visibleStore();
  backgroundKey = "";
  // A target in a now-hidden resource stays a stale `Ctrl+V` destination
  // otherwise; the preview going dark is the visible half of that cleanup.
  setLastSlot(null);
  refreshChrome();
}

function syncDrawerMode() {
  if (drawerQuery.matches) {
    if (!sidebar.hasAttribute("popover")) sidebar.setAttribute("popover", "auto");
    return;
  }
  if (sidebar.matches(":popover-open")) sidebar.hidePopover();
  sidebar.removeAttribute("popover");
  sidebarToggle.setAttribute("aria-expanded", "false");
}

/** @param {boolean} [force] */
function toggleActivity(force) {
  const open = force ?? activity.hidden;
  activity.hidden = !open;
  activityToggle.setAttribute("aria-expanded", String(open));
  activityMenuItem.setAttribute("aria-checked", String(open));
}

function renderShortcuts() {
  const list = document.getElementById("shortcuts-list");
  list.replaceChildren();
  for (const [keys, description] of SHORTCUTS) {
    const dt = document.createElement("dt");
    for (const key of keys) {
      const kbd = document.createElement("kbd");
      kbd.className = "key";
      kbd.textContent = key;
      dt.append(kbd);
    }
    const dd = document.createElement("dd");
    dd.textContent = description;
    list.append(dt, dd);
  }
}
function chromeInit() {
    // First use of the shell formatters (was a load-time initializer inline;
    // deferred so the calendar binding exists). Everything below may format.
    fmt = buildFormatters(effectiveLocale());

    /**
     * Application state for one cell. `disabled` is never returned: a closed
     * or fully-booked day still navigates. The verdict rides `state.verdict`
     * for `renderDay` to decorate, and `description` for the screen reader -
     * the component appends it to the day's own accessible name, so the
     * marker is never colour-only.
     *
     * @param {string} iso civil date, `YYYY-MM-DD`
     */
    mini.dateState = (iso) => {
      const state = miniDayState(iso, miniDates.toPlainDate(iso).dayOfWeek);
      // A day carries exactly one verdict: closed, full, nearly full or
      // available - never a mix, and never a verdict when no room is on.
      let verdict = "";
      if (state.neutral) verdict = "neutral";
      else if (state.closed) verdict = "closed";
      else if (!state.hasAvailability) verdict = "full";
      else if (state.soonFull) verdict = "soon";
      else if (POLICY.viewer === "admin" ? state.hasAvailability : state.bookable) verdict = "free";
      // `aria-current="date"` is the component's marker for today, so the
      // agenda anchor says what it is in words rather than borrowing it.
      const anchor = iso === calendar.date.toString();
      const description = [MINI_STATUS[verdict] ?? "", anchor ? "shown in the agenda" : ""]
        .filter(Boolean)
        .join(", ");
      return { verdict, anchor, description };
    };

    /**
     * One decorative node per day, placed by the component in an
     * `aria-hidden` slot at the bottom of the cell. The class name is ours,
     * which is the whole contract: `renderDay` promises the node, never the
     * container it lands in.
     *
     * @param {string} iso @param {{ verdict: string, anchor: boolean }} state
     */
    mini.renderDay = (iso, state) => {
      if (!state.verdict && !state.anchor) return null;
      const marker = document.createElement("span");
      marker.className = "sc-mini-marker";
      if (state.verdict) marker.dataset.state = state.verdict;
      if (state.anchor) marker.dataset.anchor = "true";
      return marker;
    };

    // Activation is navigation: the anchor moves and no value is ever taken,
    // which is what `selection="none"` buys. A closed day reaches here too.
    mini.addEventListener("dateactivate", (event) => {
      calendar.gotoDate(event.detail.date);
    });

    // The dots describe the events currently shown: the core already renders
    // on every mutation, so `calendar:render` is the one beat to watch.
    // `renderMiniMonth` only touches this shell's chrome, never the core.
    // The one-shot aging timer re-renders at the next start/end
    // boundary without any navigation, so the "in progress" counter has to
    // ride `calendar:render` rather than the navigation beats.
    calendar.addEventListener("calendar:render", () => {
      renderMiniMonth();
      renderCockpit();
    });

    // The master toggle flips every room at once: checked for all, unchecked
    // for none, indeterminate for the middle — `<input type="checkbox">`
    // carries `indeterminate` natively, no ARIA needed.
    roomAll.addEventListener("change", () => {
      for (const room of ROOMS) {
        if (roomAll.checked) activeRooms.add(room.id);
        else activeRooms.delete(room.id);
      }
      record(roomAll.checked ? "rooms → all" : "rooms → none");
      applyFilters();
    });

    // --- Boot ---------------------------------------------------------------
    // A phone opens on a single day: the grid is what the user came for.
    if (window.innerWidth < 640) calendar.setView("day");

    // The element resolved its default `date` in UTC at connect time, before
    // `configure({ timeZone: ZONE })` could run: around Brussels midnight the
    // two "today"s disagree by a day, which would shift the seed window and
    // freeze the anchor day's bookings. Pin the anchor to the shell's own
    // today now that the zone is set.
    if (String(calendar.date) !== todayIso()) calendar.gotoDate(todayIso());

    store = seedStore();

    calendar.resources = ROOMS;

    applyRoomGroups();

    calendar.events = visibleStore();

    // --- Navigation ----------------------------------------------------------
    document.getElementById("nav-prev").addEventListener("click", () => calendar.prev());

    document.getElementById("nav-next").addEventListener("click", () => calendar.next());

    document.getElementById("nav-today").addEventListener("click", () => calendar.today());

    // The core announces its own state changes; the shell just follows.
    // Navigation also spends the keyboard target: a preview for another date
    // must not linger, and `Ctrl+V` must not reuse a stale slot.
    calendar.addEventListener("calendar:viewchange", () => {
      setLastSlot(null);
      refreshChrome();
    });

    calendar.addEventListener("calendar:datechange", () => {
      setLastSlot(null);
      refreshChrome();
    });

    calendar.addEventListener("calendar:loading", (event) => {
      busy = event.detail.loading;
      shell.dataset.busy = String(busy);
      renderCockpit();
    });

    calendar.addEventListener("calendar:loaderror", (event) => {
    record(`source error: ${event.detail?.error?.message ?? "unknown"}`);
    toast(`The event source failed: ${event.detail?.error?.message ?? "unknown"}`, "warning");
    });

    // Nodes are rebuilt on every render, so an overlay anchored to one has
    // to let go rather than follow a detached reference.
    calendar.addEventListener("calendar:render", () => hideTip());
}
function chromeInitShell() {

    drawerQuery.addEventListener("change", syncDrawerMode);

    syncDrawerMode();

    sidebar.addEventListener("toggle", (event) => {
      const open = event.newState === "open";
      shell.dataset.drawer = open ? "open" : "closed";
      sidebarToggle.setAttribute("aria-expanded", String(open));
    });

    focusToggle.addEventListener("click", () => {
      const on = shell.dataset.focus !== "true";
      shell.dataset.focus = String(on);
      focusToggle.setAttribute("aria-pressed", String(on));
    focusIcon.className = `ti ti-lg ti-layout-sidebar-left-${on ? "expand" : "collapse"}`;
    });

    activityToggle.addEventListener("click", () => toggleActivity());

    document.getElementById("activity-close").addEventListener("click", () => toggleActivity(false));

    document.getElementById("shortcuts-open").addEventListener("click", () => {
      if (sidebar.matches(":popover-open")) sidebar.hidePopover();
      shortcutsDialog.showModal();
    });

    // Workbench and clipboard keys. Cut parks the focused event (add + arm it in
    // the workbench); copy duplicates through the copy clipboard; paste uses the
    // last empty-slot intent (right-click a slot first). Escape disarms the
    // active item and clears any pending copy. Typing in a field keeps the OS
    // behavior: the shell never hijacks text editing.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        if (workbench.activeId) workbench.activate(null);
        clearCopyClipboard("cancelled with Esc");
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      const typing = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
      if (typing) return;
      const key = event.key.toLowerCase();
      const node = target instanceof HTMLElement ? target.closest("[data-event-id]") : null;
      if ((key === "x" || key === "c") && node) {
        const item = calendar.getEventById(node.dataset.eventId ?? "");
        if (!item) return;
        if (key === "x" && !isLocked(item)) {
          event.preventDefault();
          parkEvent(item);
        } else if (key === "c" && item.allDay !== true) {
          // Copy is a timed workflow (payload travels as minutes); all-day
          // bookings keep to the lane and the day-based context actions.
          event.preventDefault();
          setCopyClipboard({
            id: String(item.id),
            title: String(item.title ?? "Booking"),
            durationMin: Math.max(15, wallMinutesOf(String(item.end)) - wallMinutesOf(String(item.start))),
          });
        }
        return;
      }
      if (key === "v" && lastSlot) {
        // The armed workbench item wins: paste = place it. A copy clipboard is
        // the fallback when nothing is armed.
        const armed = workbench.active;
        if (armed) {
          event.preventDefault();
          placeWorkbenchItem(String(armed.eventId), lastSlot.date, lastSlot.minutes, lastSlot.resourceId);
        } else if (copyClipboard) {
          event.preventDefault();
          pasteCopy(lastSlot);
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= VIEWS.length) {
        calendar.setView(VIEWS[digit - 1].id);
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        openSearch();
      } else if (event.key === "?") {
        event.preventDefault();
        shortcutsDialog.showModal();
      } else if (event.key === "t" || event.key === "T") {
        calendar.today();
      } else if (event.key === "a" || event.key === "A") {
        toggleActivity();
      } else if (event.key === "ArrowLeft") {
        calendar.prev();
      } else if (event.key === "ArrowRight") {
        calendar.next();
      } else if (event.key === "f" || event.key === "F") {
        focusToggle.click();
      }
    });

    // `.dialog-close` is a plain button, so one listener replaces the
    // `<form method="dialog">` wrappers the sheets used to carry. A click on
    // the backdrop closes them too: the dialog's own box is the sheet body, so
    // the element itself is only ever the target from outside it.
    for (const dialog of document.querySelectorAll("dialog.sc-dialog")) {
      dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    }

    renderRules();

    renderThemes();

    renderSkins();

    renderLocales();

    renderShortcuts();

    refreshChrome();

    calendar.scrollToTime("08:00");

    record("shell ready: core renders, app owns the chrome");
}
globalThis.ShowcaseChrome = { record, renderViewMenu, refreshChrome, inProgressCount, renderCockpit, lastChip, whenLabel, chip, strong, dot, legendItem, freeIntervals, daysBetween, miniDayState, occupiedForMini, applyMiniFirstDay, renderMiniLegend, renderMiniMonth, roomSections, groupHeadingRow, roomRow, renderRooms, renderLegend, renderRules, applyRoomGroups, applyFilters, syncDrawerMode, toggleActivity, renderShortcuts };
