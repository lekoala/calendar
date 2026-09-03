# @lekoala/calendar — prototype

A lightweight, framework-agnostic calendar and resource scheduling Web Component built around **Temporal**, normal DOM, and a small public API.

This repository is intentionally a **starter**: the docs and contracts are more complete than the JavaScript. The goal is to make the first implementation decisions explicit before the engine grows.

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

The prototype exposes the intended seams even where implementation is incomplete:

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
  // Persist, then commit/revert when implemented.
});
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

The prototype includes deliberately small demos:

- `demo/index.html` — solo time grid
- `demo/resources.html` — resource grid with acceptance fixtures (1×7, 2×3, 6×1, 6×3, 12×1)
- `demo/resources-stress.html` — manual stress configurations (12×3, 6×7)
- `demo/realtime.html` — incremental event mutations

Serve the repository over HTTP:

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:4173/demo/`.

## Development

The project follows the same broad working model as `@lekoala/combobox`: explicit custom-element registration, source ESM, Light DOM, generated artifacts only later, browser tests for real interaction, and an `AGENTS.md` that protects the architectural invariants.

```bash
npm install
npm run check
npm run test:browser
```

The starter does **not** include a production bundling pipeline yet. That is intentional: first stabilize the public model and interaction engine, then add dist/types/custom-elements generation in the same style as the combobox project.

## What is intentionally incomplete

The current JavaScript proves only the shell and basic rendering geometry. TODOs remain for:

- overlap layout;
- drag / resize;
- autoscroll;
- range selection;
- hover-slot preview;
- month/list renderers (see Views);
- keyboard navigation;
- rich render hooks;
- source caching and request reconciliation;
- accessibility hardening;
- dist/types/custom-elements generation.

The intended behavior and test matrix are documented before implementation in [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/TESTING.md](docs/TESTING.md).

## License

MIT.
