# Architecture

## High-level layers

```text
Application
│
├─ toolbar / mini calendar / search / dialogs / status
├─ persistence / websocket / backend adapters
│
└─ <calendar-view>
   │
   ├─ Calendar state
   │  ├─ anchor date
   │  ├─ view
   │  ├─ resources
   │  ├─ events
   │  └─ background ranges
   │
   ├─ Pure core
   │  ├─ Temporal range calculations
   │  ├─ slot geometry
   │  ├─ collision/overlap layout
   │  └─ resource/date column model
   │
   ├─ Renderers
   │  ├─ timeGrid
   │  ├─ resourceTimeGrid
   │  ├─ month (summary day grid, solo)
   │  └─ list (chronological groups, solo)
   │
   └─ Interaction engine
      ├─ hover hit test
      ├─ select
      ├─ drag
      ├─ resize
      ├─ keyboard
      └─ autoscroll
```

## Why not a framework renderer?

Nothing in the core scheduling model requires React/Svelte/Vue. A framework can make state reconciliation convenient, but a calendar with a bounded visible set can use explicit state + keyed DOM reconciliation.

The timed grid derives each column's clipped segments and positions before
rendering it. Pointer and native external placement share a controller that
uses the grid's hit tests.

Month chips reconcile in place when only an existing event is updated.
Time-grid segments use the same identity rule for `updateEvent()` renders:
unchanged segments keep their node, custom content and focus, while the
changed event is recreated. The grid shell stays mounted. Structural all-day
changes, add/remove mutations, refetches and navigation still rebuild the
whole view. When a node is replaced, the element restores focus by segment
key; when the node under an active gesture is replaced, the gesture is
disposed explicitly before removal.

## View state

Avoid inferring behavior from resource count. The core never switches views based on `resources.length`. Keep explicit concepts:

```js
{
  view: "week",
  date: PlainDate,
  resources: [],
  selectedResourceIds: [],
}
```

Applications may choose a policy such as showing a solo `timeGrid` for one selected resource and a `resourceTimeGrid` for several, but that policy lives outside the core. Switching `timeGrid ↔ resourceTimeGrid` preserves the anchor date, vertical scroll and reusable event data where defined.

## Resource/date columns

A resource grid can normalize columns to:

```js
{
  date: Temporal.PlainDate,
  resource: Resource
}
```

This keeps hit testing and event slicing explicit.

Header presentation in v0.x supports:

```text
resource → dates
```

Keep the `{ date, resource }` column model so the reverse order stays possible later, but expose no public `date → resources` option in v0.x.

## State updates and rendering

Target direction:

1. mutate/replace canonical state;
2. derive visible columns/events/layout;
3. reconcile keyed DOM;
4. overlays update independently during pointer movement;
5. async updates do not rebuild unrelated shell UI.

Pointer-move overlays should not trigger a full calendar render.

## Event identity

`event.id` is stable application identity. Incremental updates and realtime reconciliation key on it.

Do not use DOM identity, array index or start time as event identity.

## Data races

Every async source request gets:

- an `AbortSignal`;
- a monotonically increasing request/version id.

Both are needed: not every source respects abort.
