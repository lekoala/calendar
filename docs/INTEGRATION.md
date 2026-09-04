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

## Clipboard (cut/copy/paste)

Inter-week moves are an application-owned clipboard on top of core
primitives (use case 11 in [USE_CASES.md](USE_CASES.md#11-moving-an-event-outside-the-visible-window-cutcopypaste)).
The core owns no clipboard state. Recommended shape:

```js
let clipboard = null; // { mode: "cut" | "copy", id, durationMs } | null

// Cut: snapshot, do NOT remove yet — the event stays in place until paste.
clipboard = { mode: "cut", id: item.id, durationMs: endMs - startMs };

// Paste at an empty-slot intent (detail carries snapped date/time/resource):
const conflicts = calendar.getEventOverlaps({ start, end });
if (conflicts.length > 0) return refuse("Overlaps an existing booking");
calendar.moveEvent(clipboard.id, { start, end, resourceId }); // or addEvent() for copy
clipboard = null;
```

Robustness rules the showcase demonstrates:

- a cut event stays rendered until the paste commits, so `refetchEvents`,
  abort/stale guards and navigation cannot lose it; mark it visually through
  `eventContent` (`element.dataset.cut = "true"` + an application class) and
  a persistent banner, because the event node itself is recreated on every
  render while the banner is not;
- paste targets are proposed from `calendar:eventcontextmenu` on empty slots
  (which already carries the snapped date/time/resourceId), offering
  "Paste here (duration kept)" with `end = start + durationMs`, disabled with
  a reason when the policy refuses;
- `Esc` cancels, a new cut/copy replaces the clipboard, a failed paste keeps
  it, a successful paste clears it; `Ctrl+X/C/V` mirror the menu items where
  a paste target exists (empty slots are not tab stops, so `Ctrl+V` alone has
  no target — it reuses the last empty-slot intent or an explicit banner
  action).

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
