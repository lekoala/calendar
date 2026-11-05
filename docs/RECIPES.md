# Integration recipes

Short, copyable adapters for data shapes the core deliberately does not parse,
and for application chrome it deliberately does not own. The calendar
consumes canonical `Temporal` values and concrete event occurrences;
everything below belongs to the application or its server.

These recipes are examples, not a general date parser. If your backend already
returns canonical named-zone strings and explicit ranges, keep them unchanged.

## 1. UTC instants to Temporal

Use this when an API returns offset-bearing ISO strings or UTC instants, and
date-only strings for all-day records.

```js
import { Temporal } from "temporal-polyfill";

const timeZone = "Europe/Brussels";

function timedBound(value) {
  if (value instanceof Temporal.ZonedDateTime) return value;
  // A named-zone string is already canonical; keep it untouched.
  if (typeof value === "string" && /\[[^\]]+\]$/.test(value)) return value;
  // An offset-bearing string represents an instant. Project it into the
  // display zone instead of guessing a wall time.
  return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toString();
}

function mapEvent(raw) {
  if (raw.id == null || raw.start == null) {
    throw new TypeError("Expected an event with id and start");
  }
  const allDay = raw.allDay ?? /^\d{4}-\d{2}-\d{2}$/.test(raw.start);
  const start = allDay ? String(raw.start) : timedBound(raw.start);
  const end = allDay
    ? String(raw.end ?? Temporal.PlainDate.from(raw.start).add({ days: 1 }))
    : raw.end
      ? timedBound(raw.end)
      : Temporal.ZonedDateTime.from(start).add({ minutes: 30 }).toString();

  return {
    id: String(raw.id),
    title: raw.title ?? "",
    allDay,
    start,
    end,
    ...(raw.resourceId == null ? {} : { resourceId: String(raw.resourceId) }),
    classNames: Array.isArray(raw.classNames)
      ? raw.classNames
      : String(raw.classNames ?? "").split(/\s+/).filter(Boolean),
    extendedProps: raw.extendedProps ?? {},
  };
}
```

Contract points:

- `Temporal.Instant.from()` requires an offset or `Z`. An offset-less local
  datetime is **not** accepted: decide an explicit policy (server zone,
  application zone, or reject) rather than silently appending `Z`.
- Canonical timed boundaries need a named IANA zone, e.g.
  `2026-09-03T09:00:00+02:00[Europe/Brussels]`.
- Date-only input is civil. It maps to `allDay: true` and
  `Temporal.PlainDate`, never to a 24-hour instant.
- An all-day range is half-open and must cover at least one day:
  `2026-09-03` to `2026-09-04` is one day.

## 2. Several feeds in one `eventSource`

The core has one `eventSource` and one `backgroundSource`. Compose multiple
feeds in the source function; do not mirror a source registry.

```js
const feeds = [
  async ({ start, end, resourceIds, signal }) => {
    const query = new URLSearchParams({ start: String(start), end: String(end) });
    for (const id of resourceIds) query.append("resourceId", id);
    const response = await fetch(`/api/events?${query}`, { signal });
    if (!response.ok) throw new Error(`events: ${response.status}`);
    return (await response.json()).map(mapEvent);
  },
  async ({ start, end, signal }) => {
    const response = await fetch(
      `/api/closures?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { signal },
    );
    if (!response.ok) throw new Error(`closures: ${response.status}`);
    return (await response.json()).map(mapEvent);
  },
];

calendar.configure({
  eventSource: async (query) => {
    const batches = await Promise.all(feeds.map((feed) => feed(query)));
    const byId = new Map();
    for (const event of batches.flat()) byId.set(event.id, event);
    return [...byId.values()];
  },
});

await calendar.refetchEvents();
```

Contract points:

- Pass `signal` to every request. The calendar already aborts obsolete
  requests and rejects stale completions; your adapter must not defeat that.
- `resourceIds: []` means **no resource filter**, not "load nothing".
- Namespace or validate ids. One feed overwriting another feed's id is an
  application bug, not a calendar feature.
- Decide partial-failure behavior explicitly. `Promise.all` fails the whole
  load and keeps the previous valid state; `Promise.allSettled` can merge the
  successes and report the failures separately.
- `configure({ eventSource })` does **not** load data. Call
  `refetchEvents()` (or navigate) to start it.

## 3. RRULE and iCalendar occurrences

Recurrence expansion is outside the core by design. Expand concrete
occurrences for the requested range, then hand them to the calendar.

```js
async function expandSeries(series, start, end) {
  // Server-side or adapter-side expansion with your recurrence library.
  const occurrences = await recurrenceLibrary.expand(series, { start, end });
  return occurrences.map((occurrence) => ({
    id: occurrence.id,
    title: series.title,
    allDay: occurrence.allDay,
    start: occurrence.start, // PlainDate or zoned string
    end: occurrence.end,     // exclusive
    resourceId: occurrence.resourceId ?? series.resourceId,
    extendedProps: {
      seriesId: series.id,
      occurrenceId: occurrence.id,
      ...occurrence.extendedProps,
    },
  }));
}

calendar.configure({
  eventSource: async ({ start, end, resourceIds, signal }) => {
    const rows = await fetchSeries({ start, end, resourceIds, signal });
    const expanded = await Promise.all(rows.map((row) => expandSeries(row, start, end)));
    return expanded.flat();
  },
});
```

Contract points:

- Pass **occurrences**, not recurrence rules. Each occurrence has its own
  canonical `start`/`end` and a stable `id`.
- Expand for the visible range. The calendar will not expand a series that
  starts before or ends after the request.
- Keep the series identity in `extendedProps` so an occurrence click can open
  the series editor or scope an exception.
- Apply cancellations, overrides and timezone rules before the calendar sees
  the occurrence.
- `end` stays exclusive. An all-day occurrence still needs at least one day.

## 4. One endpoint for events and backgrounds

Some backends return both collections in one response
(`{ events, backgrounds }`). Keep the two sources and let them share one
request. Key it by `signal`: during one `refetchEvents()` both sources receive
the same `AbortSignal`, and every refetch creates a new one.

```js
const requests = new WeakMap();

function loadSchedule({ start, end, resourceIds, signal }) {
  let request = requests.get(signal);
  if (!request) {
    request = fetchSchedule({ start, end, resourceIds, signal });
    requests.set(signal, request);
  }
  return request;
}

async function fetchSchedule({ start, end, resourceIds, signal }) {
  const query = new URLSearchParams({ start: String(start), end: String(end) });
  for (const id of resourceIds) query.append("resourceId", id);
  const response = await fetch(`/api/schedule?${query}`, { signal });
  if (!response.ok) throw new Error(`schedule: ${response.status}`);
  return response.json();
}

calendar.configure({
  eventSource: async (query) => (await loadSchedule(query)).events.map(mapEvent),
  backgroundSource: async (query) => (await loadSchedule(query)).backgrounds.map(mapBackground),
});

await calendar.refetchEvents();
```

Contract points:

- Key by `signal`, not by the query object or a `start|end` string. The
  query object is not guaranteed to be shared, and a string key would join a
  new refetch to an aborted request for the same range.
- The `WeakMap` needs no cleanup: the entry goes away with its signal.
- Aborting the shared request is safe because both sources are aborted
  together.
- Each collection is still replaced only by its own source. If the shared
  request fails, both sources reject, the refetch publishes neither
  collection, and one `calendar:loaderror` is dispatched.

## 5. Wire an external toolbar

Toolbars are application chrome. The calendar exposes what one needs:
`prev()`, `next()`, `today()`, `setView()`, `view`, `getVisibleRange()` and
the `calendar:render` event.

```html
<nav class="toolbar">
  <button type="button" data-nav="prev" aria-label="Previous">‹</button>
  <button type="button" data-nav="today">Today</button>
  <button type="button" data-nav="next" aria-label="Next">›</button>
  <span class="toolbar-label" aria-live="polite"></span>
  <button type="button" data-view="week">Week</button>
  <button type="button" data-view="list">List</button>
</nav>
```

```js
const toolbar = document.querySelector(".toolbar");
const label = toolbar.querySelector(".toolbar-label");

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.nav) calendar[button.dataset.nav]();
  if (button.dataset.view) calendar.setView(button.dataset.view);
});

// Civil dates formatted at UTC midnight with a UTC formatter. This UTC is a
// formatting convention that keeps the civil day, not the events' time zone.
const toDate = (date) => new Date(`${date}T00:00:00Z`);
const formatter = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

calendar.addEventListener("calendar:render", () => {
  const { start, end } = calendar.getVisibleRange();
  label.textContent = formatter.formatRange(toDate(start), toDate(end.subtract({ days: 1 })));
  for (const button of toolbar.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === calendar.view));
  }
});
```

Contract points:

- `getVisibleRange().end` is exclusive: subtract one day for the label.
- Sync on `calendar:render`, not on the click. It also covers navigation and
  view changes made from code, and option changes (`dayCount`, `hiddenDays`)
  that change the range without moving the anchor.
- `formatRange()` merges the shared month and year the way the locale
  expects (in `en-GB`: `3–9 Nov 2026`, `28 Oct – 3 Nov 2026`), and collapses to one date
  when both ends are the same day.
- `aria-pressed` suits plain toggle buttons. Inside a `role="menu"`, use
  `role="menuitemradio"` with `aria-checked` instead, not both.
- To keep `?date=&view=` in the URL, write it with `history.replaceState()`
  on `calendar:datechange` and `calendar:viewchange`.

## 6. Drive the calendar from a `<date-calendar>`

A mini month (for example `<date-calendar>` from `@lekoala/date-picker`) is a
composition peer: it owns its grid and keyboard focus, the calendar owns the
agenda, and the application connects them.

```html
<date-calendar id="mini" selection="none" first-day="1"></date-calendar>
```

```js
const FIRST_DAY = 1; // Monday, the same value for both components
calendar.configure({ firstDay: FIRST_DAY });

// A click on a day is navigation, not a selection.
mini.addEventListener("dateactivate", (event) => {
  calendar.gotoDate(event.detail.date);
});

let lastAnchor = "";
calendar.addEventListener("calendar:render", () => {
  const anchor = calendar.date.toString();
  // Only follow the anchor when it actually moved: the user can browse the
  // mini month freely, and an unrelated render must not pull it back.
  if (anchor === lastAnchor) return;
  lastAnchor = anchor;
  mini.focusedDate = anchor;
});
```

Contract points:

- `selection="none"`: activating a day moves the agenda and the mini month
  never holds a value.
- Assigning `focusedDate` does not steal focus from the agenda.
- Derive `first-day` and `firstDay` from one application setting. The
  calendar does not push its options to other components. It numbers
  weekdays ISO-style (`1` = Monday … `7` = Sunday, `0` accepted for Sunday);
  check the numbering the mini month documents before sharing a raw value.
- `calendar:render` with the anchor guard covers every way the anchor moves,
  including `gotoDate()` from code and `prev()`/`next()`.

## Further reading

- [API](API.md)
- [Views and all-day rules](VIEWS.md)
- [Async sources and realtime](DATA_AND_REALTIME.md)
- [Integration boundaries](INTEGRATION.md)
- [FullCalendar migration guide](MIGRATING_FROM_FULLCALENDAR.md)
