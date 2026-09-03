# Changelog

## Unreleased — roadmap: M9 application-feeder seams

- New Milestone 9 in `docs/ROADMAP.md` closes the reachability holes found
  by mapping a real FullCalendar business consumer onto the core seams: a
  public read surface (`getEventOverlaps`), `slotMin`/`slotMax` day
  boundaries, background content/stacking, start-only events, external
  drag & drop + dropzones, and the all-day lane / slot-row policy /
  `datesAboveResources` density and header options promoted from post-0.x.
  Planning change only: no source, tests or generated artifacts touched.

## Unreleased — locale and labels

- `configure({ locale })` (or the `lang` attribute, falling back to the document language) localizes default day headers, axis labels and the month weekday row through `Intl`, and suggests `firstDay` when none is explicit (`en-US` weeks start Sunday, `fr` weeks Monday; explicit `firstDay` wins). Only the explicit option feeds date derivation, so `lang`/document language localize text, never temporal math. Content hooks stay authoritative.
- `configure({ labels })` overrides the fixed English strings (`noEvents`, `noResources`, `more` with `{hidden}`, `calendarRegion`, `untitledEvent`); `DEFAULT_LABELS`, `resolveLabels` and `formatLabel` are exported from the main entry for applications building their own catalogs. No locale bundle to load and no async loader in the core.
- Demo `basic.html` gains a locale switcher (system/English/Français/Nederlands).

## Unreleased — showcase: search is a combobox

The core's position is that search is an application concern - it ships navigation primitives (`gotoDate`, `scrollToTime`, `getEventById`) and nothing else. The showcase used to prove that with a hand-rolled input and a list of result buttons; it now proves it with a real component.

- `demo/showcase.html` uses [`@lekoala/combobox`](https://github.com/lekoala/combobox) for the booking search: `<combo-box>` enhances a real `<input list>`, which keeps owning the text, and the shell only supplies results and decides what a selection means. Suggestions come from `load(query, { signal })` - deliberately the same shape as the calendar's own `eventSource`, so the two async seams read alike and a superseded keystroke aborts its request. Selecting one navigates to that day, scrolls to that time and focuses the booking.
- Rich suggestion rows go through `render.option()`, which follows the same rule as the calendar's content hooks: strings are text, rich rows are DOM nodes. A row carries the kind tone, the title, and the date/room a single line cannot.
- **The search moved out of the side panel and became a command palette.** That is a consequence of the mechanism, not decoration: the combobox picker is a `popover="manual"` appended to the nearest ancestor `<dialog>`, so inside the side panel - which is itself a `popover` below 64rem - it would be a body-level sibling and the panel's own light dismiss would fight it. In a dialog of its own the picker is a descendant and the two layers unwind cleanly: Escape closes the picker, then the palette. It opens from the topbar icon, from the side panel button, or with `/`, at every width.
- `messages` is translated alongside the core's `labels`, and the locale switch reconfigures the instance explicitly, since instances snapshot their messages at construction.
- Both dependencies are pinned in an import map by bare specifier. That matters: the combobox imports `@lekoala/floating` itself, so mapping the name gives it and the page **one** module instance instead of two copies of the positioning engine. Neither is a runtime dependency of the core, and the classic-script demos stay free of both so they keep working over `file://`.
- A `--cb-*` token bridge sits next to the `--calendar-*` one - same idea, same mapping the combobox project uses in its own Actual CSS demo. No adapter package, no JS glue: two token contracts meeting in author CSS. All eight themes reskin the picker for free.
- Two ink fixes the bridge needed. The combobox pairs its active row with a solid accent fill and a hardcoded `color: #fff`, so mapping the background to a subtle overlay made the row title vanish - the ink has to be restated alongside it, which is what the combobox project's own Actual CSS demo does. And a secondary note inside a button cannot use `.muted`: that token is relative to the surface, not to the control, so it landed as grey ink on the filled accent of the creation sheet. Deriving it from the button's own `currentColor` works on every variant.
- Palette polish, all of it the shell's own contract with the engine. Focusing the field is what asks the engine to open, and with an empty catalogue - every suggestion comes from `load()` - an empty query would open a picker containing nothing but a state row; the threshold is a policy, so it is enforced by cancelling `combobox:beforeopen` rather than by suppressing focus. Reopening now also drops the previous search's transient results, and does it *before* `showModal()`, since the dialog autofocuses the field and a clear afterwards would already have re-run the old query as a stale “Searching…”. The palette gained Actual's `.dialog-close` beside the field, and a backdrop click now dismisses every sheet in the shell. `placeholder` moved from `<combo-box>` to the input: the wrapper attribute drives the search field the engine generates for a select-backed combobox, and here the native input is the source and owns its own.
- One shared `sleep(ms, signal)` now backs the slow event source, the failing source and the palette's `load`, since all three are handed an `AbortSignal` and all three have to reject rather than resolve late.
- `test/browser/showcase.spec.js`: 26 tests. Adds the palette (reveal, quiet open, empty query on reopen), the picker's parentage and popover mode, the rich row, the Escape layering, the close button, the backdrop dismissal and the localized `messages`.

## Unreleased — showcase: locale and labels

- `demo/showcase.html` exercises the new `locale`/`labels` contract. A row of locale chips lives in the account menu next to the theme swatches (`lang`, `en-US`, `en-GB`, `fr`, `nl`), and one `configure({ locale, labels })` call carries both halves: `locale` for everything `Intl` and `Temporal` format, `labels` for the five strings the core writes itself. The French and Dutch tables are the whole translation - no bundle to fetch, which is the point of the contract.
- The shell resolves its own locale the way the core documents it - `configure({ locale })`, then the `lang` attribute, then the document language - and rebuilds its five `Intl.DateTimeFormat` instances from it. That fixed a latent inconsistency: the shell was formatting with the runtime default while the core was reading `<html lang="en">`, so the chrome and the grid could disagree about what month it was. The first chip is labelled `lang` rather than "System" for the same reason.
- Tools → Grid gains "Week starts Monday", which makes the documented precedence visible in both directions: the shell pins `firstDay: 1`, and dropping the pin hands the choice back to the locale (`en-US` moves the week to Sunday, `fr`/`nl`/`en-GB` keep Monday). Sundays have to be shown for the difference to be visible at all, and that toggle sits right next to it.
- The toolbar subtitle names the locale in force alongside the ISO week and the time zone.
- The application chrome itself is deliberately not translated: fetching UI copy is transport, and stays an application concern. What the switch drives is the core's own output plus every date the shell prints.
- `test/browser/showcase.spec.js`: 23 tests. Adds the locale switch (core `calendarRegion`, month `+n more`, the localized weekday row, and the shell's own mini-month title) and the `firstDay` precedence in both directions.

## Unreleased — showcase: demo coverage debt, views and mobile

Closes the demo coverage debt recorded in `docs/ROADMAP.md`, and gives the grid back the room the chrome was taking. All of it is application code in `demo/showcase.html`; the core is unchanged.

Contracts that were implemented but invisible:

- **Move/resize rejection.** The shell now carries a booking policy - opening hours, a maximum duration, a view-only weekday, per-room non-bookable ranges, facilities-owned kinds - and one `violation()` function answers for pointer drags, keyboard moves, commands and range selection alike. A refusal calls `preventDefault()` synchronously, so the core reverts its own optimistic change, and a status bar says why. Deadlines demonstrate the asynchronous half instead: accepted optimistically, then rolled back with `detail.revert()` once the simulated round-trip answers. Maintenance bookings are handed to the core as `editable: false`, so the core refuses the drag itself.
- **The rules are visible before they are enforced.** Closed hours and blocked ranges are generated as background ranges from the same constants the guard reads, with `classNames` telling the two policies apart - the core still hard-codes no meaning for a background.
- **Hover intent.** An application tooltip keyed on `data-event-id`, with no core hook: `popover="manual"` for the top layer, `reposition()` for placement and `autoUpdate()` so it follows the calendar scroller rather than the page. It gives back exactly the detail the `@container` queries drop on short cards.
- **The context menu is rewritten properly.** It was clamping itself with hardcoded `innerWidth - 200` / `innerHeight - 140` guesses and hand-rolling outside-click and Escape. It is now a native `popover` placed with `repositionAt()`, and it proposes a real range on an empty slot instead of telling the user to drag. `contextmenu` is dispatched before the pointer release in some engines, where light dismiss would close a menu opened during the press, so the menu opens after the release - cooperating with the platform's dismissal instead of replacing it.
- **Week numbers** in the mini month, from `Temporal.PlainDate.weekOfYear`. Still no date library in the demo.
- **Aura on a new booking**, reusing the `--aura-angle` property and `aura-rotate` keyframes Actual already registers, and reduced to a static ring under `prefers-reduced-motion`.

Views, mobile and layout:

- The seven view buttons are one trigger naming the current view, opening a grouped popover menu with icons and `1`-`7` shortcuts. A fifth of the width, and it reads the same on a phone.
- Tools is a real mega menu: event source (including a failing source, which exercises `calendar:loaderror`), realtime stand-ins, grid options (`hiddenDays`, `pxPerMinute`, `slotLabelInterval`, mini-month week numbers) and diagnostics. The debug and test controls no longer sit in the chrome.
- The avatar opens an account menu with the theme switcher in it, which is where an application keeps it.
- The activity dock is gone: the newest intent rides the live strip so nothing looks inert, and the full log is a panel that stays hidden until asked for. On a 390x780 viewport the chrome went from ~230px to ~130px, and `.cv-scroller` now keeps over 70% of the viewport at every width.
- Toolbar collapsed to a single row at every width; the live strip is one scrollable line instead of a wrapping block; day and resource headers are compact, with the core's fixed 3rem sticky offset replaced by one `--sc-resource-row` value used by both rules.
- Below 64rem the side panel is the same element with a `popover` attribute, which supplies the backdrop, the outside click and Escape - the scrim element and the keydown bookkeeping are gone.
- Icons are the Tabler webfont (pinned CDN) rather than text glyphs, which is what fixed the alignment: they are flex items with `line-height: 1` inside Actual's controls. `.icon-only` inside a `.join` is stretched, since a fixed square box left a pale sliver under the chevrons.
- No overlay scrolls sideways: Chromium's UA `[popover]` rule turns on `overflow: auto` on both axes, which turned Actual's tooltip arrow - a pseudo-element that hangs off the side the tooltip points from - into a horizontal scrollbar. Menus close the inline axis (long labels already ellipsise) and the tooltip is `overflow: visible`, since it wraps rather than scrolls. The account menu's eight theme rows became three mode rows plus a row of swatches, each carrying its own `data-theme` so the theme stylesheet paints it - no colour list to keep in sync, and no vertical scrollbar either.
- Two things the design system already had and the demo was not using. `.dialog-close` is Actual's absolutely-positioned close affordance, with its own masked icon: the three sheets now carry it instead of a `<form method="dialog">` text button, with the title padded out of its way the way `dialog.drawer > header` is. And Actual resets heading margins under `.prose` and `.flyout > section` only - these menus are popovers rather than flyouts, so each `<h3>` group heading kept the browser's 13px block margins on top of `.menu-label`'s padding and the list gap. Resetting it takes 102px off the view menu and stops the tools menu clipping.
- `@lekoala/floating` is pinned in the demo the way Actual CSS already is - an application dependency, never a runtime dependency of the core. The showcase script is a module now; the classic-script demos stay untouched and keep working over `file://`.

- `test/browser/showcase.spec.js`: 21 tests, green on Chromium, Firefox, WebKit and the mobile project. Adds refusal (synchronous and after the round-trip), the blocked-range drop, the hover tooltip, context-menu placement and clamping, the empty-slot menu, view-menu switching and digit shortcuts, grid options through `configure()`, the activity panel's cost in grid height, and the side panel's popover/column split.

## Unreleased — M8 contract gaps

Additive core seams found by auditing the public surface against a comparable MIT scheduler used as a specification reference. No architecture change: every item closes a seam an application could not reach.

- `calendar:loading` brackets each async source run with `detail.loading`, alongside the `aria-busy` attribute. Only the newest request settles the state, so an aborted or superseded run never reports itself as finished while a newer one is in flight.
- `calendar:render` fires once the rendered subtree exists, with `{ view, dates, resources }`. It replaces mutation observers and `:has()` tricks for applications that decorate rendered columns.
- `calendar:moreclick` plus a `moreLinkContent` hook: month `+n more` is now a real button carrying `{ date, events, hidden, nativeEvent }`, activatable by pointer and keyboard, and no longer falls through to the day cell's `calendar:select` — which meant "create" and was the wrong intent.
- `classNames` is applied by the month and list renderers too, not by `timeGrid` alone.
- `slotLabelInterval` sets time-axis label density and the new `slotLabelContent` hook sets what a label reads; the axis is no longer hardcoded to hourly `HH:00`.
- `firstDay` (ISO 1-7, default Monday, `0` accepted as an alias for Sunday) and `hiddenDays` join `configure()`. `firstDay` drives both week anchoring and month week derivation, replacing the hardcoded Monday in `getMonthWeeks`.
- **Behaviour change**: `week` is now anchored on the civil week containing the anchor date rather than starting at it. The anchor property is never rewritten, so applications keep knowing which day the user picked. Every other view stays rolling. Documented in `docs/VIEWS.md`.
- `hiddenDays` acts by family, deliberately: a week is a civil unit and loses columns, a rolling range is a count and spans further instead. `prev()`/`next()` step by visible days through the new `stepAnchor()` helper, so consecutive ranges never overlap or skip a working day and the anchor never lands on a hidden day. Hidden days shrink what is rendered, never what a source is asked for.
- `src/calendar.css`: month grid column count comes from `--calendar-month-columns` so hidden days narrow the grid; `.cv-month-more` is styled and focusable as a button.
- `demo/showcase.html`: reports `calendar:loading` in the live strip and dims the grid while a source is in flight, opens the day behind month `+n more`, and declares `firstDay: 1` / `hiddenDays: [7]` as application policy.
- Tests: `test/core/derivation.test.js` (12 cases) and `test/browser/options.spec.js` (11 Chromium cases). `test/browser/basic.spec.js` now widens the slot range around the wall clock before asserting the time indicator, which used to make the suite fail outside 08:00-18:00 Brussels time.
- `docs/API.md`, `docs/VIEWS.md`, `docs/DATA_AND_REALTIME.md`, `docs/ROADMAP.md` updated; `dist/` and `custom-elements.json` regenerated (11 events).

## Unreleased — showcase application shell

- `demo/showcase.html` rebuilt as a full-viewport application shell instead of a document-flow page: Actual CSS `topbar`, a sidebar (mini month, search, room checklist, kind legend, event source), an agenda toolbar, a live strip and a collapsible activity dock, with the calendar filling the whole remaining height. The shell overrides the core's `max-height: 70vh` scroller cap from the outside — no core change needed.
- Event cards are now solid tone cards, one hue per application kind, derived from Actual's semantic tokens so every theme in the switcher reskins the grid; `@container` queries drop card detail instead of clipping it on short bookings.
- `eventContent`/`dayHeaderContent` use the `element` the core passes them (`element.dataset.kind`, `data-today`, `data-weekend`), which removed the previous post-render `MutationObserver` pass. Month and list get their own card shapes from the same hook.
- New application-owned chrome, all built on documented core seams: a mini month driven by `calendar.date` (Temporal, no date library in the demo), room and kind filters that rebuild `resources`/`events`, a live strip over `getVisibleRange()`, and `T` / `←` / `→` / `/` / `F` keyboard shortcuts.
- Responsive: the sidebar becomes an off-canvas panel under 64rem, the toolbar wraps, the live strip drops secondary chips and narrow viewports open on `day` with the dock collapsed.
- Seed fixture widened to six weeks of bookings across three rooms so month view is as populated as the time grids; the store now lives in the application and the core holds the filtered projection.
- `test/browser/showcase.spec.js`: 9 Chromium tests (adds viewport-fill, mini-month navigation, room/kind filtering and live-strip assertions; `#anchor-label` is asserted through `data-date` now that the label is human-readable).
- `docs/ROADMAP.md`: new milestone 8 (contract gaps), a demo coverage-debt section, and a record of the option families audited and deliberately left out, after comparing our public surface against a comparable MIT scheduler used as a specification reference.
- `docs/INTEGRATION.md`: new "Overlays" section fixing the boundary and the mechanism for application-owned menus, tooltips and day popovers - native `popover` for the top layer and dismissal, `@lekoala/floating` for placement, `autoUpdate()` because the calendar scroller moves independently of the page. Positioning is an application dependency, never a runtime dependency of the core; CSS anchor positioning is noted as above our browser floor for now.

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
