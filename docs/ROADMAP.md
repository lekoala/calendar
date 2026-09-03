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

## Demo coverage debt

Demos are part of the definition of done, and two already-implemented
core contracts are still invisible in them:

- move/resize rejection: `calendar:eventmove` and `calendar:eventresize` are cancelable and carry `revert()`, but no demo refuses a drop. Add application business rules to `demo/showcase.html` - a bookable window plus non-bookable ranges is enough;
- hover intent: events carry `data-event-id`, so an application-owned tooltip needs no core hook at all. Show one, and use it to recover the detail that short cards drop.

The showcase context menu is a third case, already written but written
badly: it clamps itself with hardcoded `innerWidth - 200` /
`innerHeight - 140` guesses that are wrong as soon as the menu's own size
changes, and it hand-rolls outside-click and Escape dismissal.

All three are overlay work, and the mechanism is settled in
[INTEGRATION.md](INTEGRATION.md#overlays): native `popover` for the top
layer and dismissal, `@lekoala/floating` for placement (`repositionAt()`
for the coordinate-driven menu, `reposition()` + `autoUpdate()` for
anything anchored to an event, since the calendar scroller moves
independently of the page). An application dependency, pinned in the demo
the way Actual CSS already is - never a runtime dependency of the core.
It must also stay out of the classic-script demos, which keep working
over `file://`.

Still cheap and generic: week numbers in the demo mini-month
(`Temporal.PlainDate.weekOfYear`).

Done with milestone 8: the showcase reports `calendar:loading` in its live
strip and dims the grid while a source is in flight, and month `+n more`
opens the day it belongs to.

Others:
- Use proper icons (eg: tabler from cdn), not font glyphs (fix alignment, improve consistency)
- Add tools menu demo (eg: an actual css mega menu, with icons)
- Aura on new event
- The views buttons take too much visual space - keep it light. It must work on mobile (maybe adjust text)
- In mobile, not enough screen state is granted for the calendar itself : this is what matters and should come first
- The avatar (SO) menu should work, and display some dummy menu for full credibility
- Debug/test tools should not clutter the ui (could be hidden in the tools or a dedicated menu)

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
