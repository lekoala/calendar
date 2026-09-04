# Integration layer (example consumer)

This file exists to keep the boundary explicit. None of these concepts belong in the generic core.

## Composition

```text
Application shell
│
├─ mini calendar
├─ resource picker
├─ toolbar + pinned tools
├─ availability finder
├─ status bar
├─ external modals/forms
├─ realtime adapter
│
└─ <calendar-view>
```

## Mapping

External item → generic `Resource`:

```js
{
  id: String(item.id),
  title: item.displayName,
  selectable: true,
  droppable: item.canAccept,
  extendedProps: {
    externalId: item.id,
  },
}
```

External occurrence → generic `Event`:

```js
{
  id: occurrence.id,
  resourceId: String(occurrence.resourceId),
  start: occurrence.start,
  end: occurrence.end,
  title: occurrence.displayTitle,
  extendedProps: {
    externalId: occurrence.externalId,
    revision: occurrence.revision,
  },
}
```

Working windows and blocked periods map to generic background ranges with classes/metadata.

## Event source

```js
calendar.eventSource = loadEvents;

async function loadEvents({ start, end, resourceIds, signal }) {
  return store.loadOccurrences({ start, end, resourceIds, signal });
}
```

Recurrence expansion remains upstream: the calendar receives occurrences.

## External editor

```js
calendar.addEventListener("calendar:eventclick", (event) => {
  openEditor(event.detail.event);
});
```

When the editor saves:

```js
calendar.updateEvent(updatedOccurrence);
```

or refetch if the change has broader scheduling effects.

## Overlays

The core dispatches intent plus the coordinates needed to place something,
and stops there. `calendar:eventcontextmenu` carries the `nativeEvent`, so
`clientX`/`clientY` are available; events and month chips carry
`data-event-id`, so an application can attach hover behaviour without a
core hook. Menus, tooltips, day popovers and editors are application code.

The reference mechanism for those overlays is the platform first, geometry
second:

- native `popover` for the top layer, light dismiss and Escape - it removes the manual outside-click and keydown bookkeeping an application would otherwise write;
- [`@lekoala/floating`](https://github.com/lekoala/floating) for placement: `reposition(reference, floating, options)` against an element, `repositionAt(x, y, floating, options)` for coordinate-driven menus, and `autoUpdate()` to follow movement.

`floating` does not wire itself to the `popover` attribute - that is an
explicit non-goal on its side - so the application repositions on
`toggle`, and calls `autoUpdate()` while the overlay is open. That last
part matters here: the calendar scroller moves independently of the page,
so an overlay anchored to an event must follow the scroller, not the
document.

```js
menu.addEventListener("toggle", (event) => {
  if (event.newState !== "open") return stop?.();
  reposition(eventNode, menu, { placement: "right-start", distance: 6 });
  stop = autoUpdate(eventNode, menu, () =>
    reposition(eventNode, menu, { placement: "right-start", distance: 6 }),
  );
});
```

Positioning stays outside the package: it is an application dependency,
never a runtime dependency of the core. `floating` shares our
compatibility baseline (ES2022, Chromium 99+, Firefox 98+, Safari 15.4+)
and has no runtime dependencies, so it is a safe demo dependency, but the
core keeps shipping only geometry it computes itself. CSS anchor
positioning is the eventual platform answer and is deliberately not the
one used yet: it is above our browser floor.

## Clipboard and the move workbench

Move and copy split cleanly (use case 12 in
[USE_CASES.md](USE_CASES.md#12-resource-closure-and-bulk-rescheduling)):

- **Move** rides an application-owned **workbench** — a persistent queue of
  events waiting to be placed, with one *armed* item. `Cut` / "park" /
  resource-day / whole-day fills only add + arm; paste, drag and click
  consume the armed item. The demo `demo/workbench.js` is the pure state
  holder (`items[]` + `activeId`, one `change` beat per mutation), and the
  showcase sidebar renders off that beat — never off `calendar:render`.
- **Copy** stays a plain clipboard (a duplicated booking is not a waiting
  move): snapshot, `eventContent`/banner while it holds, `addEvent()` on
  paste.

The core owns neither. Recommended shape:

```js
// Move: arm in the workbench (the event stays in place until placed).
workbench.add(item);
workbench.activate(item.id);
// … navigate …
// Place at an empty-slot intent (detail carries snapped date/time/resource):
const conflicts = calendar.getEventOverlaps({ start, end });
if (conflicts.length > 0) return refuse("Overlaps an existing booking");
const moved = calendar.moveEvent(workbench.active.id, { start, end, resourceId });
if (moved) workbench.complete(item.id); // remove + arm the next pending

// Copy: classic clipboard, duplicated on paste.
calendar.addEvent({ ...item, id: newId, start, end });
```

Robustness rules the showcase demonstrates:

- a parked event stays rendered until its placement succeeds, so
  `refetchEvents`, abort/stale guards and navigation cannot lose it; the
  workbench queue is the guarantee nobody disappears, and queued grid nodes
  are marked through a post-render pass (`data-parked="true"` re-applied on
  `calendar:render`) rather than by the node surviving;
- nothing leaves the queue without a successful `moveEvent` (a refused or
  failed placement keeps the item and the queue); items already placed are
  canonical, so the next `getEventOverlaps()` sees them for free — there is
  no "planned vs canonical" solver;
- paste targets are proposed from `calendar:eventcontextmenu` on empty slots
  (which already carries the snapped date/time/resourceId), offering
  "Paste (armed item) here" with the item's own duration, disabled with a
  reason when the policy refuses;
- `Esc` disarms the armed item (never empties the queue), a successful
  placement advances to the next pending one, "Empty" clears the queue;
  `Ctrl+X/C/V` mirror the menu items where a paste target exists (empty
  slots are not tab stops, so `Ctrl+V` alone has no target — it reuses the
  last empty-slot intent).
- external drag onto a slot is the same placement: the core's future
  `calendar:externaldrop` seam delivers an anchor the application feeds to
  the exact same `getEventOverlaps() → moveEvent()` path.

## Realtime

```js
transport.on("created", (payload) => calendar.addEvent(mapEvent(payload)));
transport.on("updated", (payload) => calendar.updateEvent(mapEvent(payload)));
transport.on("deleted", ({ id }) => calendar.removeEvent(id));
```

The core never knows the transport exists. Payload shape, concurrency
(`revision`), echo deduplication (`mutationId`) and conflict answers
(`409`) are specified in [the sync contract](SYNC_CONTRACT.md); the demo
`demo/sync-adapter.js` module provides pure helpers for them.

## View policy

The application can decide defaults such as:

- one resource → solo `timeGrid`;
- 2–3 resources → `resourceThreeDays` when useful;
- many resources → `resourceDay` / filtered selection;
- month/list → alternate representation.

These are application UX policies, not hard core restrictions. The core never infers the view from `resources.length`.
