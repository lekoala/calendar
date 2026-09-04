# @lekoala/calendar

A lightweight, framework-agnostic calendar and resource scheduling Web Component built around **Temporal**, normal DOM, and a small public API.

```html
<link rel="stylesheet" href="./src/calendar.css">
<script type="module" src="./src/define.js"></script>

<calendar-view view="week" date="2026-09-03"></calendar-view>
```

```js
const calendar = document.querySelector('calendar-view');

calendar.resources = [
  { id: 'room-a', title: 'Room A' },
  { id: 'room-b', title: 'Room B' },
];

calendar.events = [
  {
    id: 'event-1',
    resourceId: 'room-a',
    title: 'Project review',
    start: '2026-09-03T09:00:00+02:00[Europe/Brussels]',
    end: '2026-09-03T09:45:00+02:00[Europe/Brussels]',
  },
];
```

## Mission

The component should be very good at:

```text
dates × time × events
```

and, when resources are enabled:

```text
resources × dates × time × events
```

The core owns geometry, rendering, navigation and interaction. Applications own domain logic, forms, search, permissions, persistence, recurrence expansion and realtime transport.

An example consumer is an application shell. The core remains equally suitable for rooms, employees, vehicles, equipment, classes, facilities or any other resource schedule.

## Principles

- **Temporal is the date/time model.** No Moment/Luxon/legacy `Date` model in new core code.
- **No framework runtime.** Vanilla ES modules + Web Components + Light DOM.
- **Solo is first-class.** `timeGrid` is not a degenerate one-resource view.
- **Resources are generic.** A resource is not a doctor, room or employee to the core.
- **Recurrence is external.** The calendar consumes occurrences in the visible range.
- **Async data is range-scoped.** `start/end/resourceIds/signal` is the important source contract.
- **Realtime is transport-agnostic.** Expose incremental mutation APIs; do not embed WebSocket/SSE.
- **Rich rendering uses DOM nodes.** No `allowHtml` switch.
- **Virtualization is not a v0.x goal.** Optimize useful visible sets first.
- **Application UI stays outside.** No built-in appointment form, patient search, waiting room or business workflow.

See [docs/FOUNDATIONS.md](docs/FOUNDATIONS.md) for the full contract.

## Working API shape

Everything below is implemented and exercised by the browser suites:

```js
calendar.configure({
  eventSource: async ({ start, end, resourceIds, signal }) => [],
  backgroundSource: async ({ start, end, resourceIds, signal }) => [],
  eventContent(info) {
    const node = document.createElement('strong');
    node.textContent = info.event.title;
    return node;
  },
});

calendar.gotoDate('2026-09-10');
calendar.setView('resourceThreeDays');
calendar.refetchEvents();
calendar.addEvent(event);
calendar.updateEvent(event);
calendar.removeEvent(event.id);
```

Interaction is exposed through DOM events rather than business callbacks baked into the component:

```js
calendar.addEventListener('calendar:eventclick', (event) => {
  // Open an application-owned modal/router/etc.
});

calendar.addEventListener('calendar:select', (event) => {
  // start/end/resourceId
});

calendar.addEventListener('calendar:eventmove', (event) => {
  // Persist, then call detail.revert() to undo the optimistic move.
});
```

Civil date helpers (mini-calendars, custom headers) come from one `dates`
object, reachable through ESM and through the element static for
classic-script (e.g. `file://`) consumers:

```js
import { dates } from '@lekoala/calendar';
const weeks = dates.getMonthWeeks('2026-09-03', { firstDay: 1 });

// classic script: const { dates } = customElements.get('calendar-view');
```

## Views

- `day` — solo time grid, 1 day
- `threeDays` — solo time grid, 3 days
- `week` — solo time grid, 7 days / configured working week
- `resourceDay` — resource time grid, 1 day
- `resourceThreeDays` — resource time grid, 3 days
- `month` — summary day grid over the anchor month (Monday → Sunday weeks, `+n more` past `monthEventLimit`)
- `list` — chronological list of 7 days from the anchor date

Month and list are alternate representations over the same state: solo, no resource matrices, shared `eventContent` hook. The core does not impose a hard `resources × days` limit. The docs do recommend choosing a denser representation before a grid becomes unreadable.

## Demos

`demo/index.html` is a hub linking to every demo:

- `demo/basic.html` — solo time grid (day, 3 days, week, month, list)
- `demo/resources.html` — resource grid with acceptance fixtures (1×7, 2×3, 6×1, 6×3, 12×1)
- `demo/resources-stress.html` — manual stress configurations (12×3, 6×7)
- `demo/realtime.html` — incremental event mutations
- `demo/dist.html` — dist smoke: always loads the generated classic build (`../dist/calendar.js`), validates the distributed product over `http(s)` and `file://`
- `demo/showcase.html` — generic room-booking application shell skinned with Actual CSS 0.6 and Tabler icons (pinned CDN + token bridge). Full-viewport layout: slim topbar, side panel (mini month with ISO week numbers, search, room and kind filters, the booking rules), a single-row toolbar, a live strip, and a calendar that takes the whole remaining height. Solid `eventContent` cards tinted per `extendedProps.kind`; application booking rules that refuse a move or resize synchronously and roll one back after a simulated round-trip; an application tooltip keyed on `data-event-id`; a `@lekoala/combobox` search palette whose suggestions come from an async `load(query, { signal })`; creation/detail sheets on `calendar:select`/`calendar:eventclick`; view, tools and account menus plus a context menu, all native `popover` placed with `@lekoala/floating`; keyboard shortcuts; a locale switcher wired to `configure({ locale, labels })` with the shell's own formatters following the same resolution order; slow, failing and realtime source stand-ins

Serve the repository over HTTP:

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:4173/demo/`.

## Development

The project is self-contained: explicit custom-element registration, source ESM, Light DOM, committed generated artifacts, browser tests for real interaction, and an `AGENTS.md` that protects the architectural invariants.

```bash
npm install
npm run check
npm run test:browser
npm run sync
npm run verify
```

A few useful commands:

```text
npm run check
    syntax + lint + typecheck + unit tests

npm run test:browser
    browser behavior tests against the ESM source

npm run sync
    regenerate dist JS/CSS, declarations and custom-elements.json

npm run verify
    run the full consistency/package checks

npm run check:all
npm run test:browser:all
    include Firefox and WebKit
```

Generated distribution files are committed so the demo, package contents and published artifacts can be checked directly.

The package ships:

- pure ESM entry points (`src/`, no registration side effect);
- an opt-in `<calendar-view>` registration entry (`src/define.js`);
- a classic self-registering build (`dist/calendar.js`, minified twin);
- a zero-config standalone build (`dist/calendar.standalone.min.js`, minified only);
- CSS (`src/calendar.css`, `dist/calendar.css`, minified twins);
- generated TypeScript declarations (`dist/types/`);
- `custom-elements.json`.

There are no runtime source maps in 0.x. Declaration maps are kept for TypeScript editor navigation.

The source ESM is exercised directly by the unit and browser suites; `demo/dist.html` and `test/dist` exercise the generated classic build, `demo/dist-standalone.html` the standalone build.

### Distributions

Four usages, from most to least control:

```js
// 1. Pure ESM API (bundler apps, no side effects)
import { CalendarViewElement, defineCalendarView } from "@lekoala/calendar";
```

```js
// 2. Explicit registration (bundler apps, one line)
import "@lekoala/calendar/define";
```

```html
<!-- 3. Classic script + separate CSS (CDN or static hosting, CSP-friendly) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@lekoala/calendar/dist/calendar.min.css">
<script src="https://cdn.jsdelivr.net/npm/@lekoala/calendar/dist/calendar.min.js"></script>
```

```html
<!-- 4. Standalone: auto-register + auto-style, nothing else to load -->
<script src="https://cdn.jsdelivr.net/npm/@lekoala/calendar/dist/calendar.standalone.min.js"></script>
```

The standalone is the same classic bundle with the component stylesheet
inlined: on load it registers `<calendar-view>` and injects the CSS once as
`#lekoala-calendar-style`. It never replaces the separate distribution —
bundler apps and strict-CSP deployments keep the predictable split files.

Content-Security-Policy note: the standalone creates a `<style>` element at
runtime, so `style-src` must allow it (`unsafe-inline`, or a nonce matching
the script's own nonce, which the bundle propagates to the injected style —
only when that same nonce is allowlisted by `style-src`, not just
`script-src`). Deployments that forbid all injected styles should use
distribution 3 instead. Either way, the grid's calculated geometry
(`top`/`height` style attributes) already assumes style attributes are
allowed.

## What is intentionally outside the core

The 0.1 core is feature-complete for its scope; applications own everything
around it:

- **Transport and persistence**: no REST language, auth, WebSocket/SSE
  client or backend mapping — see the [sync contract](docs/SYNC_CONTRACT.md)
  for the client side of optimistic updates, `revision`, `mutationId` and
  `409` conflicts.
- **Recurrence expansion**, search UI, forms/modals, business workflows
  (booking policy, notifications) and realtime transport are application
  concerns built on the documented seams.

Known structural debt heading into 0.2, tracked in
[docs/ROADMAP.md](docs/ROADMAP.md):

- grid rendering is full replacement per mutation (keyed DOM reconciliation
  is the intended direction);
- pointer interactions live in the renderer rather than a consolidated
  pointer engine;
- density policies per view (all-day lane, slot-row policy) are planned,
  not built.

The contract and test matrix are documented in
[docs/ROADMAP.md](docs/ROADMAP.md) and [docs/TESTING.md](docs/TESTING.md).

## License

MIT.
