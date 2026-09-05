# Changelog

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
* Showcase application demonstrating room scheduling, availability backgrounds, mini-month navigation, search, clipboard operations, overlays, localization, and responsive layouts.
* Documented client/server synchronization contract for optimistic updates, revisions, conflicts, and realtime updates.

### Fixed

* A deferred `revert()` now addresses its event by id and only undoes the placement it applied, instead of writing back at a captured array index: removing the event, or moving it again, before the application answers no longer overwrites a neighbouring event or resurrects deleted state.
* Event normalization no longer injects `editable: true`, which outranked `configure({ editable: false })` and left the calendar editable through `moveEvent()`, `resizeEvent()`, drag, resize and the keyboard path.
* `refetchEvents()` lets each source replace only the collection it owns, so `addEvent()` and the `backgrounds` setter applied while a request is in flight survive its resolution.
* Drag autoscroll stops when its scroller leaves the document, instead of leaving a `requestAnimationFrame` loop running after the calendar is removed mid-drag.

### Notes

The core intentionally leaves application concerns such as booking rules, notifications, persistence, search, overlays, and cross-range workflows to the consumer.

See `docs/ROADMAP.md` for planned follow-up work.

## 0.0.0-prototype

* Initial project skeleton and architecture.
* Temporal-based date model.
* First `<calendar-view>` time-grid implementation.
