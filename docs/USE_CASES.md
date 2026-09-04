# Use cases

The use cases are intentionally cross-domain. They should shape the core without pushing domain vocabulary into it.

## 1. Personal / solo calendar

A single user wants day, 3-day and week views with dense events, background working ranges and drag/resize.

Core stress:

- efficient `timeGrid`;
- no resource header overhead;
- custom event rendering;
- overlap layout for dense sets (several events sharing a column);
- keyboard/pointer selection;
- empty-slot hover preview;
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

Team-day overlaps include day-spanning closures and absences. Those are
all-day events (`allDay: true`, civil `Temporal.PlainDate`, end exclusive):
they render in the shared all-day lane, occupy the room's whole day in
availability logic, and move as whole days. A "the room is closed this
week" block is the same shape as a background, so `calendar.backgrounds`
accepts the identical civil contract.

## 4. Large organization

The organization may have dozens/hundreds of resources, but users normally display a filtered subset.

The application owns:

- resource search;
- favourites;
- teams/groups;
- locations;
- recently used resources.

The core must not assume that all resources are loaded/displayed.

Density behaviour is contract, not decoration:

- horizontal scrolling stays predictable at a minimum column width;
  resources and days are never hidden automatically;
- no virtualization: dense visible sets are rendered in full, and the
  documented UX limit is where the grid stops being readable, never where
  it stops being fast.

## 5. Background schedules

An application paints non-event intervals behind the grid:

- working hours;
- maintenance;
- availability;
- blocked periods;
- capacity windows;
- resource-scoped ranges in a resource grid.

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

The viewport/date/scroll should remain stable, while a user is scrolled
mid-day. Rapidly switching dates or resource sets must never let an older
response render: sources abort stale loads and the core ignores late
completions (see DATA_AND_REALTIME.md).

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

Nominal scenario (cut/park across weeks):

1. `Cut`/`Ctrl+X` (or "Mettre de côté") **adds the event to the move
   workbench and arms it** — the shell shows the persistent sidebar queue,
   and the event stays in place, marked as parked, until a placement
   succeeds (the banner under the toolbar is gone; the sidebar is the
   state);
2. the user navigates (`prev` / `next` / `gotoDate`, mini month, view
   switch) — the workbench survives re-renders and source refetches because
   it is application state, rendered off its own `change` beat;
3. on an empty slot of the target week: context menu → paste places the
   **armed item** (never an implicit "first"); the shell proposes
   `start = snapped slot, end = start + original duration` and refuses with
   a reason when the target is not `droppable`/`selectable` or a policy
   (conflict, blocked range) rejects it;
4. a successful placement removes the item and arms the next pending one; a
   failure keeps it in the queue and explains why.

Variants:

- copy/paste duplicates (`Ctrl+C`, "Copy", then paste creates a new id) —
  copy stays a plain clipboard, never the move queue;
- bulk fill: "Replanify the resource's day" or "this day" queues all
  affected events; each is then placed individually (drag or paste), which
  is exactly the §12 workflow;
- sidebar parking: `Cut`/park and the drag-out gesture feed the same queue —
  releasing an event drag outside the grid dispatches
  `calendar:eventdropout`, and the shell parks the event;
- cancellation: `Esc` disarms the active item (never empties the queue),
  "Empty" clears it, a successful placement advances to the next one.

Non-goals: drag-to-edge auto-navigation between weeks (timer + re-render under capture, conflicts with the vertical autoscroller); core-owned clipboard/workbench state or persistence; OS clipboard integration; silent disappearance of any queued event (nothing leaves the queue without a real `moveEvent`).

## 12. Resource closure and bulk rescheduling

A resource becomes unavailable for a civil date while many concrete events
already occupy it. The user needs to move all affected events to another
date (often the following week), preserving each event's duration and
relative time where possible.

The batch is a **work queue, not a group move**: adding N events to the
queue only means "these N are mine to place", and each one is then placed
individually (drag or paste). Partial progress is the normal working state —
a secretary resolves one booking, then the next — so the real invariant is
not atomicity but:

> **nothing leaves the queue without a placement that actually succeeded.**

Core stress:

- identify events by resource and civil-date range (application-owned);
- keep an application-owned queue (the workbench) while navigating to a
  target date or refetching the visible range;
- validate each proposed slot against background ranges, resource
  capabilities and event conflicts before commit (`getEventOverlaps`,
  excluding the event itself; already-placed moves are canonical, so the
  query sees them for free);
- preserve the relative time and duration of each event, unless the
  application explicitly chooses a different policy;
- each placement commits through the normal optimistic contract
  (`moveEvent` + `revert()`), and a refused/failed placement keeps the item
  in the queue with a reason.

Nominal scenario (resource closed for one day):

1. the application marks the resource/date as unavailable and queues the
   affected events (one action, many items in the workbench);
2. the secretary navigates to the target week — the queue survives;
3. each item is placed individually: drag from the sidebar (or paste the
   armed item) onto a slot; the shadow shows the real duration, snapping
   and validity, and the drop validates before committing;
4. a placed item leaves the queue; the next pending one is armed; if any
   placement is refused, the item stays and the queue explains why;
5. when the queue is empty, the application may offer a final summary (for
   example notifying the affected people) — a *notification* batch, never a
   move batch.

The current `batch()` API only coalesces rendering; it is not an atomic
transaction. That is fine for this workflow: the application owns the queue
and each placement is a completed action. A future bulk mutation API would
need an explicit preflight, commit and rollback contract; nothing so far
justifies it.

Variants:

- move the events to the same resource on another date;
- redistribute them across alternative resources;
- move only events overlapping a newly added background range;
- exclude or manually resolve events with no valid target.

Non-goals: the core deciding why a resource is unavailable, persistence or
transport orchestration, atomic batch moves, and silently removing a queued
event whose placement failed.

## 13. Acceptance scenarios

Concrete scripted checks the demo fixtures must pass before a release,
with no domain code inside the engine. Each line names the use case that
defines the behaviour; `demo/resources.html` and `demo/showcase.html`
carry the fixtures.

### Solo (scenario A)

- one agenda, 3-day time grid, ~30 events with several overlaps (§1);
- background ranges (§5) and the current-time indicator (§1), custom event DOM (§1);
- hover an empty slot and range-select (§1);
- drag an event in time/day and resize start/end (§1);
- open an application-owned modal from an event click (§6);
- apply an incremental remote update without moving scroll/date (§7).

### Resources (scenario B)

- 2 resources × 3 days with resource → date headers (§2);
- resource-specific backgrounds (§5);
- drag an event from resource A to B (§2);
- one read-only resource (§2);
- range selection returns the resource id (§2).

### Larger teams / density (scenario C)

- 1×7, 2×3, 6×1, 6×3 and 12×1 fixtures (§4);
- horizontal scrolling predictable at a minimum column width; resources
  and days never hidden automatically; no virtualization (§4);
- note where the view becomes UX-limited rather than technically slow.

### Async races (scenario D)

Rapidly switch date and resource sets with deliberately delayed source
responses; only the newest state may render (§7, DATA_AND_REALTIME.md).

### Realtime (scenario E)

Simulate add/update/remove every few seconds while the user is scrolled
mid-day; no navigation or scroll reset (§7).

## Stop conditions

Do not keep layering patches if the architecture requires a full grid
re-render on every pointer move, domain-specific concepts to express
generic interactions, duplicate solo/resource interaction engines,
unbounded document/window listeners, or resource drag implemented as
application-specific special cases. These mirror the invariants in
`AGENTS.md`; if they appear, fix the core boundary before adding features.
