# Changelog

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
