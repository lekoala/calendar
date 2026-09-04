# Testing strategy

The calendar is interaction- and geometry-heavy. A DOM unit-test environment alone is not sufficient.

## Test layers

### 1. Pure unit tests

Use Node/Bun test runner for helpers that do not need layout:

- Temporal visible ranges;
- slot parsing/snap/clamp;
- minutes ↔ pixels;
- event top/height geometry;
- overlap grouping/layout;
- resource/date column derivation;
- event normalization/identity;
- range intersection;
- request/version reconciliation helpers.

### 2. Real-browser behavior tests

Playwright should cover anything involving:

- layout coordinates;
- Pointer Events;
- focus/keyboard;
- scrolling/autoscroll;
- CSS sticky headers;
- responsive behavior;
- ARIA;
- touch/long press;
- browser-native Temporal/polyfill integration.

### 3. Visual regression (after base renderer stabilizes)

Add screenshot tests for a small set of representative states, not every option:

- solo week, dense events;
- 2 resources × 3 days;
- overlapping events;
- selection/drag mirror;
- mobile 3-day;
- forced colors/reduced motion where tooling supports it.

### 4. Performance characterization

No premature hard performance contract, but profile realistic fixtures:

- 1 resource × 7 days, ~100 visible events;
- 2 resources × 3 days, dense overlap;
- 6 resources × 1 day;
- 6 resources × 3 days;
- 12 resources × 1 day;
- incremental update burst (e.g. 50 event changes).

Manual stress only: 12 resources × 3 days, 6 resources × 7 days. Columns keep a minimum width with horizontal scroll and are never hidden automatically. Record DOM size, render/update duration and pointer responsiveness. The goal is to find when UX becomes unreasonable, not to justify virtualization.

## Core unit matrix

### Geometry

- exact hour/slot boundaries;
- partial slot;
- negative pointer offset clamps to start;
- beyond-end clamps to end;
- 20/30/45/60-minute snap;
- fit-height changes px-per-minute without changing temporal result;
- start/end resize geometry.

### Overlap layout

- single event;
- adjacent events (not overlapping);
- two overlaps;
- three overlaps;
- nested event;
- chained overlap groups;
- event spanning entire group;
- deterministic placement after input reorder;
- same start/end ties.

### Temporal

- day/week range;
- timezone with DST transition;
- `Europe/Brussels` wall-clock event across DST week;
- civil `Temporal.PlainDate` boundaries: `[D, D+1)` single day, multi-day
  exclusive spans, adjacency (end D === start D+1 never overlaps);
- DST 23h/25h via two consecutive civil midnights (the civil day never
  stops being "the 29th");
- timed ↔ all-day overlaps; civil queries stay the civil day they name
  whatever `timeZone` runs the calendar;
- locale formatting is presentation-only, never temporal math.

### All-day lane

- `[D, D+1)` single-day bar, multi-day bar spans only its civil columns;
- all-day background paints the full-height lane tint;
- `allDaySlot: false` hides the lane from time grids, month/list keep it;
- same-room stacking, different rooms sharing a row, unassigned bars
  stacking against each other;
- resource bars never cross into a neighbouring room's block;
- bar click → `calendar:eventclick`; drag shifts the whole span by days;
  Shift+arrows move by one day; context/long-press intents;
- accessible names carry the civil span ("…, all day").

### Resources

- no resource (solo);
- one/multiple resources;
- resource ordering;
- resource-specific event slicing;
- background range with/without resource;
- capability/read-only filtering.

## Browser interaction matrix

### Solo

- day / 3-day / week switch;
- view keeps anchor date;
- event click + Enter;
- empty slot hover;
- click selection;
- drag range selection;
- event drag same day;
- event drag across day;
- resize start/end;
- scroll remains stable after incremental update.

### Resources

- 2 resources × 3 days renders correct column count/order;
- drag same resource/date;
- drag resource A → B;
- read-only resource rejects drop;
- resource-specific background range;
- switching resource ↔ solo preserves date/scroll where defined.

### Month and list

- month renders Monday-start weeks covering the anchor month (5- and 6-week cases);
- leading/trailing days dimmed but interactive;
- multi-day event repeats per overlapped day; midnight-exclusive end;
- crowded day collapses behind `+n more` honoring `monthEventLimit`;
- chip click + Enter dispatches `calendar:eventclick`;
- empty day click selects the civil day (`00:00 → next 00:00`, `resourceId: null`);
- `prev`/`next` step whole months;
- month sources receive the week-aligned range;
- list renders 7 chronological day groups with empty states;
- switching `timeGrid ↔ month ↔ list` preserves the anchor date.

### Async sources

- initial load;
- resource/date change aborts old load;
- old response ignored even if abort ignored;
- error keeps valid existing state and dispatches `calendar:loaderror`;
- `aria-busy` correct;
- refetch does not reset view/date/scroll.

### Realtime mutations

- add/update/remove one event;
- batch changes;
- focused event survives non-destructive update where possible;
- currently dragged event vs remote update policy documented/tested once designed.

### Mobile/touch

- horizontal scrolling;
- vertical scroll vs drag threshold;
- long press context action (if implemented);
- pointer cancel/lost capture cleanup;
- minimum useful hit targets;
- safe-area integration belongs to host shell unless calendar overlay requires it.

### Accessibility

- event accessible name;
- event keyboard activation;
- current view/date announced appropriately;
- selected range has equivalent non-pointer action;
- focus visible;
- no hidden focus traps;
- forced colors and reduced motion.

## Browser matrix

Chromium, Firefox and WebKit run the whole suite on every change, plus a touch-enabled narrow-viewport Chromium project (`mobile`). Scheduling bugs live in scroll/layout/pointer behavior, and the matrix has already caught real ones: Firefox/WebKit fractional layout pixels exposed float-boundary snapping, and `scrollIntoViewIfNeeded` scrolls oversized elements differently per browser.

Media emulation (`prefers-reduced-motion`, `forced-colors`) is asserted where the driver supports it (currently Chromium only) while the CSS itself is driver-independent.

## Test fixture rule

Use generic fixtures (`Room A`, `Resource B`, `Workshop`, `Maintenance`) in core tests. Domain-specific fixtures live outside this repository, not in its canonical tests.
