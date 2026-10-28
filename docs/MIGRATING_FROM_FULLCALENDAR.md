# Migrating from FullCalendar to `@lekoala/calendar`

This guide targets **`@lekoala/calendar` 0.3.x** and applications using **FullCalendar v6 or v7**. Examples use vanilla JavaScript; the same `<calendar-view>` element can be mounted from a framework, but this package does not provide a React/Vue/Angular adapter.

**This is not a drop-in replacement.** FullCalendar is a broad calendar platform with plugins and built-in application UI. `@lekoala/calendar` is a smaller, framework-agnostic Web Component focused on time grids, resource scheduling, and explicit integration seams. Migrate if its supported views and application-owned UI model fit your use case; keep FullCalendar if you depend on timeline, built-in recurrence, or other features listed below.

## 1. The smallest working replacement

### FullCalendar v7

FullCalendar v7 uses the **`fullcalendar`** package for vanilla JS, plus view/theme subpath imports. The `@fullcalendar/core` and `@fullcalendar/timegrid` imports found in older examples belong to **v6**.

```js
import { Calendar } from "fullcalendar";
import timeGridPlugin from "fullcalendar/timegrid";
import themePlugin from "fullcalendar/themes/classic";
import "fullcalendar/skeleton.css";
import "fullcalendar/themes/classic/theme.css";
import "fullcalendar/themes/classic/palette.css";

const fc = new Calendar(document.querySelector("#calendar"), {
  plugins: [themePlugin, timeGridPlugin],
  initialView: "timeGridWeek",
  initialDate: "2026-09-03",
  timeZone: "Europe/Brussels",
  events: [
    {
      id: "1",
      title: "Review",
      start: "2026-09-03T09:00:00+02:00",
      end: "2026-09-03T09:30:00+02:00",
    },
  ],
});
fc.render();
```

For **FullCalendar v6**, the equivalent imports are from `@fullcalendar/core`, `@fullcalendar/timegrid`, etc. The initialization pattern (`new Calendar(...)`, `render()`) is similar, but its CSS setup differs from v7. See the [official v6 → v7 guide](https://fullcalendar.io/docs/upgrading-from-v6-js) rather than mixing package generations.

### `@lekoala/calendar` 0.3

```bash
npm install @lekoala/calendar temporal-polyfill
```

```html
<calendar-view view="week" date="2026-09-03"></calendar-view>
```

```js
import "@lekoala/calendar/calendar.css";
import "@lekoala/calendar/define";

const calendar = document.querySelector("calendar-view");
calendar.configure({ timeZone: "Europe/Brussels" });
calendar.events = [
  {
    id: "1",
    title: "Review",
    start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
    end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
  },
];
```

**What changed:** there is no `new Calendar(...)`, plugin list, or `render()` call. The HTML element owns its lifecycle. Register it using `@lekoala/calendar/define` (or import `defineCalendarView` from the main entry and call it explicitly), set configuration with `configure()`, and pass data through properties. The main package import alone deliberately does **not** register the element.

> The calendar does not generate a header toolbar. Render your own buttons and navigation outside the element; see section 5.

## 2. Map views and options

### Views

| FullCalendar | `@lekoala/calendar` | Important difference |
| --- | --- | --- |
| `timeGridDay` | `day` | Solo timed view |
| `timeGridWeek` | `week` | Week anchored to `firstDay` |
| Custom N-day `timeGrid` | `day` + `configure({ dayCount: N })` | **Rolling** N visible days, not necessarily a calendar week |
| `resourceTimeGridDay` (Premium) | `resourceDay` | Resource columns, no FullCalendar Scheduler license/plugin |
| Custom 3-day resource time grid | `resourceThreeDays` | Resource × day columns |
| `resourceTimeGridWeek` | `resourceDay` + `dayCount: 7` *approximately* | Rolling window; not an exact week-anchored resource view |
| `dayGridMonth` | `month` | Multi-day events repeat as daily chips, not spanning bars |
| `listWeek` | `list` | Rolling seven-day list; not necessarily week-anchored |
| `dayGridWeek`, multi-month, timeline/Gantt | No direct view | Keep FullCalendar or build an application-specific representation |

The `week` and `month` views ignore `dayCount`. For rolling views (`day`, `threeDays`, `resourceDay`, `resourceThreeDays`, `list`), the count represents **visible days**, so `hiddenDays` can extend the underlying date range. Resource grids use resource → date column ordering; zero resources in a resource view produce an explicit empty state.

### Configuration

| FullCalendar option / API | `@lekoala/calendar` 0.3 |
| --- | --- |
| `initialView` / `changeView()` | `view` attribute / `setView(name)` |
| `initialDate` / `gotoDate()` | `date` attribute / `gotoDate(date)` |
| `prev()`, `next()`, `today()` | Same method names; navigation returns a reload promise |
| `headerToolbar`, `footerToolbar`, `customButtons` | Application-owned HTML |
| `timeZone` | `configure({ timeZone: "Europe/Brussels" })` — **default is `UTC`**, not FullCalendar's `local` |
| `locale` | `configure({ locale, labels })`; `labels` translates fixed UI strings |
| `firstDay`, `hiddenDays` | Same concepts through `configure()`; ISO weekdays 1–7, with `0` accepted for Sunday |
| `weekends: false` | `configure({ hiddenDays: [6, 7] })` |
| `slotMinTime`, `slotMaxTime` | `slot-min`, `slot-max` attributes; `24:00` is a valid exclusive end |
| `slotDuration` | `slot-duration` attribute (minutes) |
| `snapDuration` | `configure({ snapDuration: Temporal.Duration.from({ minutes: 15 }) })` |
| `slotLabelInterval` | `configure({ slotLabelInterval: 60 })` (minutes) |
| `scrollTime` / `scrollToTime()` | Call `scrollToTime("09:00")`; there is no auto `scrollTime` option |
| `dayMaxEvents` / `dayMaxEventRows` | `configure({ monthEventLimit: 3 })` for month chips |
| `editable` | `configure({ editable: true })` or per-event `editable`/`movable`/`resizable` |
| `eventAllow`, `selectAllow`, overlap/constraints | `configure({ interactionPolicy })`, using range context and application rules |
| `eventContent` | `configure({ eventContent })`; returns DOM Node, text, or `null` |
| `eventDidMount` / day DOM decoration | Hook `info.element` where available; otherwise `calendar:render` |
| `businessHours` | Build `backgrounds` and evaluate your own policy (not automatic) |

Be careful about naming: FullCalendar's `slotDuration` is a duration input (for example `"00:30:00"`); `<calendar-view slot-duration="30">` is a number of **minutes**. `slotLabelInterval` controls label density, not the grid's slot size.

## 3. Convert the event model before wiring the UI

FullCalendar accepts forgiving event input: it can infer `allDay`, accept an event without `end`, and parse date-time strings without an explicit named zone. `@lekoala/calendar` intentionally does **not**: every event must have `id`, `start`, and `end`, with a matching canonical type.

| FullCalendar input | Calendar 0.3 input |
| --- | --- |
| `start`/`end` as JS `Date` or a permissive ISO string | Timed: `Temporal.ZonedDateTime` or ISO **with offset and named IANA zone** |
| Date-only event, optionally inferred `allDay` | Explicit `allDay: true`, `YYYY-MM-DD`/`Temporal.PlainDate` bounds |
| `end` omitted | Provide an explicit exclusive `end` |
| `resourceId` | `resourceId` (stringified when normalized; `null` means unassigned) |
| v6 `classNames` / v7 `className` | `classNames: string[]` |
| `extendedProps` | `extendedProps` (opaque application metadata) |
| `display: "background"` | Separate `calendar.backgrounds` collection |
| Recurrence definition or `groupId`-coupled series | Expanded individual occurrences; preserve the series id in `extendedProps` if needed |

### Example: timed and all-day events

```js
// Timed: named zone is part of the canonical value.
const timed = {
  id: "visit-1",
  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
}

// All-day: civil dates, no midnight conversion.
const allDay = {
  id: "closure-1",
  allDay: true,
  start: "2026-09-03",
  end: "2026-09-06", // exclusive: the 3rd, 4th, and 5th
}
```

**Both libraries use an exclusive `end`** (`[start, end)`); do not subtract one day during migration. However, an all-day date is *not* a 24-hour zoned appointment: DST days can last 23 or 25 hours.

### Adapter for a typical FullCalendar-style JSON feed

For a feed with explicit offsets for timed events, date-only strings for all-day events, and a documented default duration, normalize at the API boundary:

```js
import { Temporal } from "temporal-polyfill";

const timeZone = "Europe/Brussels";
const defaultTimedMinutes = 30; // Choose your application's real default.

function zoned(input) {
  // A full Temporal zoned string is already suitable.
  if (typeof input === "string" && /\[[^\]]+\]$/.test(input)) return input;
  // An offset-bearing ISO string represents an instant; project into the
  // intended display zone. This deliberately rejects timezone-less strings.
  return Temporal.Instant.from(input).toZonedDateTimeISO(timeZone).toString();
}

function mapEvent(raw) {
  if (raw.id == null || raw.start == null) {
    throw new TypeError("Expected an event with id and start");
  }
  const allDay = raw.allDay ?? /^\d{4}-\d{2}-\d{2}$/.test(raw.start);
  const start = allDay ? raw.start : zoned(raw.start);
  const end = allDay
    ? (raw.end ?? Temporal.PlainDate.from(raw.start).add({ days: 1 }).toString())
    : (raw.end
        ? zoned(raw.end)
        : Temporal.ZonedDateTime.from(start)
            .add({ minutes: defaultTimedMinutes }).toString());
  const rawClasses = raw.classNames ?? raw.className ?? [];

  return {
    id: String(raw.id),
    title: raw.title ?? "",
    allDay,
    start,
    end,
    ...(raw.resourceId == null ? {} : { resourceId: String(raw.resourceId) }),
    classNames: Array.isArray(rawClasses) ? rawClasses : rawClasses.split(/\s+/).filter(Boolean),
    extendedProps: raw.extendedProps ?? {},
  };
}
```

This is **an example adapter**, not a general date parser. Offset-less local datetimes require an explicit resolution policy (including DST ambiguity); never silently append `Z` or guess the browser zone. If your backend already provides canonical named-zone strings, keep them unchanged. If an event uses `resourceIds: [...]` or a recurring group, define application semantics before flattening it into the single `resourceId` of Calendar 0.3.

## 4. Replace FullCalendar event sources

FullCalendar's `events` function receives `fetchInfo` with JS `Date` / string boundaries and uses `successCallback`/`failureCallback` (or a returned promise). `@lekoala/calendar` accepts an async function that **returns an array**, with abort and stale-response protection provided by the component.

```js
calendar.configure({
  timeZone: "Europe/Brussels",
  eventSource: async ({ start, end, resourceIds, signal }) => {
    // start/end: Temporal.PlainDate, end exclusive.
    const query = new URLSearchParams({
      start: start.toString(),
      end: end.toString(),
    });
    for (const id of resourceIds) query.append("resourceId", id);

    const response = await fetch(`/api/events?${query}`, { signal });
    if (!response.ok) throw new Error(`Loading failed: ${response.status}`);
    return (await response.json()).map(mapEvent);
  },
});

await calendar.refetchEvents(); // Configuring a source does not load it.
```

- A source's `start`/`end` are **civil `PlainDate` bounds**, not FullCalendar's zoned JS `Date` bounds. Adapt your endpoint query contract accordingly.
- `resourceIds: []` means **no filter**, not "load no resources". The array reflects selected resources even in solo views.
- Configure `backgroundSource` separately for background ranges. Its response replaces only backgrounds; `eventSource` owns only events.
- Use `calendar:loading`, `calendar:loaderror` and `aria-busy` for loading UI. Old requests are aborted and stale results ignored; a failed request keeps the previous valid state.
- An application that already has complete in-memory data can use `calendar.events = rows.map(mapEvent)` instead of a source.
- FullCalendar's multiple `eventSources`, source-specific colors, JSON feed URLs, built-in refetch strategy, and caches are **not** mirrored by a general source registry. Compose them in your adapter if needed.

## 5. Move the toolbar into your application

```html
<nav aria-label="Calendar navigation">
  <button id="previous" type="button">Previous</button>
  <button id="today" type="button">Today</button>
  <button id="next" type="button">Next</button>
  <button id="month" type="button">Month</button>
  <button id="week" type="button">Week</button>
</nav>
<calendar-view view="week"></calendar-view>
```

```js
const calendar = document.querySelector("calendar-view");
document.querySelector("#previous").addEventListener("click", () => void calendar.prev());
document.querySelector("#next").addEventListener("click", () => void calendar.next());
document.querySelector("#today").addEventListener("click", () => void calendar.today());
document.querySelector("#month").addEventListener("click", () => calendar.setView("month"));
document.querySelector("#week").addEventListener("click", () => calendar.setView("week"));

calendar.addEventListener("calendar:datechange", ({ detail }) => {
  // Update your toolbar title/mini-calendar from detail.date (PlainDate).
});
calendar.addEventListener("calendar:viewchange", ({ detail }) => {
  // Update the view switcher from detail.view.
});
```

`calendar:render` fires after the DOM subtree is in place; it is useful for presentation/decorating rendered columns. Unlike FullCalendar's `datesSet`, it also runs after data renders, so **do not** use it as an unconditional fetch or navigation trigger.

## 6. Replace callbacks with DOM events

| FullCalendar | Calendar 0.3 |
| --- | --- |
| `eventClick(info)` | `calendar:eventclick` — `event.detail.event` |
| `select(info)` / some `dateClick` flows | `calendar:select` — `detail.{ start, end, resourceId, allDay }` |
| `eventDrop(info)` | `calendar:eventmove` — `detail.{ event, previous, current, revert }` |
| `eventResize(info)` | `calendar:eventresize` — same optimistic mutation shape |
| `eventReceive` / external drop | `calendar:externaldrop` — application-owned payload and placement anchor |
| `loading(isLoading)` | `calendar:loading` — `detail.loading` |
| `datesSet` | `calendar:datechange`, `calendar:viewchange`, and/or `calendar:render` depending on intent |
| `moreLinkClick` | `calendar:moreclick` — application decides what to open |

Example: open an editor on click, propose a creation on selection, and persist a moved event.

```js
calendar.addEventListener("calendar:eventclick", ({ detail }) => {
  openEditor(detail.event); // Your application UI.
});

calendar.addEventListener("calendar:select", ({ detail }) => {
  openCreateForm({
    start: detail.start.toString(),
    end: detail.end.toString(),
    allDay: detail.allDay,
    resourceId: detail.resourceId,
  });
});

calendar.addEventListener("calendar:eventmove", async ({ detail }) => {
  try {
    const response = await fetch(`/api/events/${encodeURIComponent(detail.event.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: detail.current.start.toString(),
        end: detail.current.end.toString(),
        resourceId: detail.current.resourceId,
      }),
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    // Apply the server's canonical response if your API returns one.
  } catch (error) {
    detail.revert(); // Safe against superseding placement writes.
    showError(error);
  }
});
```

The same pattern applies to `calendar:eventresize`. Move and resize are **optimistic**: the calendar updates before dispatching the intent. A handler can call `preventDefault()` **synchronously** to reject immediately; `detail.revert()` may be called after asynchronous persistence fails. The calendar does not own retries, revisions, 409 conflicts, or realtime echo deduplication; see [SYNC_CONTRACT.md](SYNC_CONTRACT.md).

For `calendar:select`, there is no changed event and no `revert()`. **Time-grid selections are timed** (`Temporal.ZonedDateTime`); **month day selections are civil** (`Temporal.PlainDate`, `allDay: true`). Do not assume every selection has epoch milliseconds, and do not convert a month day into a fixed 24-hour period.

## 7. Map constraints and event overlap rules

FullCalendar offers `eventAllow`, `selectAllow`, `eventOverlap`, `selectOverlap`, `businessHours` and several constraints. Calendar 0.3 provides a single **synchronous** `interactionPolicy({ action, event, target, context, now })` gate for user-initiated select/move/resize/external interactions.

```js
calendar.configure({
  interactionPolicy({ action, event, target, context }) {
    if (action === "external") return true; // Add your own rule if needed.
    const busy = context.events.overlapping.some((other) => other.id !== event?.id);
    if (busy) return "This range overlaps another event";
    return true;
  },
});
```

`context.events.overlapping` contains the canonical events intersecting the **whole proposed range**, filtered to the target resource when one is selected. `context.backgrounds.overlapping` and `.covering` can support availability windows. The policy returns `true`, `false`, or a refusal reason string. It is called during pointer/keyboard gestures, including on release, but **not** by `addEvent()`, `updateEvent()`, `moveEvent()` or `resizeEvent()` invoked programmatically. Recheck authoritative rules on the server.

**Do not copy FullCalendar `eventOverlap: false` into a blanket assumption that the new core prevents collisions.** Calendar 0.3 renders overlaps; the application chooses which overlap rules to enforce.

## 8. Resources, backgrounds, and rendering

### Resources

```js
calendar.resources = [
  { id: "room-a", title: "Room A", groupId: "floor-1" },
  { id: "room-b", title: "Room B", groupId: "floor-1" },
];
calendar.resourceGroups = [{ id: "floor-1", title: "First floor" }];
calendar.setView("resourceDay");
```

Resource grouping is **one visual level**, not a tree. Each event belongs to one resource. In resource views, events without a matching `resourceId` are hidden rather than duplicated; global backgrounds without a `resourceId` apply across resources. `resourceDay` and `resourceThreeDays` have no Premium plugin or license requirement, but this does **not** imply feature parity with FullCalendar Scheduler.

### Backgrounds

FullCalendar background events (`display: "background"`, `businessHours`, blocking windows) should be mapped explicitly to `calendar.backgrounds` or `configure({ backgroundSource })`. Calendar 0.3 treats backgrounds as **visual geometry**, not built-in business rules. Month/list do not render background ranges. Check them in `interactionPolicy` or in your server if they should constrain interaction.

### Custom content and styling

```js
calendar.configure({
  eventContent({ event, element }) {
    element.dataset.kind = String(event.extendedProps.kind ?? "default");
    const title = document.createElement("strong");
    title.textContent = event.title ?? "";
    return title;
  },
});
```

This is a **Light DOM** component. Use your own CSS against `.calendar-view`, `.cv-event`, etc., and override tokens such as `--calendar-accent`, `--calendar-surface`, `--calendar-event-bg`, or `--calendar-column-min`. Content hooks return **text or DOM Nodes**, not HTML strings (strings are escaped as text). Unlike FullCalendar's richer render lifecycle, custom DOM decoration is usually owned by the hook's `element` or by `calendar:render`.

## 9. What does *not* migrate one-for-one

- **Recurring events / RRule / series editing:** expand occurrences in a service or adapter before passing them to the calendar; keep series metadata in `extendedProps`.
- **Timeline, Gantt, multi-month, custom view plugins, virtualized resource trees:** no equivalent in 0.3.
- **Built-in toolbar, date picker, popovers, event editor, week-number UI:** compose in the host application. `calendar:moreclick`, `calendar:eventclick`, and other intents help, but they do not instantiate application UI.
- **FullCalendar resource hierarchies, multi-resource event assignment and group-coupled dragging:** not supported as equivalent core behaviors. One-level `resourceGroups` are just headers.
- **All-day day-edge resize and timed ↔ all-day dragging:** day-edge resize is available from 0.4 (API, handles, keyboard); 0.3 returned `null`. Timed ↔ all-day dragging remains unimplemented. All-day drag and keyboard day moves **are** implemented.
- **Month/list dragging or selecting arbitrary multi-day spans:** no equivalent; month supports a single civil day selection and list is read-only.
- **Multiple event feeds and URL-based feed machinery:** aggregate in `eventSource` or application state.
- **View- and event-specific plugin callbacks, automatic calendar `eventChange` notifications:** use documented intents for user gestures and explicit mutation APIs for app/server updates. `updateEvent()` does not emit a FullCalendar-style `eventChange` event.
- **Automatic responsive view switching:** the host chooses views. Calendar 0.3 scrolls dense grids horizontally; it does not automatically hide columns/resources.

## 10. Migration checklist

1. **Inventory your FullCalendar features.** Confirm that every active view and plugin has a suitable replacement; treat unsupported features as explicit decisions.
2. **Replace the mount.** Install `@lekoala/calendar` + `temporal-polyfill`; register `<calendar-view>`, load its CSS, configure a named `timeZone`.
3. **Normalize your data at the boundary.** Require `id`, exclusive `end`, explicit `allDay`, and named-zone timed boundaries; split background ranges out.
4. **Move the application chrome out.** Rebuild the toolbar, popovers, search, forms, and filters around the element.
5. **Replace callback wiring.** Use namespaced DOM events; persist optimistic moves/resizes with the supplied `revert()`.
6. **Port constraints explicitly.** Use synchronous `interactionPolicy` for feedback and keep authoritative server validation.
7. **Test temporal and resource edge cases.** DST spring/fall, `24:00`, all-day inclusive-looking UI vs exclusive `end`, hidden weekdays, unassigned resource events, and multi-day slices.
8. **Test concurrency.** Rapid navigation during loading, stale responses, server 409 conflicts, realtime echoes while a drag is pending, and superseded `revert()`.
9. **Remove FullCalendar imports/styles only after the replacement works.** During an incremental migration, both libraries can coexist in separate mounts.

## Further reading

- [`@lekoala/calendar` API](API.md), [views](VIEWS.md), [interaction policy](INTERACTIONS.md), [async/realtime](DATA_AND_REALTIME.md), [sync contract](SYNC_CONTRACT.md), [integration boundaries](INTEGRATION.md).
- FullCalendar: [current docs (v7)](https://fullcalendar.io/docs), [v6 docs](https://legacy.fullcalendar.io/v6), [v6 → v7 JS migration](https://fullcalendar.io/docs/upgrading-from-v6-js), [event parsing](https://fullcalendar.io/docs/event-parsing), [eventDrop](https://fullcalendar.io/docs/eventDrop), [event source function](https://fullcalendar.io/docs/events-function), [resources/Premium](https://fullcalendar.io/docs/premium).

The goal is **migration clarity**, not a claim of one-to-one feature parity. `@lekoala/calendar` deliberately leaves persistence, permission semantics, recurrence, and application UI to the consumer.
