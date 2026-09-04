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

## 11. Moving an event outside the visible window (cut/copy/paste)

A user needs to move (or duplicate) an event from one week to another, or to
a resource/date combination that is not on screen. A direct pointer drag
cannot do this in a windowed grid: the target column is not rendered, and
navigating mid-drag breaks pointer capture. The workflow is therefore always
two-phased, with the application owning the clipboard and the core owning the
commit.

Core stress:

- `getEventById(id)` to snapshot the event;
- `gotoDate()` / `prev()` / `next()` to navigate while the clipboard holds it;
- `getEventOverlaps(range, …)` to validate the paste target before proposing it;
- `moveEvent(id, { start, end, resourceId })` (move) or `addEvent()` with a new id (duplicate) to commit, through the same optimistic `preventDefault()` / `revert()` contract as pointer drags.

Nominal scenario (cut/paste across weeks):

1. on the event: context menu → "Cut" (or `Ctrl+X`); the shell marks the event as cut and shows a persistent banner ("Event ready to paste — navigate, then Paste here / Cancel (Esc)");
2. the user navigates (`prev` / `next` / `gotoDate`, mini month, view switch) — the clipboard survives re-renders and source refetches because the event itself stays in place until the paste commits;
3. on an empty slot of the target week: context menu → "Paste here (duration kept)"; the shell proposes `start = snapped slot, end = start + original duration` and refuses with a reason when the target is not `droppable`/`selectable` or a policy (conflict, blocked range) rejects it;
4. success clears the clipboard; failure keeps it and explains why.

Variants:

- copy/paste duplicates (`Ctrl+C`, "Copy", then paste creates a new id);
- sidebar parking: an application-owned lane holding parked/cut events, Drop-out of the grid (planned `calendar:eventdropout`, M9b) feeds it; paste reuses the same commit path;
- cancellation: `Esc`, a new cut/copy replacing the clipboard, or a successful paste.

Non-goals: drag-to-edge auto-navigation between weeks (timer + re-render under capture, conflicts with the vertical autoscroller); core-owned clipboard state or persistence; OS clipboard integration.
