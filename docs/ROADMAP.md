# Roadmap

The sequence is designed to prove the difficult core before adding breadth.

## Milestone 0 — skeleton (this zip)

- project/docs/testing scaffold;
- Temporal dependency and date helpers;
- Light-DOM custom element + explicit registration;
- basic `timeGrid`/`resourceTimeGrid` column rendering;
- minimal event/background geometry;
- incremental event mutation API;
- source API/race guard placeholder;
- core unit tests + browser smoke tests.

Exit condition: repository is a coherent starting point, not a production calendar.

## Milestone 1 — canonical model + solo TimeGrid

- finalize Event/Background/Resource normalization;
- Temporal parsing/serialization contract;
- visible range/navigation (`prev/next/today`);
- slot grid and current-time indicator;
- keyed event rendering;
- stable scroll preservation;
- custom event renderer;
- event click/keyboard activation;
- async source lifecycle.

Tests: date/DST, source races, rendering, click/keyboard.

## Milestone 2 — overlap layout + hover/select

- real overlap algorithm;
- hit-testing primitive;
- empty-slot hover preview;
- click selection;
- drag range selection + ghost;
- snap rules;
- cancellable selection events.

Tests: overlap matrix + pointer coordinates + selection residual-click suppression.

## Milestone 3 — event drag/resize

- Pointer Events state machine;
- event drag within/across day;
- resize end + resize start;
- mirror/ghost;
- autoscroll;
- read-only/`selectable`/`droppable`/`movable`/`resizable` states;
- application commit/revert contract.

Tests: normal/rejected/cancelled/lost-pointer paths.

## Milestone 4 — resourceTimeGrid

- resource/date column derivation;
- `resource → dates` headers only in v0.x;
- resource-aware event/background slicing;
- resource hit testing;
- drag resource A → B;
- `selectable`/`droppable` and `movable`/`resizable` enforcement;
- 1-day team-style view and 3-day comparison view.

Acceptance fixtures: 1×7, 2×3, 6×1, 6×3, 12×1. Manual stress: 12×3, 6×7. Columns keep a minimum width with horizontal scroll; never hide resources automatically.

## Milestone 5 — mobile + accessibility hardening

- touch thresholds/long press if retained;
- responsive density guidance;
- keyboard navigation model;
- non-pointer move/resize commands;
- reduced motion / forced colors;
- cross-browser Chromium/Firefox/WebKit.

## Milestone 6 — month + list

- month renderer;
- list renderer;
- render hooks;
- view switching/cache reuse;
- summary use cases without forcing giant resource grids.

## Milestone 7 — package/release engineering

Adopt the combobox-style release model:

- dist ESM/classic build as appropriate;
- CSS output;
- `.d.ts` generation;
- `custom-elements.json`;
- `sync` command;
- generated drift gate;
- package tarball contract;
- demo against distributable output;
- CI browser matrix.

## Milestone 8 - contract gaps (0.x)

Additive gaps found by auditing our public surface against a comparable
MIT scheduler (EventCalendar), used strictly as a UX/specification
reference. None of these change the architecture; each closes a seam an
application currently cannot reach.

Observability:

- `calendar:loading` brackets every async source run with `detail.loading`, symmetric with `calendar:loaderror`. Only the newest request settles the state, so an aborted or superseded run never reports itself as finished;
- `calendar:render` fires once the rendered subtree exists, with `{ view, dates, resources }`, so applications decorate rendered columns without observing mutations or depending on `:has()`.

Consistency:

- `classNames` is applied by all three renderers, not by `timeGrid` alone;
- `+n more` is a real button carrying `calendar:moreclick` (`{ date, events, hidden, nativeEvent }`) plus a `moreLinkContent` hook, and no longer falls through to the day cell's `select`, which meant "create" and was the wrong intent.

Density and format policies:

- `slotLabelInterval` sets axis label density, `slotLabelContent` sets what a label reads. The interval is a policy, the text is a hook;
- `hiddenDays` drops non-worked weekdays from every date-driven view.

Week anchoring, decided: `week` is anchored on the civil week containing
the anchor date, and `firstDay` (ISO 1-7, default Monday, `0` accepted as
an alias for Sunday) sets where that week starts, for month derivation as
well. The anchor property is never rewritten, so an application keeps
knowing which day the user actually picked. Every other view stays
rolling: it starts at the anchor and takes its day count from there. The
consequence for `hiddenDays` is deliberate and documented in
[VIEWS.md](VIEWS.md#date-derivation): a week is a civil unit and loses
columns, a rolling range is a count and spans further instead.

New options travel through `configure()` rather than through attributes:
content hooks cannot be attributes at all, and keeping the options that
drive date derivation in one place avoids an attribute-versus-property
precedence rule.

Tests: `test/core/derivation.test.js` (week anchoring, `firstDay`
aliasing, hidden-day derivation for both families, navigation that
neither overlaps nor skips, degenerate inputs) and
`test/browser/options.spec.js` (source lifecycle including a superseded
request, render signal, class application in month and list, `+n more`
activation by pointer and keyboard without a stray `select`, axis label
density, and the derivation seen through the DOM).

Exit condition, met: an application can render a busy state, style events
uniformly across views, react to a finished render, and choose which
weekdays exist, without reaching into internals.

## Milestone 9a — read surface + day bounds (0.x, in progress)

Gaps found by reading a real FullCalendar business consumer (agenda +
scheduler with external drag, cut/paste, per-resource schedules, background
labels, websocket updates) and mapping every behavior onto a core seam. The
consumer exercised each planned contract and still fell back to DOM scraping
(`data-num`/`data-time` attributes, `findCoveredElements`, per-row slat
stretching, bounding-box hit scans), which a Light-DOM webcomponent should
make unnecessary.

Public read surface — an application must answer "does my new range conflict
with an existing event?" before proposing creation, and "which events sit in
this column?" for click-to-end snapping and reveal. One primitive over the
same canonical state, never over render internals:

```js
calendar.getEventOverlaps(range, { resourceIds = [], includeBackgrounds = false, filter })
 // -> events (and backgrounds) overlapping `range`, in paint order, or []
```

`range` is `{ start, end }` (each a `Temporal.ZonedDateTime` or ISO string);
comparison is by absolute instant. `resourceIds = []` means no resource
filter; a non-empty list keeps only entries belonging to those resources,
with resource-less backgrounds treated as global (they match any list).
`filter(entry)` — `entry = { kind: "event" | "background", event?, background? }` —
lets an application ask "is there an unavailability here" without reading
class arrays itself.

Neighbor snapping — pointer drag, resize and range selection snap to the
grid (`snapDuration`), but a moving edge within
`min(snapStep / 2, 5 minutes)` of a neighboring event/background boundary in
the same column magnetizes to that boundary instead, so a 10-minute event
follows its predecessor without a gap on 20-minute slots. Keyboard moves
stay on exact `snapDuration` steps and never magnetize.

Day boundaries — `configure({ slotMin, slotMax })` (`Temporal.PlainTime`,
with `24:00` accepted as end-of-day) bounds the grid the way the consumer's
`minTime`/`maxTime` schedules did. Day slicing/clipping already exists; this
makes the boundary a configuration seam instead of app-side CSS/DOM surgery.

Backgrounds with content and stacking — a background may carry a `title`
rendered as text, participates in a `backgroundContent` hook, and overlapping
backgrounds paint in source order (later on top), so the consumer's
"clear the DOM of covered background labels" hack disappears.

Start-only events — `{ start }` without `end` creates with
`duration`/`defaultTimedEventDuration`; the external-drop and paste input
shapes the consumer computed by hand.

Exit condition: conflict-aware creation, click-to-end snapping and labelled
backgrounds rebuild on exported seams without relying on internal DOM
shape, coordinated `getBoundingClientRect` scans, or private members.

## Milestone 9b — external drag & drop and dropzones (0.x, planned)

Two sides of one seam, on top of M9a:

- application-owned draggables (external listings) that create an event on
  drop, carrying `{ title, start?, duration, resourceId, extendedProps }`,
  and honored by the same `movable`/`droppable` checks as internal drags;
- application-owned drop targets that receive events dragged out of the grid
  (parked/cut events), covering the consumer's cut/paste workflow. A Pointer
  drag that ends outside every day column currently resolves to no hit and
  is dropped silently; M9b adds an explicit exit intent so the application
  can distinguish "abandoned" from "parked".

Tentative intent names (to be frozen on implementation):
`calendar:externaldrop` for entry, `calendar:eventdropout` for exit; the
application owns the target UX and persistence in both directions.

The recommended inter-week move workflow is NOT a cross-week drag
(impossible in a windowed grid: the target is not rendered and navigation
breaks pointer capture). It is an application-owned cut/copy/paste clipboard
driven from the context menu — see [USE_CASES.md](USE_CASES.md#11-moving-an-event-outside-the-visible-window-cutcopypaste) and
[INTEGRATION.md](INTEGRATION.md#clipboard-cutcopypaste) — with sidebar
parking as an optional second surface on the same `moveEvent` seam.

Exit condition: external listings and park targets integrate without DOM
shape coupling.

## Milestone 9c — density (0.x, planned)

Promoted from post-0.x once M9a/M9b land:

- all-day lane — `configure({ allDaySlot })`;
- slot row policy as a real option (`pxPerMinute` or `fit` to the available
  height) instead of stretching rendered rows from outside. `fit` still needs
  a definition: available height divided by the slot amplitude, recomputed on
  resize, without breaking scroll preservation;
- resource headers: `datesAboveResources` arrangement.

Exit condition: the documented consumer density workflows rebuild on
exported seams.

## Demo coverage debt, cleared

Demos are part of the definition of done, and `demo/showcase.html` now
covers every contract it was missing:

- move/resize rejection: the shell carries a booking policy - opening
  hours, a maximum duration, a view-only weekday, per-room non-bookable
  ranges, facilities-owned kinds - and one `violation()` answers for
  pointer drags, keyboard moves, commands and range selection alike. A
  refusal calls `preventDefault()` synchronously, so the core reverts;
  deadlines take the asynchronous path instead and are rolled back with
  `detail.revert()` after a simulated round-trip. Maintenance is handed
  over as `editable: false`, so the core refuses the drag itself. The
  policies are drawn as background ranges from the same constants the
  guard reads, so a rule is visible before it is enforced;
- hover intent: an application tooltip keyed on `data-event-id`, with no
  core hook, giving back the detail the short cards drop;
- the context menu no longer clamps itself with hardcoded
  `innerWidth - 200` / `innerHeight - 140` guesses and no longer
  hand-rolls outside-click and Escape;
- week numbers in the mini month, from `Temporal.PlainDate.weekOfYear`;
- proper icons (Tabler webfont, pinned CDN) instead of text glyphs, which
  is what fixed the alignment;
- a tools mega menu holding the event source, the realtime stand-ins, the
  grid options and the diagnostics, so the debug and test controls are
  out of the chrome;
- an aura on a freshly created booking, reusing the `--aura-angle`
  property and `aura-rotate` keyframes Actual already registers;
- the seven view buttons are one trigger naming the current view, with a
  grouped popover menu and `1`-`7` shortcuts;
- the avatar opens a working account menu, with the theme switcher in it;
- mobile gets the room it was owed: the chrome is a slim topbar, one
  toolbar row and one scrollable status line, and the grid keeps over
  70% of the viewport at every width.

The overlay mechanism is the one settled in
[INTEGRATION.md](INTEGRATION.md#overlays): native `popover` for the top
layer and dismissal, `@lekoala/floating` for placement (`repositionAt()`
for the coordinate-driven menu, `reposition()` + `autoUpdate()` for the
tooltip, since the calendar scroller moves independently of the page).
`floating` is pinned in the demo the way Actual CSS already is - an
application dependency, never a runtime dependency of the core. The
showcase script is a module; the classic-script demos stay free of it and
keep working over `file://`.

One platform detail worth recording: `popover="auto"` light dismiss
closes on the pointer *release*, measured against the element the press
started on, and engines disagree on whether `contextmenu` is dispatched
before or after that release. A menu opened during the press is therefore
closed again by it in Firefox and WebKit. The showcase opens the context
menu after the release, which cooperates with the platform's dismissal
rather than replacing it.

Below 64rem the side panel is the same element with a `popover`
attribute, which supplies the backdrop, the outside click and Escape; the
scrim element and the keydown bookkeeping are gone.

Follow-ups this uncovered, both in the core rather than the demo:

- the time axis width is hardcoded three times (`.cv-axis`,
  `.cv-resource-corner`, `.cv-grid`'s first track). A `3.5rem` gutter is
  a tenth of a phone's width, and the showcase narrows it by overriding
  all three. It should be one `--calendar-axis-size` custom property;
- the sticky offset for day headers under a resource row is a hardcoded
  `3rem`, so an application that makes its resource headers compact has
  to restate the value. The showcase keeps both in one
  `--sc-resource-row`; the core should expose the same seam.

## Post-0.x candidates (only with use cases)

- generic mini-calendar/date navigator package;
- resource grouping metadata (hierarchy/tree data), beyond the header `datesAboveResources` arrangement now tracked in Milestone 9;
- optional recurrence adapter;
- framework adapters;
- print/export helpers.

Still not automatically planned: virtualization, Gantt, enterprise resource timeline/tree-grid.

Audited and deliberately not ours: header toolbars, button text, custom
buttons, icon sets and theme class hooks (application chrome); day-grid
week/day views and resource timeline views; event/resource cross-filter
options, which applications express by choosing what they hand the core;
height and slot/column sizing options, since the surrounding frame owns
the box. Formatting options (event time, day header, title, locale,
colours) stay covered by the content hooks rather than becoming an
option surface.
