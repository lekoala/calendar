# Changelog

## Unreleased

### Added

* `monthEventOrder(a, b)` customizes month chip order, Tab order and the
  more-button payload before applying the chip limit. Ties use start instant
  then source order; other views and canonical event order are unchanged.
* All-day events resize by day edges: `resizeEvent()` now accepts civil
  ranges, the lane exposes horizontal start/end handles only on visible true
  edges, and `Alt`+arrows resize from the keyboard. Mutations keep the
  optimistic `calendar:eventresize`/`revert()` contract; programmatic resizes
  remain policy-free. Hidden days count in the civil range, and an edge
  clipped by the visible window exposes no handle.
* External renders preserve focus and scroll inside the calendar. A focused
  event segment is restored by event id, date and resource; focus outside the
  calendar is never stolen. A render that arrives during a pointer gesture
  cancels the gesture without committing.

### Fixed

* Current-time markers advance every minute and move to the correct civil
  day after midnight without replacing event nodes, interrupting pointer
  gestures or refetching sources. Timers stop on disconnect.

### Changed

* All-day events and backgrounds must cover at least one civil day
  (`end > start`). Normalization rejects empty ranges and `resizeEvent()`
  returns `null`; timed zero-length ranges keep their existing contract.
  This is a behavior change for callers that previously inserted an invisible
  empty all-day range.

## 0.3.0 - 2026-10-28

A consolidation release: 0.2's contracts are tightened and pinned by tests, no
new feature surface. See [docs/MIGRATION-0.3.md](docs/MIGRATION-0.3.md) for the
consumer-facing changes.

### Fixed

* `revert()` is bound to the placement write it created, not to the range it
  produced. Each event carries an internal monotonic placement ticket that
  every write (commit, `addEvent`, `updateEvent`, `removeEvent`, wholesale
  replacement, resolved refetch) takes, so a stale undo no longer overwrites a
  newer write — including the ABA sequence A → B → C → B and a realtime echo
  that confirms the pending placement. Geometry equality alone could not tell
  the two apart.
* All-day dragging uses civil-date displacement instead of column distance,
  preserving dates across resources and counting hidden weekdays correctly.
  Grabbing a multi-day continuation preserves its offset from the event start;
  preview validation and commit use the same proposed range.
* Removing or replacing an async source invalidates and aborts pending work,
  including sources that ignore abort. Refetching with no sources also
  invalidates obsolete requests, and cancellation settles the loading state.
* Timed events and backgrounds remain visible across the repeated autumn hour
  when their wall-clock end is at or before their start: the slice extends
  from its local start by its elapsed duration, clipped to the visible slots.
  Canonical boundaries and overlap queries keep the original instants.
* All-day events assigned to different resources stack without overlapping in
  solo views; resource views retain independent rows within their columns.
* Global all-day backgrounds render as separate contiguous segments per
  resource, without painting unrelated dates between resource blocks.
* Unassigned all-day events stay hidden in resource views, whether their
  resource id is omitted or null. Global all-day backgrounds still apply to
  every resource, and solo views retain both kinds of entry.
* User moves, resizes and selections revalidate the exact proposed range
  immediately before committing or dispatching the intent. Changes in
  application-owned policy state during a gesture take effect on release,
  even when the snapped target has not changed.
* A numeric `resourceId` no longer detaches its event: event and background
  normalization stringify `resourceId` alongside the resource `id`, so an
  event assigned with an SQL-style numeric id stays in its resource column
  instead of silently disappearing from resource views.
* Month day-cell selection now consults `configure({ interactionPolicy })`
  like every other user-originated gesture: a refused selection dispatches no
  `calendar:select`, matching the time-grid contract.
* `slot-max="24:00"` renders a full-day grid instead of an empty component:
  `24:00` and `24:00:00` are accepted as the exclusive end of day (1440
  minutes), which `Temporal.PlainTime` cannot hold itself.
* The `24:00` boundary no longer collapses to `23:00`: `zonedDateTimeAt` rolls
  whole days into the civil date, so selecting, dragging or resizing up to the
  exclusive end of a full-day grid produces the next midnight instead of an
  inverted range. This fixes interactions (selection, drag, resize, preview,
  external drop), not only the axis label.
* Inverted ranges are rejected consistently: `normalizeEvent` and
  `normalizeBackground` throw when `end` precedes `start` (civil or timed),
  and `moveEvent`/`resizeEvent` return `null` without publishing optimistic
  state.
* A failed refetch no longer publishes a half-updated calendar: the event and
  background collections are normalized before either is committed, so a
  malformed payload leaves the previous state (and DOM) intact and only emits
  `calendar:loaderror`.
* Moving the element while a source request is in flight restarts the aborted
  load on reconnect instead of leaving the calendar empty; the reload is
  tracked independently of the busy state.
* `updateEvent()` is a true merge: an omitted key keeps its previous value
  while an explicit `null`/`undefined` clears it. `start`, `end` and `allDay`
  fall back to the stored event when omitted, so a partial echo needs no range,
  survives a round trip without resetting `classNames`/`extendedProps`, and
  never flips a civil event to timed. `allDay` is distinguished by key
  presence: an explicit `allDay: undefined`/`null` clears a civil event to
  timed, while an absent key preserves it. `moveEvent(id, { resourceId: null })`
  detaches an event from its resource instead of keeping it through `??`.
* Invalid attributes fall back instead of throwing inside the render frame: a
  malformed `date` anchors on today in the configured zone with a one-time
  warning, and a malformed or inverted `slot-min`/`slot-max` pair resets to
  the defaults.

### Changed

* Month day-cell selection is modeled as an all-day civil selection:
  `calendar:select` now carries `allDay: true` with `Temporal.PlainDate`
  `start`/`end` instead of a zoned 24-hour range, and `interactionPolicy`
  receives the same all-day target. Time-grid selection stays timed.
* `prev()`, `next()` and `today()` return the source reload they trigger, so
  every navigator can be awaited like `gotoDate()`; they previously returned
  `void`.
* An unknown `view` name is reported once with `console.warn` instead of
  passing silently while rendering as a rolling range.
* Tooling aligned with the sibling component repos: Bun 1.4.3,
  Biome 2.5.15, Playwright 1.64.0 and `temporal-polyfill` 1.0.5. A
  `bunfig.toml` excludes the Playwright suites from Bun's test discovery, so
  a bare `bun test` runs only the unit tests. CI runs `verify`, the sharded
  browser suite, the dist smoke build and the showcase suite, which was
  previously never executed.

## 0.2.0 — 2026

The planned 0.2 operational-trace (`docs/ROADMAP.md`, milestones 10–17). Each
entry consumes the previous one; no new interaction engine, clock service,
query subsystem, resource tree or source cache was added.

### Added

* A single private `afterRender` lifecycle primitive, so focus, live-region
  announcements and the reveal highlight land once the pending render has
  inserted its subtree, instead of nesting `requestAnimationFrame` dances.
* Live temporal state: rendered event nodes carry
  `data-temporal-state="past|current|future"`, content hooks receive
  `info.temporalState`, and the state ages with a single one-shot timer to
  the next visible event boundary — no clock service or periodic tick.
* `getRangeContext({ start, end, resourceId })` as the one definition of
  range context, delivered by `calendar:select`, `eventmove`, `eventresize`
  and `externaldrop`.
* `configure({ interactionPolicy })`: a synchronous permission gate
  (`action ∈ move | resize | select`, plus `external`) at gesture entry and
  on snapped-target change, sharing one evaluation path with the external
  drop `validate`. Programmatic mutations never consult it.
* `checkInteraction({ action, event, start, end, resourceId, allDay })`:
  that same evaluation as a question an application can ask, normalized to
  `{ ok, reason }`, so a menu row or a preflight can be honest before a
  gesture exists instead of re-implementing the policy.
* `revealEvent(id, { focus, highlight })` for in-range reveals and an
  awaitable `reveal({ eventId, date | start })` that navigates once, then
  focuses/highlights — the search-result navigation primitive.
* `previewRange({ start, end, resourceId, reason })` / `clearPreview()`: a
  read-only, `pointer-events: none` render overlay for application-proposed
  ranges, painted with the same slice/geometry primitives as events. An
  optional `reason` marks the proposal as refused: the overlay takes the
  `cv-invalid` styling and exposes the reason through `data-reason`,
  exactly like a refused drag mirror.
* One-level resource grouping (`resourceGroups`, `resource.groupId`,
  `resourceGroupContent`): a group-header row above the resource headers,
  group order winning over the `resources` array order, ungrouped resources
  trailing without a header, and the first duplicate group id winning.
  Hierarchy/expand/collapse stays out of scope by design.
* Two-axis viewport autoscroll: dragging along a column body keeps scrolling
  vertically as before, and now also scrolls horizontally while the pointer
  rests near the scroller edge, so wide resource grids can be dragged
  through columns that are off screen.
* Geometry seams for the time-grid chrome: `--calendar-axis-size` (the
  axis track the column list repeats after, shared with the renderer's grid
  template), `--calendar-resource-row-size` (resource header height and the
  sticky offset it imposes on day headers) and `--calendar-group-row-size`
  (group header height and its stacked offsets, defaulting to the resource
  row size). Overriding one variable moves the whole coupled set; the
  showcase no longer re-points those offsets itself.
* `configure({ dayCount })` overrides the visible-day count of rolling
  views (`day`, `threeDays`, `resourceDay`, `resourceThreeDays`, `list`), so
  a 2-, 4- or 5-day schedule needs no new view name and `threeDays` stays a
  preset for `3`. It counts visible days through `hiddenDays`, pages
  `prev()`/`next()` by the effective count, feeds sources the enveloping
  civil range, and is ignored by `week` (a week stays a civil week) and
  `month`.

### Fixed

* A pointer drag whose day and minute deltas disagree in sign (e.g. one day
  backward and a few hours forward) no longer dies on an invalid mixed-sign
  `Temporal.Duration`: the commit shifts the event by two single-unit
  additions (days, then minutes), so the drop commits instead of silently
  snapping back.
* A timed drag's hover verdict now judges the range the drop would commit —
  the whole event shifted by the column day delta plus the minute delta —
  rather than the rendered day slice. For clipped slices and multi-day
  events the two used to disagree, so a destination could look valid under
  the pointer and still revert on release.
* Interaction ghosts that carry `data-reason` (drag mirrors, resize and
  selection ghosts, external placement ghosts) now render the reason as a
  chip inside the ghost, so a refused destination says why, not just turns
  red.
* A moved event dropped into a resource-less column keeps its existing
  `resourceId` instead of being silently unassigned (which hid it when the
  view switched back to a resource grid), and a moved press suppresses its
  residual click on refused destinations as well as committed ones.
* External mouse placement follows captured pointer coordinates once per
  animation frame, reuses the ghost and skips repeated validation within a
  snapped slot. Calendar state changes invalidate the preview decision; drop
  always revalidates. Escape, cancellation and disconnect clean up the gesture.
* Overlap queries compare canonical zoned boundaries directly by instant,
  avoiding unnecessary time-zone projections. The showcase workbench reuses
  its range context for conflict checks instead of scanning events again.
* A policy-refused resize and a policy-refused selection drag now paint the
  refusal: both already carried `cv-invalid` and `data-reason`, but only the
  drag mirror and the external ghost had a stylesheet rule, so those two
  looked identical to an accepted gesture.
* `scrollToTime()` before the first render is no longer a silent no-op: the
  requested offset is recorded and applied once the first render has
  produced the scroller (last write wins), and the return value is always
  the requested pixel offset instead of `0`.

### Notes

The 0.2 concurrency matrix (pending → commit/revert/supersede, realtime echo
mid-pending, 409-style conflicts, no stale render) remains the milestone-§19
exit condition, carried forward as explicitly planned work.

## 0.1.0 — 2026

First public release of the calendar.

### Added

* Temporal-based calendar core with `day`, `threeDays`, `week`, `resourceDay`, `resourceThreeDays`, `month`, and `list` views.
* Events, resources, background ranges, async event sources, and realtime-friendly mutation APIs.
* Drag, resize, range selection, keyboard editing, autoscroll, and optimistic mutations with `revert()`.
* Resource views, hidden days, configurable week starts, slot ranges, labels, locale-aware formatting, and content hooks.
* Event overlap queries and neighbor snapping for drag, resize, and selection.
* Accessibility support including keyboard navigation, live announcements, reduced motion, forced colors, and touch/pen interactions.
* Public civil-date helpers for building surrounding UI such as mini calendars.
* ESM, classic IIFE, standalone, CSS, TypeScript declarations, and `custom-elements.json` distributions.
* Documented client/server synchronization contract for optimistic updates, revisions, conflicts, and realtime updates.

### Fixed

* A deferred `revert()` now addresses its event by id and only undoes the placement it applied, instead of writing back at a captured array index: removing the event, or moving it again, before the application answers no longer overwrites a neighbouring event or resurrects deleted state.
* Event normalization no longer injects `editable: true`, which outranked `configure({ editable: false })` and left the calendar editable through `moveEvent()`, `resizeEvent()`, drag, resize and the keyboard path.
* `refetchEvents()` lets each source replace only the collection it owns, so `addEvent()` and the `backgrounds` setter applied while a request is in flight survive its resolution.
* The first axis label no longer hangs outside the time grid, where it collided with the all-day lane's border above it; only that label is anchored below its own hour line, the rest stay centred on theirs.
* Drag autoscroll stops when its scroller leaves the document, instead of leaving a `requestAnimationFrame` loop running after the calendar is removed mid-drag.

### Notes

The core intentionally leaves application concerns such as booking rules, notifications, persistence, search, overlays, and cross-range workflows to the consumer.

See `docs/ROADMAP.md` for planned follow-up work.

## 0.0.0-prototype

* Initial project skeleton and architecture.
* Temporal-based date model.
* First `<calendar-view>` time-grid implementation.
