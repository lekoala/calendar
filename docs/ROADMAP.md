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

- `calendar:loading`, symmetric with the existing `calendar:loaderror`, so an application can show a busy state while an async source is in flight;
- a render-completed signal, so applications can decorate rendered columns without observing mutations or depending on `:has()`.

Consistency:

- `classNames` is honoured by `timeGrid` only; the month and list renderers must apply it too;
- `+n more` in month view is inert text with no hook, and clicking it currently falls through to the day's `select` (a create intent, which is the wrong meaning). Make it an activation target with its own content hook.

Density and format policies:

- slot label interval/format: the time axis is hardcoded to hourly `HH:00`;
- `hiddenDays`: drop non-worked days from any date-driven view.

Week anchoring is a product decision, not a defect: `week` currently
starts at the anchor date rather than at the civil week containing it.
Decide explicitly between "anchor + N days" and a `firstDay`-style
policy, then document the choice. Both are defensible; only the silence
is a problem.

Tests: source lifecycle (loading/settled/error/abort), class application in month and list, axis label intervals, hidden-day column derivation.

Exit condition: an application can render a busy state, style events uniformly across views, and react to a finished render, without reaching into internals.

## Demo coverage debt

Demos are part of the definition of done, and three already-implemented
core contracts are currently invisible in them:

- move/resize rejection: `calendar:eventmove` and `calendar:eventresize` are cancelable and carry `revert()`, but no demo refuses a drop. Add application business rules to `demo/showcase.html` - a bookable window plus non-bookable ranges is enough;
- hover intent: events carry `data-event-id`, so an application-owned tooltip needs no core hook at all. Show one, and use it to recover the detail that short cards drop;
- month `+n more`: make it navigate to the day instead of silently opening a create selection.

The showcase context menu is a fourth case, already written but written
badly: it clamps itself with hardcoded `innerWidth - 200` /
`innerHeight - 140` guesses that are wrong as soon as the menu's own size
changes, and it hand-rolls outside-click and Escape dismissal.

All four are overlay work, and the mechanism is settled in
[INTEGRATION.md](INTEGRATION.md#overlays): native `popover` for the top
layer and dismissal, `@lekoala/floating` for placement (`repositionAt()`
for the coordinate-driven menu, `reposition()` + `autoUpdate()` for
anything anchored to an event, since the calendar scroller moves
independently of the page). An application dependency, pinned in the demo
the way Actual CSS already is - never a runtime dependency of the core.
It must also stay out of the classic-script demos, which keep working
over `file://`.

Cheap and generic alongside them: week numbers in the demo mini-month
(`Temporal.PlainDate.weekOfYear`), and a visible busy state once
`calendar:loading` exists.

## Post-0.x candidates (only with use cases)

- generic mini-calendar/date navigator package;
- resource grouping metadata;
- resource header grouping/order modes, including a dates-above-resources arrangement;
- optional recurrence adapter;
- framework adapters;
- advanced all-day lane - the largest single gap the comparison confirmed;
- drag from external sources;
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
