# Changelog

## Unreleased — showcase application shell

- `demo/showcase.html` rebuilt as a full-viewport application shell instead of a document-flow page: Actual CSS `topbar`, a sidebar (mini month, search, room checklist, kind legend, event source), an agenda toolbar, a live strip and a collapsible activity dock, with the calendar filling the whole remaining height. The shell overrides the core's `max-height: 70vh` scroller cap from the outside — no core change needed.
- Event cards are now solid tone cards, one hue per application kind, derived from Actual's semantic tokens so every theme in the switcher reskins the grid; `@container` queries drop card detail instead of clipping it on short bookings.
- `eventContent`/`dayHeaderContent` use the `element` the core passes them (`element.dataset.kind`, `data-today`, `data-weekend`), which removed the previous post-render `MutationObserver` pass. Month and list get their own card shapes from the same hook.
- New application-owned chrome, all built on documented core seams: a mini month driven by `calendar.date` (Temporal, no date library in the demo), room and kind filters that rebuild `resources`/`events`, a live strip over `getVisibleRange()`, and `T` / `←` / `→` / `/` / `F` keyboard shortcuts.
- Responsive: the sidebar becomes an off-canvas panel under 64rem, the toolbar wraps, the live strip drops secondary chips and narrow viewports open on `day` with the dock collapsed.
- Seed fixture widened to six weeks of bookings across three rooms so month view is as populated as the time grids; the store now lives in the application and the core holds the filtered projection.
- `test/browser/showcase.spec.js`: 9 Chromium tests (adds viewport-fill, mini-month navigation, room/kind filtering and live-strip assertions; `#anchor-label` is asserted through `data-date` now that the label is human-readable).

## Unreleased — showcase polish + demo hub

- `demo/index.html` is now a demo hub linking every demo; the old solo page moved to `demo/basic.html` (git history preserved).
- Showcase bumped to Actual CSS 0.6.0 (pinned CDN + themes); tokens revalidated against the bundle.
- Toolbar polish: view switcher and date navigation now use `.join` segmented controls with `aria-pressed`, tools controls bottom-aligned via `.items-end` + `sr-only` label + `touch-target`, day headers localized via `Intl.DateTimeFormat` with a per-column count badge.
- `test/browser/*` retargeted from `/demo/` to `/demo/basic.html`; showcase test extended with segmented active-state assertions.

## Unreleased — showcase demo

- `demo/showcase.html`: generic room-booking application shell skinned with Actual CSS (pinned CDN + `--calendar-*` token bridge). Rich `eventContent` cards by `extendedProps.kind`, day/resource header hooks, 3-choice creation dialog on `calendar:select` (event/background/blocked), detail dialog on `calendar:eventclick` with optimistic move/delete, app menu on `calendar:eventcontextmenu`, local tools search with reveal, slow-source and realtime stand-ins, theme switcher.
- `test/browser/showcase.spec.js`: 5 Chromium tests (seeded render, view-switch date preservation, detail sheet, tools reveal, realtime add).

## Unreleased — M7 package/release engineering

- Combobox-style release model: `sync` regenerates `dist/` (classic IIFE `calendar.js` + min twin, `calendar.css` + min twin with the Temporal ponyfill bundled) plus `dist/types/` declarations and `custom-elements.json`.
- Package contract: ESM `src/` entry points without registration side effects, opt-in `define` entry, classic builds and CSS in `exports`, committed `custom-elements.json` (observed attributes, public members, `calendar:*` events, `--calendar-*` tokens).
- `verify` gate: `check` + `sync` + type-consumer test + generated-drift gate + tarball contract (`check:package`); `demo/dist.html` and `test/dist` validate the distributed product, including `file://`-friendly self-registration.
- CI browser matrix: Chromium + Firefox + WebKit behavior suites with a Chromium-only dist smoke job.

## Unreleased — M6 month + list

- `month` view: Monday-start week grid over the anchor month, per-day chips with `+n more` past `monthEventLimit`, no resource matrices.
- `list` view: 7 chronological day groups with empty states, shared `eventContent` hook.
- Civil-day overlap helper (`eventOverlapsDate`); midnight-exact ends excluded.
- `prev`/`next` step whole months in month view; sources receive the week-aligned range.
- Month day clicks select the civil day; chips and list rows activate via click/Enter.
- No new render hooks: month/list reuse `eventContent` / `dayHeaderContent`.

## Unreleased — internal

- Instance state and helpers are truly private (`#field`); the element → renderer seam is now explicit injected callbacks (`commitEventMove`, `commitEventResize`, `announce`, `refocusEvent`) instead of underscore members. No behavioral change.

## Unreleased — M5 mobile + accessibility

- Keyboard model: arrow/Home/End focus navigation, Shift+arrows move (time/day), Alt+arrows resize, all through the optimistic commit; focus restored and results announced via a polite live region (view/date changes too).
- `calendar:eventcontextmenu` from right-click and press-and-hold (touch/pen, 550 ms / 12 px); long-press suppresses residual click/select/drag.
- Human-readable event names (`title, date, start to end`); labelled grid region.
- `prefers-reduced-motion` guard, `forced-colors` system-color mapping, narrower column minimum below 640 px with documented responsive guidance.
- Browser matrix: Chromium + Firefox + WebKit + touch mobile project; fixed float-boundary snapping exposed by fractional layout pixels.
- Pointer capture is best-effort (`tryCapture`) instead of throwing on released/synthetic pointers.

## Unreleased — M4 resourceTimeGrid

- View-driven column derivation (`getTimeGridColumns` / `getResourceColumns`); resource views never fall back to solo.
- Grouped `resource → dates` headers; `resourceHeaderContent` runs once per resource.
- Temporal day slicing with slot clipping; multi-day events render on every overlapped day.
- Explicit policy: unassigned events hidden in resource grids, `resourceId`-less backgrounds stay global.
- Density fixtures in `demo/resources.html` plus manual `demo/resources-stress.html`.
- Source race coverage for resource-set changes; solo/resource view switches preserve date and vertical scroll.

## 0.0.0-prototype

- Initial project skeleton.
- Temporal-based date contract.
- Light-DOM `<calendar-view>` custom element with explicit registration.
- Minimal solo/resource time-grid renderer.
- Public data/mutation/source API placeholders.
- Architecture, use cases, interaction model, roadmap and testing plan documented before implementation.
