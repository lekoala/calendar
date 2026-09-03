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
  locale: "fr",
  labels: { more: "+{hidden} en plus", noEvents: "Aucun évènement" },
  snapDuration: Temporal.Duration.from({ minutes: 15 }),
  defaultTimedEventDuration: Temporal.Duration.from({ minutes: 30 }),
  monthEventLimit: 3,
  firstDay: 1,
  hiddenDays: [],
  slotLabelInterval: 60,
  eventSource,
  backgroundSource,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
  slotLabelContent,
  moreLinkContent,
});
```

`locale` is a BCP 47 tag for default presentation: day headers, axis labels
and the month weekday row render through `Intl`, and an explicit
`configure({ locale })` suggests `firstDay` when none is set (FullCalendar
parity: `en-US` weeks start Sunday, `fr` weeks Monday; an explicit `firstDay`
always wins). Resolution is `configure({ locale })`, then the `lang`
attribute, then the document language; blank means the runtime default.
Only the explicit option feeds date derivation: `lang`/document language
localize text, never temporal math, so which dates exist cannot shift with
the document. Content hooks stay authoritative:
`dayHeaderContent`, `slotLabelContent`, `eventContent` and `moreLinkContent`
replace the localized defaults wherever they return content.

`labels` overrides the fixed English strings merged over the defaults
(`noEvents`, `noResources`, `more` with a `{hidden}` placeholder,
`calendarRegion`, `untitledEvent`). There is no locale data bundle to load:
`Intl`/`Temporal` already carry CLDR, so translating the core is one
`configure({ labels })` call; fetching a translation file stays an
application concern.

`snapDuration` controls pointer snapping. `defaultTimedEventDuration` controls the hover preview and single-click creation proposal. An explicit drag selection carries its own `start/end` and does not depend on it. `monthEventLimit` caps the event chips per month day cell before the `+n more` button.

`firstDay` and `hiddenDays` use the ISO weekday numbering Temporal exposes, `1` = Monday through `7` = Sunday. `0` is accepted as an alias for Sunday, since that is what `Date.prototype.getDay` returns and the two conventions agree on every other day. `firstDay` sets where a civil week starts, for both week anchoring and month week derivation. `hiddenDays` lists weekdays that are never rendered; hiding all seven is ignored rather than rendering an empty calendar.

`slotLabelInterval` is the number of minutes between time axis labels. It is a density policy, not a format: what a label reads is `slotLabelContent`'s business.

Everything here is set through `configure()` rather than through attributes. Content hooks cannot be attributes at all, and keeping the options that drive date derivation in one place avoids an attribute-versus-property precedence rule. Serializable options may still gain attributes later.

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

All interaction events are `bubbles: true` and `composed: true`. Intents an application can refuse are also `cancelable: true`; observations (`calendar:loading`, `calendar:render`) are not.

Namespaced working names:

- `calendar:viewchange`
- `calendar:datechange`
- `calendar:loading`
- `calendar:loaderror`
- `calendar:render`
- `calendar:eventclick`
- `calendar:eventcontextmenu`
- `calendar:moreclick`
- `calendar:select`
- `calendar:eventmove`
- `calendar:eventresize`

`calendar:loading` brackets every async source run with `detail.loading`, alongside the `aria-busy` attribute the element already sets. Only the newest request settles the state, so an aborted or superseded run never reports `false` while a newer one is still in flight:

```js
calendar.addEventListener("calendar:loading", (event) => {
  spinner.hidden = !event.detail.loading;
});
```

`calendar:render` fires once the rendered subtree exists, with `detail: { view, dates, resources }`. It is the supported way to decorate rendered columns; listeners that mutate state simply queue the next frame, like any other mutation.

`calendar:moreclick` reports that a month day has more events than `monthEventLimit` allows, with `detail: { date, events, hidden, nativeEvent }`. The core only carries the intent: whether that opens a popover, switches to the day view, or raises the chip limit is an application decision. The `+n more` control is a real button, so pointer and keyboard activation behave alike, and it does not fall through to the day cell's `calendar:select`.

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

Hooks: `eventContent`, `dayHeaderContent`, `resourceHeaderContent`, `slotLabelContent`, `moreLinkContent`. Do not add further hooks before a use case requires them. Do not add `innerHTML`/`allowHtml` configuration.

`slotLabelContent({ time, minutes, element })` renders one time axis label; `time` is a `Temporal.PlainTime` and `minutes` its offset from midnight. `moreLinkContent({ date, events, hidden, element })` renders the month `+n more` button, where `events` is the day's full list and `hidden` the count that did not fit.

Every hook receives the `element` it fills, which is how an application attaches its own attributes, classes or listeners without a separate `didMount` hook and without a post-render pass:

```js
eventContent({ event, element }) {
  element.dataset.kind = event.extendedProps.kind;
  return event.title;
}
```

Applications that need to decorate something no hook owns — a whole day column, for instance — listen for `calendar:render` instead.
