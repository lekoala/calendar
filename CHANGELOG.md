# Changelog

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
