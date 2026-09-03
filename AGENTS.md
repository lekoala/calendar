# AGENTS.md

## Mission

Build a small, framework-agnostic calendar and resource scheduling engine as a Web Component. Prefer browser primitives, Temporal, normal DOM, explicit state and small public seams over framework-specific abstractions or enterprise-scheduler breadth.

The project is a **generic calendar core**. An example consumer is an application shell, not the domain model.

## Repository language

Code, comments, documentation, examples, tests, and commit messages are written in English.

## Generic scope

Use generic calendar vocabulary only: event, resource, background, range, view, slot.

The core must not contain product-specific domains, workflows, endpoints, persistence rules, authentication logic, or transport logic.

Examples use fictitious generic resources and events.

## Invariants

- Temporal is the canonical date/time model. New core code MUST NOT introduce Moment, Luxon, Day.js, date-fns or ad-hoc `Date` arithmetic as an alternative model.
- The main package import MUST NOT register a custom element as a side effect. Registration belongs to `src/define.js`, mirroring the combobox project.
- The default element uses **Light DOM**. Do not move to Shadow DOM without a concrete styling/integration problem and design review.
- The core MUST NOT know medical/business vocabulary: no patient, doctor, appointment, waiting room, invoice, reminder, consultation, Cronofy, etc. Use generic `event`, `resource`, `background`, `range` vocabulary.
- A single-resource/solo time grid is first-class. Do not implement every solo view by routing through a resource renderer with one fake resource.
- Resource scheduling is a dimension added by `resourceTimeGrid`, not the entire architecture.
- Recurrence expansion is outside the core. The calendar consumes concrete occurrences for a visible range. RRULE support, if ever added, is an optional adapter/plugin concern.
- Async event/background sources receive visible `start`, `end`, selected `resourceIds`, and an `AbortSignal`. Stale requests MUST NOT overwrite newer state.
- Search is outside the core. Provide navigation primitives (`gotoDate`, `scrollToTime`, `getEventById`, future `revealEvent`) so applications can implement search.
- Persistence and auth are outside the core. No built-in REST language, Bearer token handling, refresh token logic, WebSocket client or backend-specific endpoint map.
- Realtime transport is outside the core. Incremental mutations (`addEvent`, `updateEvent`, `removeEvent`) and `refetchEvents` are core APIs.
- Application forms/modals are outside the core. `eventclick`, `select`, context-menu and mutation events expose intent; applications own dialogs/workflows.
- Strings rendered by the core are text. Rich rendering functions return DOM Nodes/DocumentFragments.
- Virtualization is not a v0.x goal. Do not add it pre-emptively.
- Resource hierarchy/grouping is allowed as a future extension, but must not force a tree-grid architecture on the first implementation.
- CSS is normal author CSS with custom properties and semantic classes. Avoid inline styling except calculated geometry (`top`, `height`, overlap `left/width`, transforms where needed).
- The core should not own application toolbars, sidebars, command launchers, status bars or mini-calendars. They can live in the same package later as optional generic components, but remain composition peers.

## Internal state

Internal instance state and helpers are private by default. Use JavaScript private class fields (`#field`) for implementation details of public library classes.

Keep platform lifecycle entry points (`connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`) and documented public APIs accessible. Pure algorithms belong in module-scoped functions rather than private class methods.

Cross-module seams (for example element → renderer) must not reach into private state: inject narrow, explicit callbacks instead.

Do not introduce underscore-prefixed members as a visibility convention, and do not build subclassing contracts around internals. If extension becomes a supported use case, expose an explicit public hook/API.

## Compatibility baseline

Source JavaScript targets ES2022 and is shipped without transpilation. `jsconfig.json` must not be used to silently raise that floor: `tsc` enforces the ES2022 standard-library contract as part of `check`.

Language target and browser compatibility are separate contracts. The supported browser floor is Chromium 99+, Firefox 98+, and Safari 15.4+. New Web APIs must be checked against the browser floor; the DOM lib known to the installed TypeScript is not that check. Automated per-browser API auditing remains a later packaging/CI concern.

The baseline is a floor, not a ceiling: it may be raised deliberately when newer JavaScript enables a clearly better solution, but never broken incidentally for minor conveniences. Any raise must update the documented floor, the `tsc` contract, and the affected docs/tests together.

## Date/time contract

- Use `Temporal.PlainDate` for civil navigation dates.
- Use `Temporal.PlainTime` for slot boundaries.
- Use `Temporal.Duration` for durations.
- Use `Temporal.ZonedDateTime` when an event represents a real zoned appointment/booking.
- Use `Temporal.Instant` for absolute transport/comparison when appropriate.
- Named IANA time zones are first-class.
- The package currently uses the side-effect-free `Temporal` ponyfill from `temporal-polyfill`; do not install a global `Temporal` from inside the library.

## Core data model

### Event

At minimum:

```js
{
  id: 'event-1',
  title: 'Event',
  start: '2026-09-03T09:00:00+02:00[Europe/Brussels]',
  end: '2026-09-03T09:30:00+02:00[Europe/Brussels]',
  resourceId: 'resource-a', // id of the active resource when resource-aware
  editable: true,
  movable: true,   // defaults to editable when undefined
  resizable: true, // defaults to editable when undefined
  classNames: [],
  extendedProps: {},       // opaque application metadata
}
```

Do not interpret `extendedProps` in the core.

### Resource

At minimum:

```js
{
  id: 'resource-a',
  title: 'Resource A',
  selectable: true,
  droppable: true,
  classNames: [],
  extendedProps: {},
}
```

### Background range

A background range is time geometry behind events. The core must not hard-code meanings such as availability/unavailability.

## Views

Preserve two foundational renderers:

- `timeGrid`: date × time
- `resourceTimeGrid`: resource × date × time

`resourceTimeGrid` should reuse time-grid geometry/layout where practical, while adding resource-aware columns, headers, slicing and hit testing.

Month and list are separate representations over the same state. Do not make the main grid responsible for every use case.

## Interaction model

Pointer interaction should converge on Pointer Events and a small state machine, roughly:

```text
idle → press → select
             → drag-event
             → resize-start
             → resize-end
```

Important requirements:

- `setPointerCapture()` for active interactions where appropriate;
- cleanup on `pointercancel` / `lostpointercapture`;
- hover overlays are `pointer-events: none`;
- range selection suppresses the residual click;
- drag/resize can be cancelled/reverted by the application;
- resource-aware hit testing returns `{ date, time, resourceId }`;
- autoscroll is a separate helper, not mixed into layout math;
- touch long-press/context actions are optional interaction UI, not business menus.

## Rendering

Keep rendering seams narrow and DOM-oriented. Likely early hooks:

- `eventContent(info) -> Node | string | null`
- `dayHeaderContent(info)`
- `resourceHeaderContent(info)`

Do not add dozens of hooks before use cases require them.

## Async data

Canonical source shape:

```js
async ({ start, end, resourceIds, signal, calendar }) => Event[]
```

Separate `eventSource` and `backgroundSource` initially. Do not build a generic query language.

Source rules:

- abort obsolete requests;
- preserve current view/date/scroll while data changes;
- reject stale completions even if abort is ignored by a source;
- source errors dispatch an observable error event and do not silently clear valid existing data unless explicitly designed.

## Non-goals for v0.x

Do not add without a concrete use case and design review:

- recurrence editor/engine;
- built-in booking/appointment forms;
- patient/contact search;
- waiting-room workflows;
- billing/payment actions;
- application command launcher;
- WebSocket/SSE client;
- auth/token refresh;
- Gantt;
- resource timeline;
- capacity planning;
- resource virtualization;
- hundreds of simultaneously rendered resources as a primary scenario;
- resource tree-grid;
- framework adapters before the vanilla API is stable;
- plugin framework for its own sake.

## Legal/research guardrail

Behavior observed in third-party products may be used as a UX/specification reference. Do not copy proprietary JS/CSS/assets or reconstruct proprietary source into this repository.

Behavioral references may inform UX acceptance criteria, but never define the architecture.

Gitignored scratch or research directories must never be referenced from committed source code, documentation, comments, tests, or commit messages.

If code/algorithms are later reused from an MIT project (for example EventCalendar), preserve the required license/attribution and document the origin of copied/adapted files. Prefer independently implementing simple geometry and contracts when practical.

## Working style

- Package manager is bun (see `packageManager`). Run `dev`, `test`, `audit` and browser suites with bun.
- Audit/debug tooling lives in `scripts/` as committed reusable scripts, never as one-shot files at the repository root.
- Personal scratch goes to the gitignored `.temp/` directory, never to versionable paths.
- Keep the implementation readable before making it clever.
- Extract pure geometry/date/layout helpers and unit-test them.
- Browser interactions need browser tests; DOM shims are not a substitute for pointer/focus/layout behavior.
- When behavior changes, update the corresponding docs and tests in the same change.
- Avoid compatibility aliases before 1.0 unless an actual consumer needs them.
- Prefer explicit state transitions to broad mutation observers.
- Do not optimize for virtualization until profiling of a realistic visible set demands it.
- Keep generated artifacts out of the first prototype. Once packaging is stabilized, add a `sync`/`verify` workflow like `@lekoala/combobox` rather than hand-editing dist files.

## Development gates

Prototype phase:

```bash
npm run check
npm run test:browser
```

`check` should cover syntax/lint and unit tests. Browser tests cover rendering, pointer/keyboard behavior and async races.

Once dist/types/custom-elements generation exists, adopt the combobox model:

```text
check   = source quality, no dist writes
sync    = regenerate committed artifacts
verify  = final gate + generated drift/package contract
```

## Definition of done for a feature

A feature is not done until:

1. its model contract is documented;
2. solo and resource implications are understood;
3. pointer and keyboard paths are specified;
4. cancellation/disabled/read-only cases are considered;
5. async/realtime interaction is considered when relevant;
6. unit tests cover pure helpers;
7. real-browser tests cover normal behavior and an edge case;
8. cleanup/disconnect leaves no window/document listeners behind;
9. docs and demo reflect the implemented behavior.
