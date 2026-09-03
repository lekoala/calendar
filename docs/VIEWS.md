# Views and density

## Date derivation

Two families, and the difference is deliberate.

**Week-anchored views** derive the civil week containing the anchor date. `view="week"` with `date="2026-09-03"` (a Thursday) renders Monday 31 August to Sunday 6 September. The anchor property is not rewritten: it still reads `2026-09-03`, so an application can keep showing which day the user actually picked. `firstDay` moves the week start.

**Rolling views** (`day`, `threeDays`, `resourceDay`, `resourceThreeDays`, `list`) start at the anchor date and take their day count from there. `threeDays` means the anchor plus the two following days.

`hiddenDays` acts differently on each, for the same reason:

- a week is a fixed civil unit, so hidden days are removed from it: hiding Sunday leaves six columns;
- a rolling range is a count, so it is filled with visible days: `threeDays` with the weekend hidden still shows three usable days, spanning five calendar days.

`prev()` and `next()` follow. Month steps by calendar months and week-anchored views by whole weeks, both keeping the anchor weekday. Rolling views step by their own count of visible days rather than by a fixed number of calendar days, so two consecutive ranges never overlap or skip a working day, and the anchor never lands on a hidden day.

Hidden days shrink what is rendered, never what a source is asked for. `getVisibleRange()` spans from the first to the last rendered day, and the month range still covers whole weeks: asking a source for a day that is not rendered is harmless, asking for too little is not.

## Solo views

`timeGrid` is the primary renderer for one agenda/resource context.

Expected configurations:

- 1 day;
- 2/3 days;
- week/workweek.

A solo view should use the full horizontal space for dates and should not render an unnecessary resource header.

## Resource views

`resourceTimeGrid` adds a resource dimension.

Primary cases:

```text
2–3 resources × 2–3 days
```

and:

```text
several resources × 1 day
```

The renderer should technically handle more, but the library docs should encourage useful display choices rather than market unlimited simultaneous resources. Columns keep a minimum width and the view scrolls horizontally; the core never hides resources or days automatically to fit the grid.

### Column derivation

Columns derive from the view name, never from the resource count:

```js
isResourceView(view)
  ? getResourceColumns(resources, dates) // resource -> dates order
  : getTimeGridColumns(dates)            // one column per date
```

A solo `timeGrid` with resources in state still renders date-only columns; a `resourceTimeGrid` with zero resources renders an explicit empty state, never a silent solo fallback.

### Grouped headers

Resource views render two header rows:

```text
Room A (spans its date columns) | Room B (spans its date columns)
Mon | Tue | Wed                 | Mon | Tue | Wed
```

`resourceHeaderContent()` runs once per resource; `dayHeaderContent()` runs once per date/resource column and renders only the date (resource context is passed through for hooks). Solo views render the day row only.

### Unassigned events and global backgrounds

The two predicates are intentionally asymmetric — do not unify them:

- an event belongs to exactly one column. An event without `resourceId` is visible in solo views and hidden in resource views (duplicating it would suggest N events while the model holds one);
- a background without `resourceId` is global context and applies to every column. Targeted backgrounds render only in their resource's columns.

### Temporal slicing

Multi-day ranges are sliced and clipped per visible day (`sliceTimedEventForDay`), so `Mon 22:00 → Tue 02:00` renders as `Mon 22:00 → slotMax` and `slotMin → Tue 02:00` where the slot range overlaps. Slices with no positive visible duration render nothing. Geometry uses wall-clock minutes in `calendar.timeZone`, including across DST transitions.

## Density guidance

The practical pressure is roughly:

```text
visible resources × visible days × event density
```

Example column counts:

- 2 resources × 3 days = 6 columns;
- 6 resources × 1 day = 6 columns;
- 6 resources × 3 days = 18 columns;
- 6 resources × 7 days = 42 columns.

At some point the UX, not rendering speed, becomes the first problem.

The core should allow horizontal scrolling and author-defined minimum column sizes. It should not hide resources/events automatically without an explicit policy.

### Responsive guidance

Narrow viewports change density, never semantics: below 640 px the default column minimum shrinks (`--calendar-column-min: 7.5rem`, still author-overridable) and the grid keeps scrolling horizontally. Applications should prefer `day` / `resourceDay` on phones and keep 3-day views for larger screens; safe-area and shell chrome remain host concerns. Touch targets follow the event geometry (slot heights), with resize handles kept at least 0.65 rem tall; precise Multitouch gestures beyond press-and-hold are out of scope.

## Month

Month is a summary-oriented day grid over the anchor date's calendar month, not a time grid. It answers "what happens in September" without forcing a giant resource matrix.

- Weeks run Monday → Sunday (ISO); the grid shows full weeks, so leading/trailing days of adjacent months are visible but dimmed (`cv-outside`).
- Each day cell shows the day number, up to `monthEventLimit` event chips (default 3), then a `+n more` indicator. No spanning bars: a multi-day event repeats one chip per overlapped civil day and is omitted from days it does not overlap (an event ending exactly at midnight does not appear on the next day).
- Chips carry the event title (or `eventContent` output) with a full `describeEvent` accessible name. Background ranges are not rendered in month cells.
- Month is solo: events from all resources appear; resource columns are never built. `dayHeaderContent` is not used; the weekday row uses the `locale` option (`weekday: short`, runtime default when unset).
- An empty day-cell click dispatches `calendar:select` for that civil day (`00:00 → next 00:00` in `calendar.timeZone`, `resourceId: null`). Event chips are buttons: Tab reaches them, Enter/Space fires `calendar:eventclick`. There is no arrow-key model, drag, resize or range-select in month cells.
- `prev`/`next` step whole calendar months, preserving the anchor day-of-month where possible (`Temporal` constrains overflows, e.g. Jan 31 → Feb 28).

## List

List is a minimal generic renderer over the same visible event state: 7 consecutive civil days from the anchor date, each a day group with its events in chronological order. Rich operational lists belong to the consumer.

- Day groups use `dayHeaderContent` (falling back to the localized day header, as in time grids); days without events show a muted `No events` row (`labels.noEvents`).
- A multi-day event repeats under every civil day it overlaps, same rule as month.
- Events are buttons sharing the `eventContent` hook and the `describeEvent` accessible name; Enter/Space fires `calendar:eventclick`. No drag/resize/select.
- Like month, list is solo: it never builds resource columns. The hook receives `resource: null`; applications resolve `event.resourceId` against their own data.

## View switching

Switching views preserves the anchor date, reusable event data and vertical scroll position where the newly rendered scroller allows it; the visible range is recomputed, so sources are refetched for the new range (`start/end/resourceIds/signal` as always). There is no range cache by design — see data docs. Horizontal scroll is intentionally not contractual across representations.

Concretely: `timeGrid ↔ resourceTimeGrid ↔ month ↔ list` never rebuilds application-owned toolbar/sidebar state and never requires re-selecting resources.
