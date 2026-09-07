# Changelog

## 0.2.0 — 2026

The planned 0.2 operational-trace (`docs/ROADMAP.md`, milestones 10–16). Each
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
* `previewRange({ start, end, resourceId })` / `clearPreview()`: a
  read-only, `pointer-events: none` render overlay for application-proposed
  ranges, painted with the same slice/geometry primitives as events.
* One-level resource grouping (`resourceGroups`, `resource.groupId`,
  `resourceGroupContent`): a group-header row above the resource headers,
  group order winning over the `resources` array order, ungrouped resources
  trailing without a header, and the first duplicate group id winning.
  Hierarchy/expand/collapse stays out of scope by design.

### Fixed

* A policy-refused resize and a policy-refused selection drag now paint the
  refusal: both already carried `cv-invalid` and `data-reason`, but only the
  drag mirror and the external ghost had a stylesheet rule, so those two
  looked identical to an accepted gesture.

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
