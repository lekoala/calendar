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

## Realtime

```js
transport.on("created", (payload) => calendar.addEvent(mapEvent(payload)));
transport.on("updated", (payload) => calendar.updateEvent(mapEvent(payload)));
transport.on("deleted", ({ id }) => calendar.removeEvent(id));
```

The core never knows the transport exists.

## View policy

The application can decide defaults such as:

- one resource → solo `timeGrid`;
- 2–3 resources → `resourceThreeDays` when useful;
- many resources → `resourceDay` / filtered selection;
- month/list → alternate representation.

These are application UX policies, not hard core restrictions. The core never infers the view from `resources.length`.
