# Views and density

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

Month should not necessarily mimic the time grid. It may be a summary-oriented renderer with configurable event rows/indicators.

For resource-heavy products, a resource summary/list may be more useful than a giant resource-month matrix. Keep the model flexible enough for applications to compose a specialized summary.

## List

List is a minimal generic renderer over the same visible event state with the shared `eventContent` hook. Rich operational lists belong to the consumer.

## View switching

View changes should preserve where possible:

- anchor date;
- selected resources (application state);
- event data cache;
- vertical scroll/time focus when switching between compatible time grids.

A switch `timeGrid ↔ resourceTimeGrid` should not require rebuilding external toolbar/sidebar state.
