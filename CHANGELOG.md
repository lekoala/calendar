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

### Notes

The core intentionally leaves application concerns such as booking rules, notifications, persistence, search, overlays, and cross-range workflows to the consumer.

See `docs/ROADMAP.md` for planned follow-up work.

## 0.0.0-prototype

* Initial project skeleton and architecture.
* Temporal-based date model.
* First `<calendar-view>` time-grid implementation.
