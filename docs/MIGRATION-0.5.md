# Migrating 0.4 → 0.5

0.5 makes partial event renders first-class and tightens async-source scoping.
Two changes need an edit; the rest is additive.

## 1. Call `refetchEvents()` after a scope change outside navigation

Pending event and background requests are now invalidated when the configured
sources, the time zone, the effective range or the selected resource IDs
change. A stale response can no longer replace newer state, even when its
source ignores the `AbortSignal`. Navigation (`setView()`, `gotoDate()`,
`prev()`/`next()`) still reloads on its own. After `configure()`, assigning
`resources`, writing the `date`/`view` attributes or the time zone, load the
new scope explicitly:

```js
calendar.configure({ eventSource, timeZone: "Europe/Brussels" });
await calendar.refetchEvents();
```

A request in flight at that moment is discarded instead of landing. Awaiting
`refetchEvents()` or a navigation method settles on cancellation, so a source
that keeps running cannot leave the `await` pending.

`calendar:viewchange`, `calendar:datechange` and `calendar:loaderror` now
bubble and cross shadow boundaries (`composed: true`). Listeners inside the
calendar keep working; a listener on an outer boundary now also sees these
events, so check `event.target`/`composedPath()` when several calendars share
one handler.

## 2. Make `calendar:render` decorators idempotent

`calendar:render` now includes `detail.partial`: `true` when the view
reconciled its existing subtree (`updateEvent()` in time grids and month),
`false` for a full rebuild. Unchanged event nodes keep their DOM, custom
content and focus; the updated event gets a fresh node.

A decorator that appends a node on every render now duplicates it on each
update. Re-apply state instead:

```js
calendar.addEventListener("calendar:render", (event) => {
  for (const node of event.currentTarget.querySelectorAll(".cv-event")) {
    decorate(node); // must be safe to run twice on the same node
  }
});
```

Consequences to plan for:

- `eventContent` is not called again for unchanged events. Derived labels
  built inside it must be recomputed by the application (for example in the
  same render pass) instead of assumed fresh.
- Listeners attached directly to event nodes are lost when that event is
  rebuilt. Delegate from the calendar or the grid.
- `addEvent()`, `removeEvent()`, refetches, navigation, view changes and
  structural all-day changes still rebuild the subtree (`partial: false`).
- Unchanged nodes are no longer moved: an `updateEvent()` during a drag or
  resize on another event keeps pointer capture and the gesture's preview
  geometry. Updating the manipulated event still cancels its gesture without
  committing.

## 3. External all-day placement reports on the lane, not the column

For `addExternalDrop(el, payload, { allDay: true })`, the ghost stays in the
rendered all-day lane even while the pointer is over the timed grid, because
the drop is still civil. `.cv-external-lane-target` on a day column is now
only used when no lane is rendered, and then carries `cv-invalid` plus
`data-reason` for a refused target. Adjust CSS or DOM hooks that read the
column highlight as the primary feedback.

## 4. Behavior to re-check (no API change)

- Timed drops, selections and resizes resolve the slot at release in their
  original column and cancel when released outside the visible grid. A timed
  drop released outside dispatches `calendar:eventdropout`.
- All-day moves and resizes cancel on release outside the visible lane;
  resizes validate the target and policy at release.
- Sticky resource, group and day headers restack from rendered row heights
  when custom header content grows after render.
- Focus restoration and external pointer placement work inside a shadow root.
- The implicit anchor date follows a configured time zone; explicit dates
  stay pinned.
- Clipped all-day bars mark the cut side with a square corner and an inset
  chevron.
- The showcase follows Actual CSS 0.22.0. That is application-side and does
  not change the package API.

See [API](API.md) and [Data, async sources and realtime](DATA_AND_REALTIME.md).
