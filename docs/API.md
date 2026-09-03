# API draft

Everything in this document is **0.x draft**. The purpose is to make seams explicit before implementation.

## Registration

Main import has no custom-element registration side effect:

```js
import { CalendarViewElement, defineCalendarView } from "@lekoala/calendar";
```

Explicit side-effect entry:

```js
import "@lekoala/calendar/define";
```

Applications may subclass/register a different tag name.

## Element

Working default tag:

```html
<calendar-view view="week" date="2026-09-03"></calendar-view>
```

Simple serializable configuration may become attributes. Functions/structured behavior remain JS-only.

## View policy

`setView(view)` takes a single view name. `resources`, `date` and other state remain separate properties. The core never infers the view from `resources.length`.

A solo `timeGrid` with several resources and a `resourceTimeGrid` with one resource are both legitimate, even if an application rarely uses them. View switching preserves the anchor date, vertical scroll and reusable event data where defined. Horizontal scroll is intentionally not contractual: column counts differ between solo and resource grids, so the browser may clamp.

Column derivation follows the view:

```js
isResourceView(view)
  ? getResourceColumns(resources, dates)
  : getTimeGridColumns(dates)
```

A `resourceTimeGrid` with no resources renders an explicit empty state.

Resource views use grouped headers: `resourceHeaderContent({ resource, dates, element })` runs once per resource in a row spanning its date columns; `dayHeaderContent({ date, resource, element })` runs once per column.

## Event model

```js
{
  id: "event-1",
  title: "Event",
  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
  resourceId: "resource-a",
  editable: true,
  movable: true, // defaults to editable when undefined
  resizable: true, // defaults to editable when undefined
  classNames: [],
  extendedProps: {}
}
```

Resolution:

```text
event.movable ?? event.editable ?? calendar.editable
event.resizable ?? event.editable ?? calendar.editable
```

Internally the calendar uses Temporal only. At the boundary it accepts a `Temporal.ZonedDateTime` or an ISO string with offset/timezone, normalized toward `calendar.timeZone`. Events exposed to render hooks and DOM events carry `Temporal.ZonedDateTime` values.

## Resource model

```js
{
  id: "resource-a",
  title: "Resource A",
  selectable: true,
  droppable: true,
  classNames: [],
  extendedProps: {}
}
```

Potential future fields: `groupId`, `order`, rendering metadata. Avoid hierarchy API until a concrete workflow exists.

## Background model

```js
{
  id: "background-a",
  resourceId: "resource-a",
  start: "...",
  end: "...",
  classNames: [],
  extendedProps: {}
}
```

No built-in semantic type. A background without `resourceId` is global and applies to every resource column; an event without `resourceId` is hidden in resource views (see view policy).

## Configuration

```js
calendar.configure({
  timeZone: "Europe/Brussels",
  snapDuration: Temporal.Duration.from({ minutes: 15 }),
  defaultTimedEventDuration: Temporal.Duration.from({ minutes: 30 }),
  monthEventLimit: 3,
  eventSource,
  backgroundSource,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
});
```

`snapDuration` controls pointer snapping. `defaultTimedEventDuration` controls the hover preview and single-click creation proposal. An explicit drag selection carries its own `start/end` and does not depend on it. `monthEventLimit` caps the event chips per month day cell before a `+n more` indicator; no new render hooks are added for month/list — they reuse the frozen `eventContent` / `dayHeaderContent` hooks.

## Sources

```js
async function eventSource({ start, end, resourceIds, signal, calendar }) {
  return [];
}
```

`start/end` are Temporal values. `resourceIds` reflects the selected resources, not the renderer type:

```text
timeGrid + resource A -> ["resource-a"]
resourceTimeGrid A+B  -> ["resource-a", "resource-b"]
calendar without resources -> []
```

`[]` means no resource filter. Showing nothing when nothing is selected is an application policy, not encoded in this contract.

## Navigation

```js
calendar.setView("week")
calendar.gotoDate("2026-09-03")
calendar.getVisibleRange()
calendar.refetchEvents()
```

Planned:

```js
calendar.prev()
calendar.next()
calendar.today()
calendar.scrollToTime("10:00")
calendar.revealEvent("event-1")
```

## Mutations / realtime adapters

```js
calendar.getEventById(id)
calendar.addEvent(event)
calendar.updateEvent(event)
calendar.removeEvent(id)
calendar.batch(() => { ... })
```

Non-pointer equivalents of the drag and resize interactions. They run the same optimistic commit (event, `revert()`, synchronous `preventDefault()` handling) and return the optimistic event, or `null` when rejected immediately:

```js
calendar.moveEvent(id, { start, end, resourceId })
calendar.resizeEvent(id, { start, end })
```

The server/application remains source of truth. Applications may attach an opaque `extendedProps.revision` to reconcile optimistic updates with realtime echoes.

## DOM events

All interaction events are `bubbles: true`, `composed: true` and `cancelable: true`.

Namespaced working names:

- `calendar:viewchange`
- `calendar:datechange`
- `calendar:loaderror`
- `calendar:eventclick`
- `calendar:eventcontextmenu`
- `calendar:select`
- `calendar:eventmove`
- `calendar:eventresize`

`dispatchEvent()` is synchronous: `preventDefault()` must be called synchronously during dispatch. `detail.revert()` is idempotent and may be called later, after an `await`.

`calendar:eventmove` / `calendar:eventresize` are optimistic reversible mutations:

```js
detail: {
  event,
  previous: { start, end, resourceId },
  current: { start, end, resourceId },
  nativeEvent,
  revert,
}
```

```js
calendar.addEventListener("calendar:eventmove", async (event) => {
  try {
    await save(event.detail.current);
  } catch {
    event.detail.revert();
  }
});
```

Calling `preventDefault()` synchronously rejects the operation immediately; the core then reverts automatically.

`calendar:eventcontextmenu` carries a context intent from right-click or press-and-hold:

```js
detail: {
  event, // null on empty slots
  date,
  time, // slot-snapped wall time, empty slots only
  resourceId,
  clientX,
  clientY,
  nativeEvent,
}
```

The core never suppresses the native menu; the application calls `preventDefault()` on the native event when it handles the intent.

Keyboard operation follows the pointer contract: arrows move focus between events, `Shift` + arrows move the focused event (time/day, same resource), `Alt` + arrows resize it. Cross-resource moves stay a command operation (`moveEvent` with `resourceId`). Committed key operations refocus the event and announce `title, date, start to end` through a polite live region; view/date changes announce `view, date` the same way.

`calendar:select` is an intention with no mutated event, so it carries no `revert()`:

```js
detail: {
  start,
  end,
  resourceId,
  nativeEvent,
}
```

## Renderers

Hooks return `Node | string | null`. Hook output is appended inside a core-owned accessible wrapper (for example a focusable event button), so custom content never removes the accessible name or activation behavior. Strings are treated as text.

```js
eventContent({ event, date, resource, element }) {
  const node = document.createElement("span");
  node.textContent = event.title;
  return node;
}
```

Frozen hooks: `eventContent`, `dayHeaderContent`, `resourceHeaderContent`. Do not add further hooks before a use case requires them. Do not add `innerHTML`/`allowHtml` configuration.
