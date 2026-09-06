# Roadmap

The milestones below are the construction trace of the project: each lists
what landed, in the order it landed. 0.1 is feature-complete for its scope.
Milestones 10–16 are the planned 0.2 trace, driven by the use cases in
`docs/USE_CASES.md` (§8, §14–§19); the deferred and candidate lists at the
bottom are revisit-only-with-a-use-case entries.

## 0.1 — released

Shipped in 0.1:

- **Core** — Temporal data model (events, resources, background ranges);
  solo and resource time grids, month and list views; range-scoped async
  sources with abort/stale guards; optimistic move/resize with `revert()`;
  hover, range selection, drag, resize and autoscroll; a full keyboard
  model; accessibility (live region, reduced motion, forced colors);
  overlap queries; civil `dates` helpers.
- **All-day lane** — explicit `allDay` events/backgrounds on strict civil
  `Temporal.PlainDate` boundaries (half-open end); a lane mirroring the
  time-grid columns in solo and resource views, per-resource stacking,
  click/context-menu/day-drag/Shift-arrows moves; `allDaySlot` toggles the
  lane; civil overlap queries; DST by consecutive civil midnights. Day-edge
  resize, lane creation and timed↔all-day conversion remain deferred.
- **External placement** — `addExternalDrop(el, payload, { duration, allDay,
  title, validate })` / `removeExternalDrop`; a real-duration ghost with
  structural validity plus application policy (`validate` returns a reason);
  `calendar:externaldrop` delivers only the anchor (`{ payload, date, time?,
  resourceId, allDay }`), never the payload's meaning. The move workbench
  (§12) consumes it with `getEventOverlaps()` and `moveEvent()`. HTML5 DnD
  desktop path; touch/keyboard use paste-on-the-armed-item.
- **Drag-out parking** — an internal event drag released outside every
  column dispatches `calendar:eventdropout` (`{ eventId, event, nativeEvent }`),
  so the app can feed its workbench with the "drag out of the calendar"
  gesture; "park from the menu/Cut" remains the deterministic path.
- **Distribution** — pure ESM entries (no registration side effect), opt-in
  `define`, classic IIFE + minified twin, zero-config standalone build, CSS,
  generated `dist/types` and `custom-elements.json`; `sync`/`verify` gates.
- **Consumers** — the showcase application shell and the client sync
  contract (`docs/SYNC_CONTRACT.md`, `demo/sync-adapter.js`).

Deliberately deferred (revisit only with a concrete use case):

- keyed DOM reconciliation — 0.x renders by full replacement;
- a consolidated pointer engine;
- density policies per view: slot-row policy, `datesAboveResources`;
- source-range caching;
- a `--calendar-axis-size` custom property and a resource-row sticky-offset
  seam — both hardcoded today and worked around in the showcase.

## Milestone 0 — skeleton (this zip)

- project/docs/testing scaffold, Temporal date helpers, Light-DOM element
  with explicit registration, basic `timeGrid`/`resourceTimeGrid` columns,
  minimal geometry, incremental mutation API, source contract scaffold,
  unit + browser smoke tests.

Exit condition: a coherent starting point.

## Milestone 1 — canonical model + solo TimeGrid

- event/background/resource normalization; Temporal parsing contract;
  `prev/next/today`; slot grid + now indicator; keyed event rendering;
  stable scroll; custom event renderer; click/keyboard activation; async
  source lifecycle.

## Milestone 2 — overlap layout + hover/select

- real overlap algorithm; hit testing; hover preview; click and drag range
  selection + ghost; snap rules; cancellable selection.

## Milestone 3 — event drag/resize

- Pointer Events state machine; drag within/across days; resize start+end;
  mirror/ghost; autoscroll; read-only/`selectable`/`droppable`/`movable`/
  `resizable`; optimistic commit/revert contract.

## Milestone 4 — resourceTimeGrid

- resource/date column derivation; `resource → dates` headers; resource-aware
  slicing and hit testing; cross-resource drag; capability enforcement.
  Acceptance fixtures 1×7, 2×3, 6×1, 6×3, 12×1.

## Milestone 5 — mobile + accessibility hardening

- touch long-press; responsive density guidance; keyboard navigation and
  data-changing keys; reduced motion / forced colors;
  Chromium/Firefox/WebKit matrix.

## Milestone 6 — month + list

- month and list renderers over the same state, shared `eventContent` hook,
  view switching without forcing resource matrices.

## Milestone 7 — package/release engineering

- dist classic builds + CSS, `.d.ts`, `custom-elements.json`, `sync`,
  generated-drift gate, package tarball contract, dist demo, CI browser
  matrix.

## Milestone 8 — contract gaps (0.x)

- `calendar:loading` / `calendar:render` signals; `classNames` in all
  renderers; `+n more` as a real button (`calendar:moreclick`,
  `moreLinkContent`); `slotLabelInterval` / `slotLabelContent`;
  `firstDay` / `hiddenDays`; `week` anchored on the civil week; options
  travel through `configure()`.

## Milestone 9 — read surface, snapping, day bounds, sharing

- `getEventOverlaps` (plus `queryOverlaps` / `rangesOverlap`) over
  canonical state, `filter` included;
- neighbor snapping (`findSnapTarget`) for drag, resize and selection;
- `slotMin` / `slotMax` day bounds; background content and stacking;
  start-only events;
- the shareable cut/copy/paste workflow (application clipboard on
  `getEventById` / `moveEvent` / `addEvent`, `getEventOverlaps` as paste
  validation).

0.2 adds **operational scheduling seams** over the existing rendering and
interaction engines. Milestones may add small pure helpers and decision
hooks; they must not introduce a new interaction engine, clock service,
query subsystem, resource tree, source cache, or reconciliation strategy.
Existing structural debt (keyed DOM reconciliation, the consolidated pointer
engine, source-range caching) remains independent refactor work. Each
milestone carries a **lean guardrail** to re-evaluate at implementation
time: if the work needs more than the guardrail allows, stop and re-scope.

The 0.2 trace is ordered so every milestone consumes the primitive of the
previous one instead of inventing its own seam, in three blocks:

| Block                | Milestones            | Purpose                                              |
| -------------------- | --------------------- | ---------------------------------------------------- |
| Lifecycle            | M10 + M11             | state, focus and now survive re-renders correctly    |
| Interaction context  | M12 + M13 + M14 + M15 | where we act, in what context, if it is allowed, then reveal/preview |
| Scheduling surface   | M16                   | multi-resource workday actually usable               |

## Milestone 10 — render seams

- a single private `#afterRender(callback)` lifecycle primitive executed
  once the pending render has inserted its subtree, drained on
  `disconnectedCallback`; focus and announcement work land on it instead of
  nesting `requestAnimationFrame`;
- `#announce` and `#refocusEvent` collapse their two-frame dance onto that
  seam (the `.cv-status` live region already survives `replaceChildren`); a
  separate cancellable announce frame where a11y timing demands it;
- `docs/API.md`: `prev()`, `next()`, `today()`, `scrollToTime()` leave
  "Planned" — already implemented and browser-tested; `revealEvent` was
  the only future entry until Milestone 14 shipped it.

Lean guardrail: `afterRender` is a private **lifecycle primitive, not a
generic scheduler** — no retries, promises or priorities. Pure refactor,
net reduction in lines; announce timing is at most one cancellable frame. No
new machinery.

## Milestone 11 — temporal state + one-shot aging

- rendered event nodes carry `data-temporal-state="past|current|future"`
  and content hooks receive `info.temporalState`, derived from
  `end <= now`, `start <= now < end`, `now < start` via a pure
  `temporalState(start, end, now)` helper;
- the fact ages live: the render schedules **one** `setTimeout` to the next
  visible `start`/`end` boundary, fires `queueRender()`, and the next render
  recomputes the following boundary; the timer is cancelled/replaced on every
  render, on `disconnectedCallback`, and on refetch/navigation;
- the core never derives `editable`/`movable`/`resizable` from the fact;
  policy stays application-side (retroactive edit, lock-after-start,
  lock-after-close). Use case §14.

Lean guardrail: one pure helper + one render-derived, one-shot timer. No
global clock, no periodic tick, no observable "now service" — `now` is
whatever the render already computes. If implementing this needs a
timer-driven recompute subsystem, the milestone is oversized.

## Milestone 12 — range context

- public primitive `getRangeContext({ start, end, resourceId })`:
  `{ events: { overlapping: [...] }, backgrounds: { overlapping: [...],
  covering: [...] } }` — `covering` fully wraps the range, `overlapping` is
  a plain intersection;
- one definition of "context", consumed everywhere: `calendar:select` /
  `eventmove` / `eventresize` / `externaldrop` deliver `detail.context`,
  and Milestones 13 and 15 read the same shape through the same primitive;
- geometry only: the core never picks "the" background — interpreting
  schedule vs blocker stays application-side. Use case §16.

Lean guardrail: small pure helpers in the overlap module; context is computed
at dispatch/commit time in `calendar-view.js` and attached to existing
detail payloads — never recomputed per `pointermove`. Live feedback during a
gesture reuses this primitive only when the logically snapped target changes
(Milestone 13).

## Milestone 13 — dynamic interaction policy

- `configure({ interactionPolicy({ action, event, target, context, now }) })`
  → `true | false | reason`, `action ∈ move | resize | select`; strictly
  synchronous — server validation stays in the existing commit/revert path;
- gates before the gesture (no resize handle, no drag start) and validates
  the destination **when the snapped target changes** (existing hit/snap run
  first, then resolve context and evaluate once) with the existing
  invalid-ghost/`data-reason` visuals;
- one evaluation path shared with `addExternalDrop`'s `validate`;
- interaction is a permission: `moveEvent`/`resizeEvent`/`removeEvent`
  stay authoritative, so realtime/server removal of locked or past items is
  not blocked. Use case §15.

Lean guardrail: M13 may add policy calls to existing interaction paths. It
MUST NOT change pointer ownership, gesture state machines, hit testing or
commit mechanics, and must not import an `eventConstraint`/`businessHours`
taxonomy. One decision seam evaluated in `calendar-view.js` (`now` cached
per render), thin checks at the gesture entry points.

## Milestone 14 — reveal (shipped)

- `revealEvent(id, { focus = false, highlight = true }) → boolean` —
  in-range reveal: never navigates, never reloads; true when the event is
  in canonical state and its date is rendered, false on any miss (unknown
  id, date not rendered, node behind month `+n more`) — no refusal
  taxonomy;
- `reveal({ eventId, date, start, focus, highlight }) → Promise<boolean>` —
  out-of-range reveal for search results: `eventId` required (range-only
  navigation stays `gotoDate()`), `date || start` required, no `resourceId`
  (the shell owns resource selection; `data-event-id` + `inline: nearest`
  reach the column). `gotoDate()` is awaitable and returns the single load
  it triggered, so `reveal()` never fires a second one; a concurrent
  navigation winning meanwhile resolves false;
- view-agnostic: precise `scrollToTime` first in time grids, then
  `scrollIntoView({ block: "nearest", inline: "nearest" })` in every view;
  temporary `.cv-reveal` + `data-revealed` highlight cleared after ~2 s or
  sooner by re-render; success announces even with `focus: false`. Use
  case §8.

Lean guardrail: composes existing pieces only (`gotoDate`, async
`refetchEvents()`, `scrollToTime()`, `afterRender`). No load-tracking
subsystem, no retry logic.

## Milestone 15 — previewRange

- `previewRange({ start, end, resourceId })` + `clearPreview()` — evidence
  for application-proposed ranges (server slot proposals),
  `pointer-events: none`, independent of the pointer select ghost;
- the preview is a **render state, not a synthetic drag**: private state in
  `calendar-view.js`, the renderer reads `host.getPreview()`, painted with
  the same geometry primitive as the existing ghosts;
- pairing with reveal (Milestone 14) supports the navigate → preview →
  confirm workflow. Use case §17.

Lean guardrail: shares the host-seam shape with external drop but stays a
read-only render overlay reusing existing geometry helpers. If it needs its
own layout math or a lifecycle distinct from render state, stop and
re-scope.

## Milestone 16 — resource grouping, one level

- `calendar.resourceGroups = [{ id, title }]` plus `resource.groupId`; a
  group-header row above `resourceHeaderContent`; array order defines group
  order, the `resources` array defines order within a group;
- `resourceGroupContent({ group, resources, element })` joins the
  content-hook family;
- group filtering stays application-side over `resourceIds`;
- an architectural test prevents regression into `parentId`, nested groups,
  expand/collapse or tree state: grouping lands in 0.2, resource
  hierarchy/tree is **not planned**. Use case §18.

Lean guardrail: hard one-level limit. If nesting, collapse or tree-grid
requirements appear, that is the signal to stop and re-scope, not to extend
the milestone.

## 0.2.x / later — view duration (`dayCount`)

Not in the 0.2 core: lower value for the immediate scheduling goal, and a
few semantics to settle first. When taken:

- `dayCount`/`duration` is an **override** of the existing time-grid views;
  `threeDays`/`resourceThreeDays`/`week` remain the public presets and are
  not replaced in 0.x;
- open questions to resolve before implementing: does `view="week"` +
  `dayCount=4` stay a week? what does `next()` advance by? with
  `hiddenDays`, does `dayCount=3` mean 3 civil or 3 visible days? and does
  the option deserve a documented contract rather than a shortcut inside
  `getVisibleDates()`?

## 0.2 exit conditions

Cross-cutting, tests only (zero net core surface): the concurrency matrix
over the existing `revision`/`mutationId`/`revert()` contract — pending →
commit, pending → revert, pending → superseded move, realtime echo during a
pending commit, 409-style conflict, no stale render. Use case §19.

## Post-0.x candidates (revisit only with a use case)

- generic mini-calendar package;
- optional recurrence adapter;
- framework adapters;
- print/export helpers;
- bulk rescheduling for a resource/date closure: application-owned planning
  first, with a preflight/atomic multi-event mutation considered only after
  the rollback contract is defined;
- custom showcase select theme handling beyond the shipped first attempt
  (`color-scheme: dark` on the theme switch plus explicit token colors on
  `select`/`option`): an accessible custom listbox only if native popup
  rendering stays inconsistent across browsers.

Showcase shell polish landed in 0.x, all application-side (application
chrome, not core work): a room master checkbox with `indeterminate`, a
neutral mini-month state when no resource is active, a policy-threshold
"nearly full" marker and per-day accessible names for the mini-month.

Deliberately never planned: virtualization, Gantt, resource
hierarchy/timeline/tree-grid.

## Audited and not ours

- application chrome (toolbars, buttons, icon sets, themes);
- day-grid week/day and resource timeline views beyond the shipped grids;
- event/resource cross-filters (applications choose what they hand the
  core);
- height/slot/column sizing (the surrounding frame owns the box);
- formatting options (already covered by the content hooks).
