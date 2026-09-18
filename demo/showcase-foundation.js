// showcase-foundation.js — fictitious dataset, time helpers, seed, booking policy, backgrounds and locale.
// Classic script (file:// compatible): shares scope with the other showcase-*.js
// files, so top-level bindings stay bare and cross-file calls need no imports.
// Extracted verbatim from demo/showcase.html; see .temp/split-showcase.mjs.
"use strict";

const ZONE = "Europe/Brussels";


// --- Fictitious generic dataset: rooms × bookings ---------------------
const ROOMS = [
  { id: "room-a", title: "Room A · Atrium", groupId: "main" },
  { id: "room-b", title: "Room B · Loft", groupId: "main" },
  { id: "room-c", title: "Room C · Studio", groupId: "annexe" },
];


/**
  * One level, on purpose: the array order is the section order, the
 * `ROOMS` order is the order inside a section, and a room whose `groupId`
 * matches nothing declared here simply trails without a header. Grouping
 * is a visual derivation in the resource grids - `calendar.resources`
 * keeps this application's own order, and filtering by group stays here,
 * over `resourceIds`, because the core never filters by group.
 */
const ROOM_GROUPS = [
  { id: "main", title: "Main building" },
  { id: "annexe", title: "Annexe" },
];


const KINDS = [
  { id: "review", label: "Review" },
  { id: "planning", label: "Planning" },
  { id: "workshop", label: "Workshop" },
  { id: "deadline", label: "Deadline" },
  { id: "maintenance", label: "Maintenance" },
  { id: "absence", label: "Absence" },
];


/** Tabler glyph per kind, for list rows and tooltips. */
const KIND_ICONS = {
  review: "clipboard-check",
  planning: "calendar-check",
  workshop: "users",
  deadline: "alarm",
  maintenance: "tool",
  absence: "user-off",
};


const TITLES = {
  review: ["Design review", "Code review", "Portfolio review", "Quarterly review"],
  planning: ["Sprint planning", "Roadmap sync", "Capacity planning", "Weekly stand-up"],
  workshop: ["Discovery workshop", "Onboarding workshop", "Retro workshop", "Training session"],
  deadline: ["Release gate", "Freeze deadline", "Handover", "Demo Friday"],
  maintenance: ["Equipment check", "Network maintenance", "Deep clean", "Inventory"],
  absence: ["Absence", "Out of office", "Training away", "Conference day"],
};


/**
 * The application's booking policy. `calendar:eventmove` and
 * `calendar:eventresize` are cancelable and carry `revert()`, so these
 * constants are the whole reason a drop can be refused - the core knows
 * none of them.
 */
const POLICY = {
  opensAt: 8 * 60,
  closesAt: 18 * 60,
  maxMinutes: 4 * 60,
  // Saturday is staffed for viewing only; Sunday is not rendered at all.
  closedWeekdays: [6],
  // Kinds the facilities team owns: the core refuses the drag itself,
  // because the application hands them `editable: false`.
  lockedKinds: ["maintenance"],
  // Kinds the scheduling desk confirms after the fact, which is the
  // asynchronous half of the contract: accept, await, then `revert()`.
  reviewedKinds: ["deadline"],
  reviewDelay: 550,
  // Booking viewer for the mini-month markers: `admin` sees every open
  // day from today on, `external` additionally needs the advance window.
  viewer: "admin",
  minAdvanceDays: 2,
  maxAdvanceDays: 60,
  // A day is "nearly full" when it still has a free interval somewhere,
  // but even the room with the most room left has less than an hour: the
  // amber marker names busy-but-bookable, red means nothing left at all.
  nearFullFreeMinutes: 60,
};


/**
 * Non-bookable ranges, in wall-clock minutes. `dayOfWeek` is ISO
 * (1 = Monday) or null for every day. They are rendered as background
 * ranges, so the rule the guard enforces is the rule the user sees.
 */
const BLOCKED = [
  { resourceId: "room-c", dayOfWeek: null, from: 12 * 60, to: 13 * 60, label: "Daily reset" },
  { resourceId: "room-a", dayOfWeek: 3, from: 15 * 60, to: 17 * 60, label: "AV maintenance" },
  { resourceId: "room-b", dayOfWeek: 5, from: 8 * 60, to: 10 * 60, label: "Facilities audit" },
  // Building-wide (`resourceId: null`), so it applies to every room and is
  // the one blocker a proposal that names no room can be refused by. It is
  // also the only one a combined view can honestly draw: a room-scoped
  // range has no column of its own there.
  { resourceId: null, dayOfWeek: 2, from: 8 * 60, to: 9 * 60, label: "Safety round" },
];


/**
 * Extended desk hours outside the official range. Same shape as BLOCKED,
 * opposite meaning: the guard accepts drops fully inside one of these,
 * and they render as an amber wash. Matching follows the blocked-range
 * union rule: a resource-aware slot meets its own room's windows, while
 * a resourceless slot meets every room's.
 */
const EXTRA = [
  { resourceId: "room-b", dayOfWeek: 4, from: 18 * 60, to: 20 * 60, label: "Late desk" },
  { resourceId: "room-c", dayOfWeek: 1, from: 7 * 60, to: 8 * 60, label: "Early desk" },
];


/** How far back and forward the fixture reaches, in days from the anchor. */
const SEED_BACK = 21;

const SEED_AHEAD = 112;


// The application store. The core holds the filtered projection.
/** @type {Array<any>} */
let store = [];

const activeRooms = new Set(ROOMS.map((room) => room.id));

/** Whether the shell declares its room groups to the core. */
let groupRooms = true;

const activeKinds = new Set(KINDS.map((kind) => kind.id));

/** Bookings created in this session, so the aura only ever plays once. */
const fresh = new Set();


/**
 * Scoped availability windows carrying location context (Team day). Unlike
 * `BLOCKED`/`EXTRA` they never refuse a slot by themselves: the green
 * bookable wash already paints "available", and these ranges only answer
 * *where* through `backgrounds.covering` (see `availabilityLocation()`).
 * Several may cover the same range; the core never picks one, so callers
 * select by `extendedProps.kind === "availability"`.
 */
const AVAILABILITY = [
  { resourceId: "room-a", from: 8 * 60, to: 12 * 60, location: "Site Nord", locationId: "site-nord", mode: "onsite" },
  { resourceId: "room-b", from: 14 * 60, to: 18 * 60, location: "Visio", locationId: "visio", mode: "remote" },
];


/**
 * Background ranges for the visible span: the bookable wash inside
 * official hours, closed hours globally, extended desk hours and the
 * non-bookable ranges per room. Paint order is data order, so the open
 * wash goes first and targeted ranges cover it. Regenerated only when
 * the span or the room selection actually changed.
 */
let backgroundKey = "";


/**
 * Backgrounds created at runtime ("Block this hour", the create form) are
 * application-owned additions layered over the derived ones. They live
 * here rather than being pushed straight into `calendar.backgrounds`, so
 * `refreshBackgrounds()` re-merges them on every rebuild instead of
 * silently dropping them at the next navigation. Month and list views
 * still clear the calendar's projection; the app-side state survives the
 * detour and comes back with the next time grid.
 * @type {Array<object>}
 */
const extraBackgrounds = [];


// --- Locale ------------------------------------------------------------
/**
 * The core resolves its locale as `configure({ locale })`, then the `lang`
 * attribute, then the document language. The shell formats plenty of its
 * own dates, so it follows the very same order - otherwise the chrome and
 * the grid disagree about what month it is. `""` means "whatever the page
 * declares", which is why the first choice is labelled after `lang`.
 */
const LOCALES = [
  { value: "", chip: "lang", label: "From the page" },
  { value: "en-US", chip: "en-US", label: "English (US)" },
  { value: "en-GB", chip: "en-GB", label: "English (UK)" },
  { value: "fr", chip: "fr", label: "Français" },
  { value: "nl", chip: "nl", label: "Nederlands" },
];


/**
 * The fixed strings the core renders itself. `Intl` and `Temporal`
 * already carry CLDR, so translating the core is this table and nothing
 * else - no bundle to fetch, which is the point of the contract. An empty
 * override falls back to the shipped English.
 */
const CORE_LABELS = {
  fr: {
    noEvents: "Aucun évènement",
    noResources: "Aucune ressource sélectionnée.",
    more: "+{hidden} en plus",
    calendarRegion: "Calendrier",
    untitledEvent: "Évènement",
    allDaySlotLabel: "Toute la journée",
  },
  nl: {
    noEvents: "Geen gebeurtenissen",
    noResources: "Geen bronnen geselecteerd.",
    more: "+{hidden} meer",
    calendarRegion: "Agenda",
    untitledEvent: "Gebeurtenis",
    allDaySlotLabel: "Hele dag",
  },
};


/**
 * The mini calendar's own fixed strings. It ships its translations, so
 * this table only picks one - the same shape as `CORE_LABELS`, minus the
 * writing. An empty override falls back to the shipped English.
 *
 * Assigned by CalendarShowcase.init() after the dynamic locale imports;
 * declared here so the binding exists from load (classic scripts share scope).
 */
let MINI_MESSAGES = {};


let chosenLocale = "";


// Built by CalendarShowcase.init() once the calendar binding exists; rebuilt
// by setLocale() on every locale switch. Starts null so an early read fails
// loudly instead of formatting in the wrong locale.
let fmt = null;


/** Wall-clock “now” in the calendar time zone, as `YYYY-MM-DD HH:mm`. */
const nowFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONE,
  dateStyle: "short",
  timeStyle: "short",
});


/**
 * Deterministic pseudo-random source: the fixture must look busy and
 * stay byte-identical between reloads and test runs.
 * @param {number} seed
 */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}


/**
 * The first day the user is actually looking at. The anchor is not always
 * rendered - a hidden Sunday is skipped, and `week` snaps to the civil week
 * - so an action scoped to "this day" follows the grid, not the anchor.
 */
function visibleDay() {
  return calendar.getVisibleRange().start;
}


/**
 * First day at or after `date` on which the desk actually opens. Sunday is
 * never rendered and Saturday is viewing-only, so a fixture landing there
 * would be invisible or frozen. The shell anchors on today, so the weekday
 * moves with the real calendar and the showcase fixtures have to follow it
 * instead of assuming the anchor is a working day.
 *
 * @param {any} date Temporal.PlainDate
 */
function openDayFrom(date) {
  let cursor = date;
  while (cursor.dayOfWeek === 7 || POLICY.closedWeekdays.includes(cursor.dayOfWeek)) {
    cursor = cursor.add({ days: 1 });
  }
  return cursor;
}


/**
 * Four and a half months of bookings around the anchor date, so navigating
 * out of the current week still lands on a populated calendar. Dates come
 * from the element's own Temporal.PlainDate: the demo needs no date library
 * of its own.
 *
 * Density falls off with distance, the way a real diary does: the fortnight
 * around today is busy, the following weeks thin out, and the far end is
 * scattered with whole days left empty. A flat rate everywhere would read
 * as generated data and would say nothing about how the grid copes with a
 * sparse month.
 */
function seedStore() {
  const random = makeRandom(20260903);
  const store = [];
  const first = calendar.date.subtract({ days: SEED_BACK });
  let n = 0;
  for (let index = 0; index < SEED_BACK + 1 + SEED_AHEAD; index += 1) {
    const date = first.add({ days: index });
    if (date.dayOfWeek === 7) continue;
    const away = Math.abs(index - SEED_BACK);
    // Saturday is staffed for viewing only, so it never fills up.
    const perRoom =
      date.dayOfWeek === 6
        ? Math.floor(random() * 2)
        : away <= 12
          ? 3 + Math.floor(random() * 3)
          : away <= 45
            ? 2 + Math.floor(random() * 3)
            : 1 + Math.floor(random() * 2);
    for (const room of ROOMS) {
      // Out there a room is often simply unused that day. Without this the
      // three rooms fill and empty together and no day ever reads quiet.
      if (away > 12 && random() < 0.35) continue;
      // Far days also start later and leave wider gaps, so "sparse" reads
      // as a quiet diary rather than a short morning.
      const spread = away <= 12 ? 4 : 12;
      let minutes = 8 * 60 + Math.floor(random() * spread) * 30;
      for (let slot = 0; slot < perRoom; slot += 1) {
        const duration = [30, 45, 60, 90][Math.floor(random() * 4)];
        if (minutes + duration > 18 * 60) break;
        const kind = KINDS[Math.floor(random() * KINDS.length)].id;
        const titles = TITLES[kind];
        n += 1;
        // Flag markers for the card icon cluster. They ride the duration as
        // well as the counter, because the cluster has two states to show:
        // a card with room prints it, a short one drops it rather than
        // clipping it. Keyed on the counter alone, a reseed can put every
        // flag on a half-hour booking and the roomy case disappears.
        const flags = {
          ...(n % 4 === 0 || (duration >= 60 && n % 3 === 0) ? { remote: true } : null),
          ...(n % 7 === 0 || (duration >= 90 && n % 5 === 0) ? { priority: true } : null),
        };
        store.push({
            id: `seed-${n}`,
          title: titles[Math.floor(random() * titles.length)],
          start: stamp(date, minutes),
          end: stamp(date, minutes + duration),
          resourceId: room.id,
          extendedProps: { kind, seats: 2 + Math.floor(random() * 10), ...flags },
        });
        minutes +=
          duration +
          (away <= 12 ? [0, 15, 30, 60, 90] : [30, 60, 90, 120, 180])[Math.floor(random() * 5)];
      }
    }
  }

  // One deliberate overlap on the first opening day of the range, to show
  // column layout on a day that is still bookable.
  const overlapDay = openDayFrom(calendar.date);
  store.push({
    id: "seed-overlap",
    title: "Overlap review",
    start: stamp(overlapDay, 9 * 60 + 30),
    end: stamp(overlapDay, 10 * 60 + 30),
    resourceId: "room-a",
    extendedProps: { kind: "deadline", seats: 6 },
  });
  // One deterministic fully-booked day about a week out: every room busy
  // from opening to closing, so the mini-month can show its red "full"
  // marker from the first load instead of waiting for a manual fill.
  const fullDay = openDayFrom(calendar.date.add({ days: 6 }));
  for (const room of ROOMS) {
    store.push({
        id: `seed-full-${room.id}`,
      title: "Fully booked",
      start: stamp(fullDay, POLICY.opensAt),
      end: stamp(fullDay, POLICY.closesAt),
      resourceId: room.id,
      extendedProps: { kind: "maintenance", seats: 0 },
    });
  }
  // One deterministic nearly-full day, so the mini-month's amber marker is
  // on screen from the first load like its green and red neighbours. Every
  // room is busy from opening to 45 minutes before closing, which is under
  // `nearFullFreeMinutes`; the random seeds for that day are dropped first,
  // because one of them landing on that last slot would turn the day red.
  const nearDay = openDayFrom(calendar.date.add({ days: 9 }));
  const nearIso = nearDay.toString();
  for (let index = store.length - 1; index >= 0; index -= 1) {
    if (String(store[index].start).startsWith(nearIso)) store.splice(index, 1);
  }
  for (const room of ROOMS) {
    store.push({
        id: `seed-near-${room.id}`,
      title: "Sprint week",
      start: stamp(nearDay, POLICY.opensAt),
      end: stamp(nearDay, POLICY.closesAt - 45),
      resourceId: room.id,
      extendedProps: { kind: "workshop", seats: 8 },
    });
  }
  // Stable target for search and realtime stand-ins, on the next opening
  // day so it is always visible and always still bookable.
  const liveDay = openDayFrom(calendar.date.add({ days: 1 }));
  store.push({
    id: "live",
    title: "Live sync",
    start: stamp(liveDay, 11 * 60),
    end: stamp(liveDay, 11 * 60 + 30),
    resourceId: "room-b",
    extendedProps: { kind: "planning", seats: 3 },
  });
  // One all-day closure inside the visible window, so the time-grid lane is
  // populated from the first load like every other feature of the shell.
  // Civil boundaries ride Temporal.PlainDate, end exclusive.
  store.push({
    id: "seed-all-day",
    title: "Atrium closure",
    start: daysToString(calendar.date, 0),
    end: daysToString(calendar.date, 3),
    resourceId: "room-a",
    allDay: true,
    extendedProps: { kind: "planning", seats: 0 },
  });
  // Team-day pair on a day clear of the other deterministic seeds: one
  // all-day absence (room A) and one remote busy hour (room B). Both are
  // read-only yet clickable, and both opt in to `blocksAvailability`, so
  // the policy refuses new bookings over them while ordinary overlaps
  // elsewhere stay allowed. Civil boundaries, end exclusive, like above.
  const takenDays = new Set([
    overlapDay.toString(),
    liveDay.toString(),
    fullDay.toString(),
    nearDay.toString(),
  ]);
  let teamDay = openDayFrom(calendar.date.add({ days: 4 }));
  while (takenDays.has(teamDay.toString())) {
    teamDay = openDayFrom(teamDay.add({ days: 1 }));
  }
  const teamIso = teamDay.toString();
  store.push({
    id: "team-absence",
    title: "Absence — Room A",
    start: teamIso,
    end: teamDay.add({ days: 1 }).toString(),
    resourceId: "room-a",
    allDay: true,
    editable: false,
    movable: false,
    resizable: false,
    extendedProps: {
      kind: "absence",
      seats: 0,
      blocksAvailability: true,
      blockReason: "Absent that day",
    },
  });
  store.push({
    id: "team-remote-busy",
    title: "External agenda · Busy",
    start: stamp(teamDay, 15 * 60),
    end: stamp(teamDay, 16 * 60),
    resourceId: "room-b",
    editable: false,
    movable: false,
    resizable: false,
    extendedProps: {
      kind: "planning",
      seats: 0,
      remote: true,
      blocksAvailability: true,
      blockReason: "Busy in external calendar",
    },
  });
  return store;
}


/** Civil date `N` days out, as a `YYYY-MM-DD` string for all-day seeds. */
function daysToString(date, days) {
  return /** @type {any} */ (date).add({ days }).toString();
}


/**
 * @param {{ toString(): string }} date PlainDate
 * @param {number} minutes wall-clock minutes from midnight
 */
function stamp(date, minutes) {
  // Midnight is expressed as 24:00 by closing-hour policies, which is not
  // an ISO hour: roll the date instead of emitting one Temporal refuses.
  const days = Math.floor(minutes / (24 * 60));
  const rest = minutes - days * 24 * 60;
  // The offset is derived, never written by hand: this zone runs +02:00 in
  // summer and +01:00 in winter, and the shell opens on today, so a literal
  // offset would be rejected for half the year.
  return toPlainDate(String(date))
    .add({ days })
      .toZonedDateTime({ timeZone: ZONE, plainTime: `${clock(rest)}:00` })
    .toString();
}


/** @param {number} minutes wall-clock minutes from midnight */
function clock(minutes) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
    return `${hour}:${minute}`;
}


/** @param {string} iso */
function wallClock(iso) {
  return iso.slice(11, 16);
}


/** @param {string} iso */
function wallMinutesOf(iso) {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}


/**
 * @param {string} startIso
 * @param {string} endIso
 */
function wallMinutes(startIso, endIso) {
  return wallMinutesOf(endIso) - wallMinutesOf(startIso);
}


/**
 * An abort-aware delay. Both async seams in this shell - the calendar's
 * event source and the search palette's `load` - are handed an
 * `AbortSignal`, and both have to reject rather than resolve late.
 *
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}


/** @param {string} iso an ISO date, `YYYY-MM-DD` or longer */
function asDate(iso) {
    return new Date(`${iso.slice(0, 10)}T12:00:00`);
}


/** ISO weekday, 1 = Monday, for a `YYYY-MM-DD` string. @param {string} iso */
function isoWeekday(iso) {
  return ((asDate(iso).getDay() + 6) % 7) + 1;
}


/** @param {any} item */
function isLocked(item) {
  return (
    POLICY.lockedKinds.includes(item.extendedProps?.kind ?? "review") ||
    item.extendedProps?.blocksAvailability === true
  );
}


/**
 * Why a booking cannot be replanned, or `null` when it can. This is the
 * *subject* half of the application's rules - "may this be picked up at
 * all" - and it is what `visibleStore()` turns into `editable: false`,
 * the flag that stops the core arming a drag or a keyboard move.
 *
 * The interaction policy answers the other half - "is this *destination*
 * legal" - and neither substitutes for the other: an event sitting inside
 * a non-bookable range is refused as a target and is at the same time
 * exactly the one the workbench has to pick up.
 *
 * Past wins over locked: a maintenance booking that is over is over, and
 * that is the shorter thing to say about it.
 *
 * The verdict carries its own label and marker, so the three surfaces
 * that show it - menu heading, hover tooltip, detail sheet - name the
 * rule identically without three copies of the wording.
 *
 * @param {any} item
 * @returns {{ code: "archived" | "locked", label: string, icon: string } | null}
 */
function frozenReason(item) {
  if (beforeToday(String(item.end))) {
    return { code: "archived", label: "Already over", icon: "history" };
  }
  if (isLocked(item)) {
    const reason = item.extendedProps?.blockReason;
    if (typeof reason === "string" && reason !== "") {
      return { code: "locked", label: reason, icon: "lock" };
    }
    return { code: "locked", label: "Locked by facilities", icon: "lock" };
  }
  return null;
}


/**
 * The same rule at day granularity, for the surfaces that act on a whole
 * civil day instead of one booking: the day-header and empty-slot menus,
 * and the two `parkDay*` commands that stay the authority for it.
 *
 * @param {string} iso
 * @returns {string | null}
 */
function frozenDayReason(iso) {
  return beforeToday(iso) ? "That day is already over — its bookings stay put." : null;
}


function visibleStore() {
  return store
    .filter((item) => activeKinds.has(item.extendedProps?.kind ?? "review"))
    .map((item) => {
      // Two read-only doors share one shape, and `frozenReason()` is the
      // single place that decides which one applies. The core then never
      // arms a pointer drag/resize for them, `moveEvent()`/`resizeEvent()`
      // stay quiet on the keyboard path, and every application surface
      // that offers a replanning verb asks the same question.
      if (frozenReason(item) !== null) {
        return { ...item, editable: false, movable: false, resizable: false };
      }
      return item;
    });
}


/**
 * Counts shown in the chrome describe what the user is looking at, so
 * they are always scoped to the range the core reports.
 * @param {Array<any>} items
 */
function inCurrentRange(items) {
  const { start, end } = calendar.getVisibleRange();
  const from = start.toString();
  const to = end.toString();
  return items.filter((item) => {
    const day = String(item.start).slice(0, 10);
    return day >= from && day < to;
  });
}


// --- Booking rules ------------------------------------------------------
/**
 * @param {string | null} resourceId
 * @param {string} iso day, `YYYY-MM-DD`
 */
function blockedRangesOn(resourceId, iso) {
  const weekday = isoWeekday(iso);
  return BLOCKED.filter(
    (range) =>
      (range.dayOfWeek === null || range.dayOfWeek === weekday) &&
      // A `null` query means "every room's entries", for painting. A named
      // room means its own entries *plus* the building-wide ones, which is
      // the rule `miniDayState` already applies and the one the core uses
      // to decide which columns a resource-less background covers.
      (resourceId === null || range.resourceId === null || range.resourceId === resourceId),
  );
}


/**
 * Extended desk windows covering a day. Same union semantics as
 * `blockedRangesOn`: with a `null` resource the entries of every room
 * come back, so combined views and solo drops read the same rule.
 *
 * @param {string | null} resourceId
 * @param {string} iso day, `YYYY-MM-DD`
 */
function extraRangesOn(resourceId, iso) {
  const weekday = isoWeekday(iso);
  return EXTRA.filter(
    (range) =>
      (range.dayOfWeek === null || range.dayOfWeek === weekday) &&
      (resourceId === null || range.resourceId === null || range.resourceId === resourceId),
  );
}


/**
 * Backgrounds of one kind out of a `getRangeContext()` snapshot. The two
 * buckets the core reports are exactly the two the rules need:
 * `overlapping` is a plain intersection - the shape of a blocker - and
 * `covering` fully wraps the proposed range, which is the shape of an
 * exemption.
 *
 * @param {any} context a `getRangeContext()` snapshot, or null
 * @param {"overlapping" | "covering"} bucket
 * @param {string} className the wash this shell painted the rule with
 */
function contextBackgrounds(context, bucket, className) {
  const list = context?.backgrounds?.[bucket];
  if (!Array.isArray(list)) return [];
  return list.filter((range) => range.classNames?.includes(className));
}


/**
 * The availability range covering a proposed slot, if any. Several
 * backgrounds may cover the same range and the core never picks one, so
 * the application selects by the `availability` kind it painted itself;
 * when several match, the first one wins (a priority rule would live
 * here, not in the core). Carries `location`/`locationId`/`mode` as pure
 * creation context — never a booking constraint.
 *
 * @param {any} context a `getRangeContext()` snapshot, or null
 * @returns {any | null} the covering availability background, or null
 */
function availabilityLocation(context) {
  const list = context?.backgrounds?.covering;
  if (!Array.isArray(list)) return null;
  return list.find((range) => range.extendedProps?.kind === "availability") ?? null;
}


/**
 * The single source of truth for every refusal: pointer drags, keyboard
 * moves, commands and range selection all ask this.
 *
 * Two families of rule live here, and they are answered differently.
 * Opening hours, the maximum duration and the closed weekday are pure
 * policy - nothing is drawn for them beyond a wash, and they hold for
 * days the grid never rendered. The non-bookable ranges and the extended
 * desk windows *are* drawn, so when the proposal names a room and the
 * caller carries a range context, the answer comes from the core's own
 * report of what the range touches rather than from a second walk over
 * the constants: the rule enforced is then literally the rectangle under
 * the pointer.
 *
 * Which room the question is about decides everything. A proposal that
 * names one asks about that room. A proposal without one - a combined
 * view, a paste with no column - asks whether *any* room can take the
 * slot, which is the question `miniDayState()` already answers when it
 * marks a day: only "every active room is blocked" closes it. A range
 * context built without a `resourceId` is a union across rooms and
 * cannot answer that, so the room-scoped constants do.
 *
 * @param {{ start: string, end: string, resourceId: string | null, allDay?: boolean }} slot
 * @param {any} [context] `detail.context` / the policy's context, when the caller has one
 * @param {string | null} [excludeEventId] id to ignore inside
 * `context.events.overlapping` (the moved event itself: move/resize
 * snapshots are post-commit, so the event may overlap itself)
 * @returns {string | null} the reason, or null when the slot is bookable
 */
function violation({ start, end, resourceId, allDay = false }, context = null, excludeEventId = null) {
  const day = start.slice(0, 10);
  if (beforeToday(start)) {
    return "That slot is already in the past.";
  }
  if (POLICY.closedWeekdays.includes(isoWeekday(day))) {
    return "Saturdays are staffed for viewing only.";
  }
  // All-day placements are day-granular: the wall-clock rules below read
  // minutes that a civil date does not carry (`wallMinutesOf` would see
  // midnight on both ends), so only the day-level rules apply to them.
  // A lane closure moved to another open day is a legitimate reschedule.
  if (allDay) {
    return null;
  }
  const from = wallMinutesOf(start);
  const to = wallMinutesOf(end);
  // Extended desk hours widen the official range: a slot fully inside one
  // of them is bookable even past closing time. "Fully inside" is what
  // `backgrounds.covering` means, so the core answers it directly.
  const extra =
    contextBackgrounds(context, "covering", "sc-extra").length > 0 ||
    extraRangesOn(resourceId, day).some((range) => from >= range.from && to <= range.to);
  if (!extra && (from < POLICY.opensAt || to > POLICY.closesAt || to <= from)) {
      return `Bookings stay inside ${clock(POLICY.opensAt)}–${clock(POLICY.closesAt)}.`;
  }
  if (to - from > POLICY.maxMinutes) {
      return `A single booking cannot exceed ${POLICY.maxMinutes / 60} hours.`;
  }
  // A blocker is any intersection, which is `backgrounds.overlapping` -
  // authoritative as soon as the proposal is scoped to one room, because
  // the context is then scoped to that room too.
  const painted = resourceId
    ? contextBackgrounds(context, "overlapping", "sc-blocked")[0]
    : undefined;
  if (painted) {
    return blockedReason(
      String(painted.extendedProps?.label ?? painted.title),
      wallClock(String(painted.start)),
      wallClock(String(painted.end)),
      painted.resourceId == null ? null : String(painted.resourceId),
    );
  }
  // Without a room the slot is refused only when nowhere is left to put
  // it. `activeRooms` is the scope the user is actually looking at, and no
  // room selected is no verdict - the same rule the mini-month follows.
  const scope = resourceId ? [String(resourceId)] : [...activeRooms];
  const blocking = scope.map((room) =>
    blockedRangesOn(room, day).find((range) => from < range.to && to > range.from),
  );
  if (scope.length > 0 && blocking.every(Boolean)) {
    const hit = /** @type {{ label: string, from: number, to: number, resourceId: string | null }} */ (
      blocking[0]
    );
    // One room named, or one building-wide range answering for all of
    // them: the reason can name it. Several different ranges happening to
    // cover every room cannot be summed up by any one of their labels.
    return hit.resourceId === null || scope.length === 1
      ? blockedReason(hit.label, clock(hit.from), clock(hit.to), hit.resourceId)
      : "Every room is blocked at that time.";
  }
  // Event-level blockers: an application-owned flag, opaque to the core.
  // Only events that opt in with `blocksAvailability: true` refuse a slot,
  // so ordinary overlapping bookings stay allowed. The moved/resized event
  // itself is excluded: its snapshot is post-commit and may overlap itself.
  const blocker = context?.events?.overlapping?.find(
    (event) =>
      String(event.id) !== String(excludeEventId ?? "") &&
      event.extendedProps?.blocksAvailability === true,
  );
  if (blocker) {
    return blocker.extendedProps?.blockReason ?? "Unavailable at that time.";
  }
  return null;
}


/**
 * Whether an interaction target names the slot an event already holds.
 * Compared by civil date and wall minutes rather than by string form:
 * `checkInteraction` callers may hand the policy a differently-formatted
 * equivalent (no offset, no seconds) for the very same slot.
 *
 * @param {{ date: unknown, start: unknown, end: unknown, resourceId: string | null }} target
 * @param {any} event normalized calendar event
 * @param {boolean} allDay
 * @returns {boolean}
 */
function sameSlot(target, event, allDay) {
  if (String(target.date) !== String(event.start).slice(0, 10)) return false;
  if ((target.resourceId ?? null) !== (event.resourceId ?? null)) return false;
  if (allDay) return String(target.end) === String(event.end);
  return (
    wallMinutesOf(String(target.start)) === wallMinutesOf(String(event.start)) &&
    wallMinutesOf(String(target.end)) === wallMinutesOf(String(event.end))
  );
}


/**
 * Occupancy verdict shared by every placement path — pointer move,
 * resize, selection, external drop, paste and workbench placement.
 * Bookings only compete inside their own granularity and room: a timed
 * booking for its hours, an all-day bar for its civil days, and two
 * rooms never share a "slot". A proposal with no room collides only
 * with roomless bookings. A flagged blocker inside the conflicts keeps
 * its own reason; `excludeEventId` removes the moved event itself from
 * the judgement.
 *
 * @param {any} context a `getRangeContext()` snapshot, or null
 * @param {{ allDay?: boolean, room?: string | null, excludeEventId?: string | null }} [options]
 * @returns {string | null} refusal reason, or null when the slot is free
 */
function occupancyReason(context, { allDay = false, room = null, excludeEventId = null } = {}) {
  const conflicts = (context?.events?.overlapping ?? []).filter(
    (entry) =>
      String(entry.id) !== String(excludeEventId ?? "") &&
      (entry.allDay === true) === allDay &&
      (entry.resourceId ?? null) === room,
  );
  const flagged = conflicts.find((entry) => entry.extendedProps?.blocksAvailability === true);
  if (flagged) {
    return flagged.extendedProps?.blockReason ?? "Unavailable at that time.";
  }
  return conflicts.length > 0
      ? `“${conflicts[0].title ?? "Booking"}” already occupies that slot.`
    : null;
}


/**
 * @param {string} label
 * @param {string} from wall clock, `HH:MM`
 * @param {string} to wall clock, `HH:MM`
 * @param {string | null} resourceId null for a building-wide range
 */
function blockedReason(label, from, to, resourceId) {
    const where = resourceId === null ? "in every room" : `in ${roomTitle(resourceId)}`;
    return `${label} blocks ${from}–${to} ${where}.`;
}


/**
 * Registers a runtime background and makes sure the next repaint includes
 * it even when the derived key has not changed.
 * @param {object} range
 */
function addExtraBackground(range) {
  extraBackgrounds.push(range);
  backgroundKey = "";
  refreshChrome();
}


function refreshBackgrounds() {
  const view = calendar.view;
  if (view === "month" || view === "list") {
    if (backgroundKey !== "none") {
      backgroundKey = "none";
      calendar.backgrounds = [];
    }
    return;
  }
  const resourceView = view.startsWith("resource");
  const { start, end } = calendar.getVisibleRange();
    const key = `${start}|${end}|${resourceView}|${[...activeRooms].join(",")}`;
  if (key === backgroundKey) return;
  backgroundKey = key;

  const ranges = [];
  const days = start.until(end, { largestUnit: "day" }).days;
  for (let index = 0; index < days; index += 1) {
    const date = start.add({ days: index });
    const iso = date.toString();
    const closed = POLICY.closedWeekdays.includes(date.dayOfWeek);
    // A background without `resourceId` is global: one pair of closed
    // ranges covers every room column of that day.
    ranges.push({
        id: `closed-am-${iso}`,
      title: "Closed",
      start: stamp(date, 0),
      end: stamp(date, closed ? 24 * 60 : POLICY.opensAt),
      classNames: ["sc-closed"],
    });
    if (!closed) {
      if (date.dayOfWeek === 3) {
        // Wednesdays show a banded window: green bookable morning, an
        // unpainted lunch gap, then an amber afternoon - the same
        // vocabulary as the other days, split so the band edges read.
        // This is paint only: `violation()` still answers from POLICY,
        // and the gap stays bookable.
        ranges.push({
            id: `open-${iso}`,
          title: "Bookable hours",
          start: stamp(date, POLICY.opensAt),
          end: stamp(date, 13 * 60),
          classNames: ["sc-open"],
        });
        ranges.push({
            id: `open-pm-${iso}`,
          title: "Afternoon window",
          start: stamp(date, 14 * 60),
          end: stamp(date, POLICY.closesAt),
          classNames: ["sc-extra"],
        });
      } else {
        ranges.push({
            id: `open-${iso}`,
          title: "Bookable hours",
          start: stamp(date, POLICY.opensAt),
          end: stamp(date, POLICY.closesAt),
          classNames: ["sc-open"],
        });
      }
      ranges.push({
          id: `closed-pm-${iso}`,
        title: "Closed",
        start: stamp(date, POLICY.closesAt),
        end: stamp(date, 24 * 60),
        classNames: ["sc-closed"],
      });
      // A room-scoped range has no column of its own in a combined view,
      // where it would read as blocking every room at once - so it is only
      // drawn in resource views, and only there does it refuse a drop. A
      // building-wide range has no such problem: it is drawn in every view
      // and refuses everywhere, which is exactly the difference the rule in
      // `violation()` makes.
      for (const range of blockedRangesOn(null, iso)) {
        const global = range.resourceId === null;
        if (!global && (!resourceView || !activeRooms.has(range.resourceId))) continue;
        ranges.push({
            id: `blocked-${range.resourceId ?? "all"}-${iso}-${range.from}`,
          title: range.label,
          ...(global ? null : { resourceId: range.resourceId }),
          start: stamp(date, range.from),
          end: stamp(date, range.to),
          classNames: ["sc-blocked"],
          extendedProps: { label: range.label },
        });
      }
      // Extended desk hours paint over the closed wash where they overlap
      // it, and the guard accepts drops fully inside one of them.
      for (const range of resourceView ? extraRangesOn(null, iso) : []) {
        if (range.resourceId !== null && !activeRooms.has(range.resourceId)) continue;
        ranges.push({
            id: `extra-${range.resourceId ?? "all"}-${iso}-${range.from}`,
          title: range.label,
          ...(range.resourceId === null ? null : { resourceId: range.resourceId }),
          start: stamp(date, range.from),
          end: stamp(date, range.to),
          classNames: ["sc-extra"],
          extendedProps: { label: range.label },
        });
      }
      // Scoped availability context: same "no column of its own" rule as
      // the blockers above, so these only exist in resource views. They
      // carry no paint of their own (`sc-avail` is transparent); the green
      // wash says "available", they say "where".
      if (resourceView) {
        for (const range of AVAILABILITY) {
          if (!activeRooms.has(range.resourceId)) continue;
          ranges.push({
              id: `avail-${range.resourceId}-${iso}-${range.from}`,
              title: `Available · ${range.location}`,
            resourceId: range.resourceId,
            start: stamp(date, range.from),
            end: stamp(date, range.to),
            classNames: ["sc-avail"],
            extendedProps: {
              kind: "availability",
              location: range.location,
              locationId: range.locationId,
              mode: range.mode,
            },
          });
        }
      }
    }
  }
  calendar.backgrounds = [...ranges, ...extraBackgrounds];
}


/** @returns {string | undefined} */
function effectiveLocale() {
  return (
    chosenLocale ||
    calendar.getAttribute("lang") ||
    document.documentElement.lang ||
    undefined
  );
}


/**
 * The shell's own formatters, rebuilt whenever the locale changes. The
 * application chrome is not translated - that is transport, and stays an
 * application concern - but every date it prints follows the calendar.
 * @param {string | undefined} locale
 */
function buildFormatters(locale) {
  return {
    day: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    range: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }),
    short: new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric" }),
    long: new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}


// --- Rendering hooks: geometry stays in the core, content is the app ---

/** @param {string} id */
function roomTitle(id) {
  return ROOMS.find((room) => room.id === id)?.title ?? id;
}


/** @param {string} name tabler icon suffix */
function icon(name) {
  const node = document.createElement("i");
    node.className = `ti ti-${name}`;
  node.setAttribute("aria-hidden", "true");
  return node;
}


function nowStamp() {
  return nowFormat.format(new Date());
}


function todayIso() {
  return nowStamp().slice(0, 10);
}


/**
 * Drag freeze boundary. Events that ended before today are archived and
 * stay put: the limit sits at the end of yesterday, so the whole current
 * day remains draggable - the demo grid keeps today alive at any hour
 * instead of freezing the moment real time passes a booking.
 *
 * Both timed and all-day bounds compare as civil dates (`YYYY-MM-DD`), the
 * same shape `todayIso()` produces, so the comparison is chronological.
 * @param {string} iso an event start or end, `YYYY-MM-DD` or a zoned ISO string
 */
function beforeToday(iso) {
  return String(iso).slice(0, 10) < todayIso();
}
Object.assign(globalThis.ShowcaseFoundation ??= {}, { makeRandom, visibleDay, openDayFrom, seedStore, daysToString, stamp, clock, wallClock, wallMinutesOf, wallMinutes, sleep, asDate, isoWeekday, isLocked, frozenReason, frozenDayReason, visibleStore, inCurrentRange, blockedRangesOn, extraRangesOn, contextBackgrounds, availabilityLocation, violation, sameSlot, occupancyReason, blockedReason, addExtraBackground, refreshBackgrounds, effectiveLocale, buildFormatters, roomTitle, icon, nowStamp, todayIso, beforeToday });
