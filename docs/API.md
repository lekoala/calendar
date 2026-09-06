# API

The seams below are implemented and covered by the test suites. Anything
still unstable is additive: a 0.x minor may add options, not silently
change existing behaviour.

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

Every flag is optional, and normalization never fills one in: an event that
omits `editable` stays undecided so `configure({ editable: false })` reaches
it. A read-only calendar is therefore a single call, and an event that opts
back in with `editable: true` still outranks it.

Internally the calendar uses Temporal only. A timed event takes a
`Temporal.ZonedDateTime` or an ISO string with offset/timezone, normalized
toward `calendar.timeZone`; events exposed to render hooks and DOM events
carry `Temporal.ZonedDateTime` values.

An all-day event carries `allDay: true`, explicit (never auto-detected), and
rides **civil dates** instead of instants:

```js
{
  id: "closure-1",
  title: "Atrium closure",
  allDay: true,
  start: "2026-09-03",   // Temporal.PlainDate, or a YYYY-MM-DD string
  end: "2026-09-06",     // exclusive, same [start, end) contract as timed
  resourceId: "resource-a",
}
```

The two boundary types are strict: `allDay: true` accepts only civil input,
`allDay: false`/absent only zoned input, and a mismatch throws. In canonical
state, `calendar.events` items and `getEventById(id)` return a
`Temporal.PlainDate` for all-day `start`/`end`, so a consumer can tell the
two apart by type instead of by flag. Projecting both to their local
midnights in `calendar.timeZone` is what makes an all-day range comparable
to timed events (`getEventOverlaps`), and two consecutive civil midnights
span the real 23-/25-hour DST day without the civil day changing meaning.

All-day scope in the time grid is the **lane**: see config `allDaySlot` and
VIEWS. Resizing an all-day event is not wired in v0.x —
`resizeEvent(id, ...)` returns `null` for it (day-edge resize is deferred).
Month and list render all-day events as their civil-day chips/rows already;
`allDaySlot: false` hides them from time grids only.

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
  allDay: false,          // optional; all-day backgrounds take PlainDate dates
  classNames: [],
  extendedProps: {}
}
```

No built-in semantic type. A background without `resourceId` is global and applies to every resource column; an event without `resourceId` is hidden in resource views (see view policy). An `allDay` background ("the room is closed this week") uses the same civil boundary types as all-day events and paints the full-height lane tint in time grids.

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
  allDaySlot: true,
  eventSource,
  backgroundSource,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
  slotLabelContent,
  moreLinkContent,
  interactionPolicy,
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
`calendarRegion`, `untitledEvent`, `allDaySlotLabel`). There is no locale data bundle to load:
`Intl`/`Temporal` already carry CLDR, so translating the core is one
`configure({ labels })` call; fetching a translation file stays an
application concern.

`snapDuration` controls pointer snapping. `defaultTimedEventDuration` controls the hover preview and single-click creation proposal. An explicit drag selection carries its own `start/end` and does not depend on it. `monthEventLimit` caps the event chips per month day cell before the `+n more` button.

`firstDay` and `hiddenDays` use the ISO weekday numbering Temporal exposes, `1` = Monday through `7` = Sunday. `0` is accepted as an alias for Sunday, since that is what `Date.prototype.getDay` returns and the two conventions agree on every other day. `firstDay` sets where a civil week starts, for both week anchoring and month week derivation. `hiddenDays` lists weekdays that are never rendered; hiding all seven is ignored rather than rendering an empty calendar.

`slotLabelInterval` is the number of minutes between time axis labels. It is a density policy, not a format: what a label reads is `slotLabelContent`'s business.

`allDaySlot` controls the all-day lane in time grids. It defaults to `true`, and the lane renders only when an all-day event or background is visible in the current range (an empty lane takes no space). `false` hides all-day events/backgrounds from time grids deliberately; month and list remain date-driven and keep showing them.

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

`eventSource` and `backgroundSource` are independent: `refetchEvents()` runs
both, and each one replaces only the collection it owns. Configuring a single
source leaves the other collection alone, so `addEvent()`, `updateEvent()`,
`removeEvent()` and the `backgrounds` setter applied while a request is in
flight survive its resolution. Obsolete requests abort, and a stale
completion never overwrites newer state.

## Navigation

Without a `date` attribute, the element anchors on today's date (`Temporal.Now.plainDateISO`) in the configured time zone.

```js
calendar.setView("week")
calendar.gotoDate("2026-09-03")
calendar.getVisibleRange()
calendar.refetchEvents()
calendar.prev()
calendar.next()
calendar.today()
calendar.scrollToTime("10:00")
```

Planned (Milestone 14):

```js
calendar.revealEvent("event-1")
```

## Civil date helpers

External navigators (mini-calendars, custom headers) reuse the same civil
derivation as the grid instead of hand-rolling month math. One object with
two access paths to the same reference:

```js
// ESM consumers import the helpers object.
import { dates } from "@lekoala/calendar";

// Classic-script consumers (e.g. over file://) reach the exact same object
// through the registered element class.
const { dates } = customElements.get("calendar-view");
```

- `dates.getMonthWeeks(date, { firstDay, hiddenDays })` — the true civil
  weeks of the anchor month: full 7-day rows from `firstDay`, 4 to 6 rows
  depending on the month, never padded. Fixed-height grids are a
  presentation choice and pad on the consumer side. Rows stay rectangular
  only without hidden days.
- `dates.startOfWeek(date, firstDay)` — first civil day of the containing
  week.
- `dates.toPlainDate(value)` — accepts `Temporal.PlainDate` or ISO strings.

## Overlap queries

```js
const hits = calendar.getEventOverlaps(
  { start, end },
  { resourceIds = [], includeBackgrounds = false, filter } = {},
);
```

`start`/`end` are `Temporal.ZonedDateTime` values or ISO strings, compared by
absolute instant over half-open `[start, end)` ranges; an empty or inverted
range yields `[]`. Civil boundaries (`Temporal.PlainDate` or `YYYY-MM-DD`
strings) are accepted too and project to their local midnights in the
calendar time zone, which is how an all-day event and a timed booking on the
same day meet:

```js
// Every all-day/weekend blocker touching the civil day.
const hits = calendar.getEventOverlaps({ start: "2026-09-03", end: "2026-09-04" });
```

`resourceIds = []` means no resource filter; a non-empty
list keeps only entries belonging to those resources, except resource-less
backgrounds, which are global context and match any list. Results follow
paint order (events in state order, then backgrounds in state order).
`filter(entry)` narrows further without the application reading class arrays
itself: `entry = { kind: "event" | "background", event?, background? }`.

```js
// "Is there an unavailability here?" without touching classNames:
const blocked = calendar.getEventOverlaps(
  { start, end },
  {
    resourceIds: [resourceId],
    includeBackgrounds: true,
    filter: ({ kind, background }) => kind === "background" && background.classNames.includes("sc-blocked"),
  },
);
```

Overlapping simultaneous events are an application policy, not a core
option: the core always lays out simultaneous events side by side (see
`layoutEvents`), and the application allows, refuses or caps overlaps by
combining `getEventOverlaps` with synchronous `preventDefault()` on
`calendar:select` / `calendar:eventmove` / `calendar:eventresize`.

## Range context

```js
const context = calendar.getRangeContext({ start, end, resourceId });
```

The single definition of "context" in the core: what a `{ start, end }`
range touches, over canonical state.

```js
{
  events: { overlapping: [...] },
  backgrounds: { overlapping: [...], covering: [...] },
}
```

`overlapping` is a plain intersection by absolute instant over half-open
`[start, end)` ranges; `covering` backgrounds fully wrap the range. Bounds
accept the same values as the overlap queries (zoned, ISO, civil). A
nullish `resourceId` means no filter; otherwise only entries of that
resource are kept, except resource-less backgrounds, which are global
context. Geometry only: when several backgrounds cover the same range, the
core never picks one — priority stays application-side.

Interaction intents attach snapshots produced by this primitive to their
`detail.context`: `calendar:select`, `calendar:eventmove`,
`calendar:eventresize` and `calendar:externaldrop`. For move/resize the
snapshot describes canonical state at dispatch time, which is the
optimistic post-mutation state — so the mutated event may appear in
`context.events.overlapping`. For `externaldrop` the context covers the
range the ghost previewed and validated: `[time, time + duration)` for
timed drops, the civil day for lane drops.

## Interaction policy

```js
calendar.configure({
  interactionPolicy({ action, event, target, context, now }) {
    if (target.end <= now) return "Past";
    return true;
  },
});
```

Policy applies to every user-originated calendar interaction, regardless
of input modality: pointer drag/resize/select, keyboard move/resize,
external drops and selection. Programmatic mutation APIs
(`moveEvent`/`resizeEvent`/`addEvent`/`updateEvent`/`removeEvent`) remain
authoritative and never consult the policy — realtime and server paths
stay unblocked, and application-owned menus (delete, cancel) enforce
their own permissions.

- `action` is `select`, `move`, `resize` or `external`. `select` and
  `external` carry no existing event (`event: null`); `external`
  describes the placement interaction without pretending to know what
  the opaque payload means.
- `event` is the acted-on event, or `null`.
- `target` is the proposed placement: `{ start, end, date, time,
  resourceId, allDay }`. `start`/`end` are the full proposed range
  (zoned for timed, civil for all-day); `time` is the proposed start as
  an instant, `null` for all-day.
- `context` is the canonical range context of the proposed range (see
  above); `now` is the moment the decision is taken.
- Return `true` (or nothing) to allow, `false` to refuse quietly, or a
  reason string to refuse with feedback. Strictly synchronous: server
  validation stays in the commit/revert path.

The policy gates before a gesture (no resize handle, no drag or
selection start — a refused keyboard operation announces its reason when
it has one) and re-validates the destination only when the snapped
target changes, painting the existing invalid ghost and `data-reason`.
A refused drop commits nothing and dispatches nothing. For external
drops the chain is structural validity, then the global policy, then the
source-specific `validate` — the first refusal wins. Without a
configured policy nothing changes.

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

## External placement (drag from application-owned sources)

An application can turn any element into a drag source whose drop the
calendar resolves to a grid/lane anchor (USE_CASES §12 — dragging a sidebar
workbench item onto the grid):

```js
calendar.addExternalDrop(el, payload, {
  duration,   // preview length in minutes (timed slots)
  allDay,     // force the all-day lane
  title,      // preview label
  validate,   // (target) => boolean | reason-string | null
});
calendar.removeExternalDrop(el);
```

Rules:

- `payload` is opaque: the calendar never reads it, only carries it through
  `calendar:externaldrop`;
- while dragging over the grid the core draws a ghost with the real
  duration and marks it `cv-invalid` (+ `data-reason`) when the target is
  structurally refused (out of the grid, outside `slotMin`/`slotMax`,
  `droppable: false`) or refused by the application's `validate`;
- the core never computes overlaps for you: `validate` runs on your
  calendar's own state via `calendar.getEventOverlaps(target)`;
- the drop dispatches `calendar:externaldrop` with only the anchor; a
  non-validatable target suppresses the drop silently;
- the drop is HTML5-DnD only, so touch/keyboard use the paste path installed
  by the application (e.g. the move workbench pastes the armed item).

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
- `calendar:externaldrop`

`calendar:externaldrop` is the placement intent of an application-owned drag
source (external placement, see below): `cancelable`, `bubbles`, `composed`.

```js
detail: {
  payload,              // opaque to the calendar
  date,                 // winner civil date (PlainDate)
  time,                 // ZonedDateTime when timed; absent for all-day
  resourceId,           // target resource, or null
  allDay,               // true when dropped on the all-day lane
  context,              // range context of the previewed range (see above)
  nativeEvent,
}
```

The core delivers the anchor and never interprets `payload`; the application
decides what "place this here" means (create, move, batch offset…) through
its own `getEventOverlaps()`/`moveEvent()` path. `preventDefault()` on the
dispatch signals "refused", though a busy application may equally ignore
targets before reading them.

`calendar:loading` brackets every async source run with `detail.loading`, alongside the `aria-busy` attribute the element already sets. Only the newest request settles the state, so an aborted or superseded run never reports `false` while a newer one is still in flight:

```js
calendar.addEventListener("calendar:loading", (event) => {
  spinner.hidden = !event.detail.loading;
});
```

`calendar:render` fires once the rendered subtree exists, with `detail: { view, dates, resources }`. It is the supported way to decorate rendered columns; listeners that mutate state simply queue the next frame, like any other mutation.

`calendar:moreclick` reports that a month day has more events than `monthEventLimit` allows, with `detail: { date, events, hidden, nativeEvent }`. The core only carries the intent: whether that opens a popover, switches to the day view, or raises the chip limit is an application decision. The `+n more` control is a real button, so pointer and keyboard activation behave alike, and it does not fall through to the day cell's `calendar:select`.

`dispatchEvent()` is synchronous: `preventDefault()` must be called synchronously during dispatch. `detail.revert()` is idempotent and may be called later, after an `await`.

A deferred `revert()` addresses its event by id and only undoes the placement
it applied. Once that placement is gone — the event was removed, or a newer
move or resize superseded it — the call is a no-op instead of resurrecting
stale state or landing on another event.

`calendar:eventmove` / `calendar:eventresize` are optimistic reversible mutations:

```js
detail: {
  event,
  previous: { start, end, resourceId },
  current: { start, end, resourceId },
  context,              // post-commit snapshot: the event may overlap itself
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
  context,              // range context of the selected range (see above)
  nativeEvent,
}
```

## Renderers

Hooks return `Node | string | null`. Hook output is appended inside a core-owned accessible wrapper (for example a focusable event button), so custom content never removes the accessible name or activation behavior. Strings are treated as text.

```js
eventContent({ event, date, resource, temporalState, element }) {
  const node = document.createElement("span");
  node.textContent = event.title;
  return node;
}
```

Hooks: `eventContent`, `dayHeaderContent`, `resourceHeaderContent`, `slotLabelContent`, `moreLinkContent`. Do not add further hooks before a use case requires them. Do not add `innerHTML`/`allowHtml` configuration.

Every rendered event node carries `data-temporal-state="past|current|future"`, derived from its canonical range against the render's `now` (`end <= now` is past, `start <= now < end` is current). `eventContent` receives the same value as `info.temporalState`. The fact ages live without refetch: the render arms a single one-shot timer to the next visible start/end boundary, which triggers the next render. The core never derives `editable`/`movable`/`resizable` from it; policy stays application-side. Style the fact from the application with plain attribute selectors (`[data-temporal-state="past"]`); the core ships no temporal styling.

`slotLabelContent({ time, minutes, element })` renders one time axis label; `time` is a `Temporal.PlainTime` and `minutes` its offset from midnight. `moreLinkContent({ date, events, hidden, element })` renders the month `+n more` button, where `events` is the day's full list and `hidden` the count that did not fit.

Every hook receives the `element` it fills, which is how an application attaches its own attributes, classes or listeners without a separate `didMount` hook and without a post-render pass:

```js
eventContent({ event, element }) {
  element.dataset.kind = event.extendedProps.kind;
  return event.title;
}
```

Applications that need to decorate something no hook owns — a whole day column, for instance — listen for `calendar:render` instead.
