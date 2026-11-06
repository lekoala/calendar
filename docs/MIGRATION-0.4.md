# Migrating 0.3 → 0.4

0.4 completes existing interactions and integration recipes without adding
views. Two behavior changes matter to existing consumers.

## 1. All-day ranges must contain at least one civil day

All-day events and backgrounds use half-open civil ranges: `start` is
included and `end` is excluded. `end === start` is now rejected, like an
inverted range. Normalization throws; invalid `moveEvent()` / `resizeEvent()`
proposals return `null` without publishing optimistic state.

For a one-day event, supply the following civil date as `end`:

```js
calendar.events = [
  { id: "event-1", title: "Event", allDay: true,
    start: "2026-11-06", end: "2026-11-07" },
];
```

Remove empty all-day placeholders or give them a real civil range before
assigning data or returning source results. Timed zero-length ranges keep
their existing contract. Hidden weekdays still count in the civil span.

## 2. List groups order all-day rows first

Each civil day lists all-day rows before timed rows. Timed rows sort by the
start of their portion of that day: a continuing event sorts at midnight,
after the all-day rows. Update any assumptions about DOM or reading order.

## 3. Added behavior and optional configuration

- All-day events support `resizeEvent()` with civil boundaries, pointer
  handles on visible true edges in solo/resource time grids, and `Alt`+arrow
  keyboard resizing. The minimum is one civil day. Existing editability and
  interaction policy gates apply to user gestures; programmatic resizing
  remains policy-free. `calendar:eventresize` retains its `revert()` contract.
- External renders preserve scroll and focused event segments without
  stealing application focus. A render during a pointer gesture cancels it
  without committing a move or resize.
- Current-time markers update every minute, including across civil midnight,
  without replacing event nodes or refetching sources; disconnect stops timers.
- `monthEventOrder(a, b)` optionally changes month chip order, Tab order and
  the more-button payload. Other views and canonical event order are unchanged.
- `listBackgrounds` optionally adds inert background rows to list groups.
  It defaults to `false`; use `true` or a predicate, and optionally
  `backgroundContent` for row content. This does not enable interaction or
  change background rendering in other views.

See [API](API.md), [framework examples](FRAMEWORKS.md), and
[recipes](RECIPES.md). `configure()` merges options: omit a source to keep
it, pass `null` to remove it, and call `refetchEvents()` to load a newly
installed source.
