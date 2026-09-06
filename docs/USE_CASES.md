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
// select/show resource in application state, then reveal through the anchor
// the search result carries (Milestone 14: gotoDate awaited as a single
// load, then scroll/highlight/focus on the post-render node).
await calendar.reveal({ eventId: result.id, date: result.date, focus: true })
// In-range events reveal without navigating or reloading:
calendar.revealEvent(result.id, { focus: true, highlight: true })
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
  affected events (Tools menu, or right-click the day header — in resource
  views the action is scoped to that room's column); each is then placed
  individually (drag or paste), which is exactly the §12 workflow;
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

## 14. Temporal state at the operator's desk

A page stays open all day. Events age from future → current → past as the
clock moves, without any refetch. The operator distinguishes them visually,
and one workflow refuses to move past items while another in the same
application allows retroactive correction. The core exposes the temporal
fact on rendered nodes and to content hooks, and never bakes a policy into
the model: `editable`/`movable`/`resizable` remain application-owned.

Core stress:

- `data-temporal-state="past|current|future"` on rendered nodes and
  `info.temporalState` in content hooks (the single contract), derived from
  canonical ranges and `now`: `end <= now` → `past`, `start <= now < end` →
  `current`, `now < start` → `future`;
- the fact ages live without a source refetch: one one-shot timer to the
  next visible `start`/`end` boundary triggers the next render, which
  recomputes both the state and the following boundary;
- no write to `editable`/`movable`/`resizable` from the core; boolean
  conveniences, if any, stay derived from the same single value.

## 15. Guarded interaction

Before a gesture starts — and at the destination while it runs — the
application can refuse: a past or locked item, a blocked target. The refusal
is visible before any commit: no resize handle, no drag start, an invalid
ghost with a reason. Refusing and reverting after commit remain supported,
but the archetypal move is refused up front.

The principle is already proven by external placement: `addExternalDrop`
validates structurally and by application before showing a ghost. Internal
move/resize/select should share the same evaluation path instead of only
preventing the dispatch at commit.

Core stress:

- `interactionPolicy({ action, event, target, context, now })` →
  `true | false | reason`, with `action ∈ move | resize | select`, strictly
  synchronous;
- gates handle availability and drag start before the gesture, and validates
  the destination when the logically snapped target changes, using the
  existing invalid-ghost/`data-reason` model;
- destination validation consumes the same range context as the interaction
  events (`getRangeContext`, Milestone 12) instead of its own notion of
  "under this range";
- one evaluation path shared with `addExternalDrop`'s `validate`;
- separation: user interaction goes through the policy, the mutation API
  stays authoritative — `removeEvent()` may still delete locked/past items
  because a server or realtime path demanded it.

## 16. What is under this range?

When an application proposes a range (interactive select, a move
destination, an external drop, or a pure query), it needs what the range
touches: which events and which background ranges cover or merely overlap
it. A covering background may carry default creation metadata (a working
window: location, default category); an overlapping one may be a blocker.
The core resolves geometry; interpreting which background is the context and
which is the constraint stays application-side, because several backgrounds
can cover the same range and the core must not pick one.

Core stress:

- `getRangeContext({ start, end, resourceId })` →
  `{ events: { overlapping: [...] }, backgrounds: { overlapping: [...],
  covering: [...] } }`;
- `covering` = `background.start <= range.start && background.end >=
  range.end`; `overlapping` = plain intersection;
- interaction intents (`calendar:select`, `eventmove`, `eventresize`,
  `externaldrop`) deliver `detail.context` through the same primitive; the
  interaction policy and the programmatic preview read the same shape from
  the same source;
- no arbitrary background selection, no semantic type invented by the core.

## 17. Proposed-slot preview

A slot-finder suggests a handful of ranges (same day/time across resources,
or spread over days). The application wants to show each suggestion inside
the grid: it navigates to the date and makes the range visible with the real
geometry. Because no interaction is running, the suggestion is a
programmatic preview, distinct from the select ghost: it must not start a
selection or fire `calendar:select`.

Core stress:

- `previewRange({ start, end, resourceId })` and `clearPreview()`;
- preview geometry obeys the same slice/layout rules as events and honors
  resource scoping;
- `pointer-events: none`; independent of the pointer selection lifecycle;
- pairing with reveal (Milestone 14) for the navigate → preview → confirm
  workflow.

## 18. Resource grouping to reduce visual load

An operator manages many resources at once (rooms, vehicles, field teams).
With 8–15 resources a flat row of columns is heavy to read. One grouping
layer (site, building, team) turns the flat set into labelled blocks that
match how the operator thinks. Resource hierarchy (site → unit → member,
collapsible) is a different problem and stays out of scope.

The group is visual and organizational, not a selection model: activating a
group can stay application-side by expanding it to the members' `resourceIds`.

Core stress:

- `resourceGroups = [{ id, title }]` plus `resource.groupId` (single level);
- a group-header row above the resource headers, covering the member
  columns;
- `resourceGroupContent({ group, resources, element })`;
- array order defines group order; the `resources` array defines order within
  a group;
- no nesting/expand/collapse/tree grid; `resourceIds` stays the filtering
  channel.

## 19. Arbitrary view length and concurrent mutations

Two workflows. (a) A time grid of 2, 4 or 5 days: custom durations appear
without new view names, only a day count. (b) Two operators edit while the
page is open: an optimistic move is pending when a second mutation lands, or
a realtime echo arrives mid-pending. The existing
optimistic/`preventDefault()`/`revert()` contract plus
`revision`/`mutationId` are the seam; the milestone is the test matrix that
makes pending/conflict/revert/superseded behaviour an explicit acceptance
surface.

Core stress:

- `dayCount`/`duration` for time grids; week-anchored and rolling views keep
  their existing semantics;
- browser scenarios: pending → revert; pending → superseded move; realtime
  update during a pending commit; conflict; no stale render.

## Stop conditions

Do not keep layering patches if the architecture requires a full grid
re-render on every pointer move, domain-specific concepts to express
generic interactions, duplicate solo/resource interaction engines,
unbounded document/window listeners, or resource drag implemented as
application-specific special cases. These mirror the invariants in
`AGENTS.md`; if they appear, fix the core boundary before adding features.
