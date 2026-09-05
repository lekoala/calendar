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

0.2 milestones add seams and small pure helpers over the existing engine;
none may grow a second interaction engine, a live-clock service, a query
subsystem or a resource tree. Known debt (keyed reconciliation, consolidated
pointer engine, source-range cache) stays refactor-only debt unless a
milestone is explicitly scoped to it. Each milestone below carries a **lean
guardrail** to re-evaluate at implementation time: if the work needs more
than the guardrail allows, stop and re-scope instead of growing the core.

## Milestone 10 — render seams

- a single private `afterRender(callback)` seam executed once the pending
  render has inserted its subtree, drained on `disconnectedCallback`; focus
  and announcement work land on it instead of nesting
  `requestAnimationFrame`;
- `#announce` and `#refocusEvent` collapse their two-frame dance onto that
  seam (the `.cv-status` live region already survives `replaceChildren`); a
  separate cancellable announce frame where a11y timing demands it;
- `docs/API.md`: `prev()`, `next()`, `today()`, `scrollToTime()` leave
  "Planned" — already implemented and browser-tested; `revealEvent` stays
  the only future entry until Milestone 14.

Lean guardrail: pure refactor, net reduction in lines. The seam is one
queued callback list drained on disconnect; if announce timing needs more
than the after-render queue, keep it a single cancellable frame. No new
machinery.

## Milestone 11 — temporal state as an observed fact

- rendered event nodes carry `data-temporal-state="past|current|future"`,
  derived from `end <= now`, `start <= now < end`, `now < start`; content
  hooks receive `info.isPast` / `info.isCurrent` / `info.isFuture`;
- the fact recomputes as `now` advances without a refetch, so a long open
  page ages correctly;
- the core never derives `editable`/`movable`/`resizable` from it; policy
  stays application-side (retroactive edit, lock-after-start,
  lock-after-close). Use case §14.

Lean guardrail: one pure `temporalState(start, end, now)` helper reused by
the renderers' existing `eventContent`/chip call sites; `now` is whatever
the render already computes — never a global clock. Live boundary aging is
at most a single `setTimeout` to the next `start`/`end` boundary, cancelled
on disconnect. If a "now service" or timer-driven recompute is required to
make it testable, the milestone is oversized.

## Milestone 12 — dynamic interaction policy

- `configure({ interactionPolicy({ action, event?, target, now }) })`
  returning `true | reason`, with `action ∈ move | resize | select`;
- gates before the gesture (no resize handle, no drag start) and validates
  the destination during the gesture with the existing
  invalid-ghost/`data-reason` model;
- one evaluation path shared with `addExternalDrop`'s `validate`;
- interaction is a permission: `moveEvent`/`resizeEvent`/`removeEvent`
  stay authoritative, so realtime/server removal of locked or past items is
  not blocked. Use case §15.

Lean guardrail: one decision seam (`policy(action, event, target)` evaluated
in `calendar-view.js`, `now` cached per render) with thin checks at the
gesture entry points, reusing the existing `cv-invalid`/`data-reason`
visuals. Non-goals while implementing: do not unify the pointer engines, do
not import an `eventConstraint`/`businessHours` taxonomy. This is the
milestone most at risk of a code monster; if the seam cannot stay a
decision-only callback, stop and re-scope.

## Milestone 13 — range context

- `getRangeContext({ start, end, resourceId })` →
  `{ events, backgrounds: { covering, overlapping } }`;
- `calendar:select` / `eventmove` / `eventresize` / `externaldrop` append
  `backgrounds: { covering, overlapping }`, computed through the same
  primitive;
- geometry only: the core never picks "the" background — interpreting
  schedule vs blocker stays application-side. Use case §16.

Lean guardrail: small `covering`/`overlapping` helpers in the overlap
module, context computed at dispatch/commit time in `calendar-view.js` and
attached to the existing detail payloads — never recomputed per
`pointermove`. If a gesture needs live feedback from this context, reuse the
Milestone 12 policy seam instead of wiring context into the renderer.

## Milestone 14 — reveal and programmatic preview

- `revealEvent(id, { focus, highlight })` — in-range reveal with
  scroll-to-time, optional highlight and focus;
- `reveal({ eventId, date, time, resourceId })` — out-of-range reveal for
  search results: `gotoDate`, await the async source (stale guards
  unchanged), then scroll/highlight/focus;
- `previewRange({ start, end, resourceId })` + `clearPreview()` — evidence
  for application-proposed ranges, `pointer-events: none`, independent of
  the pointer select ghost. Use cases §8, §17.

Lean guardrail: reuse `gotoDate`/`await refetchEvents()`/`scrollToTime()`
and the proven external-drop host seam — the preview mirrors
`getExternalDrag` as a read-only `getPreview` ghost painted with the
existing geometry helpers; no new layout or load-tracking subsystem. Focus
and highlight land on the Milestone 10 `afterRender` queue.

## Milestone 15 — resource grouping, one level

- `calendar.resourceGroups = [{ id, title }]` plus `resource.groupId`; a
  group-header row above `resourceHeaderContent`; array order defines group
  order, the `resources` array defines order within a group;
- `resourceGroupContent({ group, resources, element })` joins the
  content-hook family;
- no nesting, expand/collapse or tree grid; grouping and hierarchy stay
  separate concerns — hierarchy remains a revisit-only candidate; group
  filtering stays application-side over `resourceIds`. Use case §18.

Lean guardrail: hard one-level limit — `groupId` normalized in the model, a
group-header row over the existing resource headers, one
`resourceGroupContent` hook. If nesting, collapse or tree-grid requirements
appear, that is the signal to stop and re-scope, not to extend the
milestone.

## Milestone 16 — view duration + concurrency hardening

- a generic day count for time grids (`dayCount`/`duration`) replacing the
  closed `threeDays`/`resourceThreeDays` catalogue without new names; week
  views keep week anchoring, rolling views keep filling visible days
  (`getVisibleDates`/`stepAnchor` semantics unchanged);
- hardening, not new API: browser tests for pending/conflict/revert, a
  second mutation while the first is in flight, and a realtime echo during
  a pending commit — over the existing `revision`/`mutationId`/`revert()`
  contract. Use case §19.

Lean guardrail: a single `dayCount`/`duration` option overriding the
time-grid view names; the concurrency matrix is browser tests only — zero
net core surface. If arbitrary named views or a view-plugin system start to
look attractive, that is the signal to pause and re-scope.

## Post-0.x candidates (revisit only with a use case)

- generic mini-calendar package;
- resource hierarchy (grouping landed in Milestone 15);
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
timeline/tree-grid.

## Audited and not ours

- application chrome (toolbars, buttons, icon sets, themes);
- day-grid week/day and resource timeline views beyond the shipped grids;
- event/resource cross-filters (applications choose what they hand the
  core);
- height/slot/column sizing (the surrounding frame owns the box);
- formatting options (already covered by the content hooks).
