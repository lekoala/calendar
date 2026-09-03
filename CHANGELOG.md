# Changelog

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
