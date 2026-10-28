# Integration recipes

Short, copyable adapters for data shapes the core deliberately does not parse.
The calendar consumes canonical `Temporal` values and concrete event
occurrences; everything below belongs to the application or its server.

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

## Further reading

- [API](API.md)
- [Views and all-day rules](VIEWS.md)
- [Async sources and realtime](DATA_AND_REALTIME.md)
- [Integration boundaries](INTEGRATION.md)
- [FullCalendar migration guide](MIGRATING_FROM_FULLCALENDAR.md)
