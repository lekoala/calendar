# Use cases

The use cases are intentionally cross-domain. They should shape the core without pushing domain vocabulary into it.

## 1. Personal / solo calendar

A single user wants day, 3-day and week views with dense events, background working ranges and drag/resize.

Core stress:

- efficient `timeGrid`;
- no resource header overhead;
- custom event rendering;
- keyboard/pointer selection;
- current-time indicator;
- async range loading.

## 2. Small resource comparison

Two or three resources must be compared over two or three days.

Examples:

- consultants;
- rooms;
- doctors;
- vehicles.

Core stress:

```text
resource × date × time
```

- multi-level headers;
- resource-aware hit testing;
- moving an event between resources;
- `selectable`/`droppable` and read-only states.

## 3. Team day

Several resources are useful simultaneously, but only for a single day.

Examples:

- reception/dispatch view;
- service bays;
- studio rooms;
- whole team today.

This is still `resourceTimeGrid(duration=1 day)`, but UX defaults may differ from a 3-day comparison.

## 4. Large organization

The organization may have dozens/hundreds of resources, but users normally display a filtered subset.

The application owns:

- resource search;
- favourites;
- teams/groups;
- locations;
- recently used resources.

The core must not assume that all resources are loaded/displayed.

## 5. Background schedules

An application paints non-event intervals behind the grid:

- working hours;
- maintenance;
- availability;
- blocked periods;
- capacity windows.

The core only knows background geometry and optional metadata/class hooks.

## 6. External editor

Clicking an event opens an application-owned modal, route or panel. When the form saves, the application calls `updateEvent()` or `refetchEvents()`.

The calendar does not provide the editor.

## 7. Realtime scheduling

A remote event arrives while the user is looking at the calendar.

Transport might be WebSocket, SSE, polling or another provider. The application calls:

```js
calendar.addEvent(event)
calendar.updateEvent(event)
calendar.removeEvent(id)
```

The viewport/date/scroll should remain stable.

## 8. Search → reveal

Search happens outside the core. The result contains an event/date/resource. The application composes:

```js
calendar.gotoDate(result.date)
// select/show resource in application state
// future calendar.revealEvent(result.id)
```

## 9. Recurring events

The source expands recurring series for the requested range. The renderer sees ordinary occurrences.

Editing "this occurrence / future / series" remains an application workflow.

## 10. Operational list

Some workflows are better as a list than a time grid. `list` should render the same canonical events with custom content hooks rather than forcing every workflow into the grid.
