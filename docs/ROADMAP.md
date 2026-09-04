# Roadmap

The milestones below are the construction trace of the project: each lists
what landed, in the order it landed. Nothing further is planned. 0.1 is
feature-complete for its scope; the deferred and candidate lists at the
bottom are revisit-only-with-a-use-case entries.

## 0.1 — released

Shipped in 0.1:

- **Core** — Temporal data model (events, resources, background ranges);
  solo and resource time grids, month and list views; range-scoped async
  sources with abort/stale guards; optimistic move/resize with `revert()`;
  hover, range selection, drag, resize and autoscroll; a full keyboard
  model; accessibility (live region, reduced motion, forced colors);
  overlap queries; civil `dates` helpers.
- **Distribution** — pure ESM entries (no registration side effect), opt-in
  `define`, classic IIFE + minified twin, zero-config standalone build, CSS,
  generated `dist/types` and `custom-elements.json`; `sync`/`verify` gates.
- **Consumers** — the showcase application shell and the client sync
  contract (`docs/SYNC_CONTRACT.md`, `demo/sync-adapter.js`).

Deliberately deferred (revisit only with a concrete use case):

- keyed DOM reconciliation — 0.x renders by full replacement;
- a consolidated pointer engine;
- density policies per view: all-day lane, slot-row policy,
  `datesAboveResources`;
- source-range caching;
- external drag & drop and dropzones (`calendar:externaldrop` /
  `calendar:eventdropout`);
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

## Post-0.x candidates (revisit only with a use case)

- generic mini-calendar package;
- resource grouping/hierarchy;
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
