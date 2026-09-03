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
