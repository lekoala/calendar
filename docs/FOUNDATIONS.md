# Foundations

This document freezes the decisions that should survive the first implementation experiments.

## 1. Generic core, demanding consumers

The library is not a medical scheduler. Medical scheduling is simply a useful stress case because it combines dense events, resources, background ranges, permissions, realtime updates and fast interaction.

The same core must make sense for:

- a personal or team calendar;
- meeting rooms;
- employees/consultants;
- classrooms/teachers;
- vehicles;
- equipment/machines;
- sports courts;
- service bays;
- studio/resource booking.

Domain-specific UI belongs in adapters/applications.

## 2. Temporal is canonical

The calendar starts with Temporal rather than accumulating a legacy `Date` layer and migrating later.

Use:

- `PlainDate` — navigation/date cells;
- `PlainTime` — slot boundaries (exclusive day end, not `24:00` as a `PlainTime`);
- `Duration` — event/slot duration, including `snapDuration` and `defaultTimedEventDuration`;
- `ZonedDateTime` — real scheduled items in a named timezone;
- `Instant` — absolute instants when needed.

Grid geometry follows calendar wall-clock time: a 23-hour or 25-hour daylight-saving day keeps its local hourly slots and does not change column height artificially. Canonical timezone-bearing serialization looks like `2026-10-25T09:00:00+01:00[Europe/Brussels]`.

The initial package uses the side-effect-free `temporal-polyfill` ponyfill. Native Temporal can replace it without changing the public model later.

## 3. Recurrence is outside the core

The calendar requests a visible range and consumes occurrences. A server, provider adapter or optional recurrence module expands recurring series.

This avoids coupling rendering to RRULE semantics, exception editing or a specific recurrence library.

## 4. Solo and resources are separate compositions

`timeGrid`:

```text
date × time
```

`resourceTimeGrid`:

```text
resource × date × time
```

Do not force the resource layer into the common solo case.

## 5. Range-scoped async data

The main data boundary is:

```js
async ({ start, end, resourceIds, signal }) => events
```

The amount of loaded data should track what can actually be useful on screen.

## 6. Background ranges are generic

The core supports geometry behind events but does not label it availability, leave, maintenance, working hours, etc.

## 7. Application composition stays external

The core does not own:

- search;
- forms/modals;
- command/tool launchers;
- sidebars;
- waiting-room/workflow state;
- auth/network conventions;
- realtime transport;
- billing;
- notifications.

It exposes enough navigation and DOM events to compose these cleanly.

## 8. No virtualization target in v0.x

The useful problem is choosing a sensible visible subset, not making 500 simultaneous resources cheap.

The application should normally query:

```text
visible dates × selected resources
```

before the DOM becomes the dominant cost.

## 9. Light DOM and author styling

The calendar should integrate with existing design systems. Light DOM permits normal selectors, tokens, container context and author-provided nodes.

The library should calculate geometry, not dictate product styling.

## 10. Browser interaction is core quality

Hover slot, range selection, drag, resize, autoscroll, focus, touch and realtime reconciliation are part of the quality bar. They require real-browser tests.
