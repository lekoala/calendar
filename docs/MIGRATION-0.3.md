# Migrating 0.2 → 0.3

0.3 consolidates the contracts 0.2 introduced. There is no new interaction
engine, query subsystem or source cache, and no additional view. Only one
change can break a 0.2 consumer without a code change: month selection.

## 1. Month selection is a civil all-day range

`calendar:select` from a month day cell no longer reports a zoned 24-hour
range. It reports a civil selection:

```js
{
  start: Temporal.PlainDate, // the clicked day
  end: Temporal.PlainDate,   // the next day (exclusive)
  allDay: true,
  resourceId: null,
  context: { … },
}
```

`configure({ interactionPolicy })` receives the same all-day target
(`time: null`, `date` = the clicked day). Time-grid selection keeps its
zoned boundaries and `allDay: false`.

If you compared `detail.start`/`detail.end` as `Temporal.ZonedDateTime`, or
formatted them with a time zone, branch on `detail.allDay`:

```js
calendar.addEventListener("calendar:select", (event) => {
  const { start, end, allDay } = event.detail;
  if (allDay) {
    // PlainDate: `String(start)` is already YYYY-MM-DD.
    openAllDayDraft(String(start), String(end));
    return;
  }
  openTimedDraft(String(start), String(end));
});
```

`Temporal.PlainDate#toString()` and `ZonedDateTime#toString()` both survive
`String()`, so transport code that only stringifies keeps working; code that
reads `.hour`, `.timeZoneId` or `.epochNanoseconds` does not.

## 2. Navigation returns the reload it triggers

`prev()`, `next()` and `today()` now return the `Promise` of the source
reload, like `gotoDate()`. They returned `void` in 0.2. Ignoring the return
value is still valid; `await` it when you need the new range to be loaded.

## 3. `updateEvent()` is a merge

- an omitted key keeps its previous value;
- an explicit `null`/`undefined` clears it;
- `start`, `end` and `allDay` fall back to the stored event when omitted, so
  a partial server echo no longer needs a range and never flips a civil
  event to timed;
- `moveEvent(id, { resourceId: null })` detaches the event from its
  resource instead of keeping it through `??`.

A 0.2 caller that relied on `updateEvent()` resetting unspecified fields must
pass those fields explicitly.

## 4. Normalization is stricter, and fails earlier

- `normalizeEvent` / `normalizeBackground` throw on an inverted range
  (`end` before `start`), and `moveEvent`/`resizeEvent` return `null`
  without publishing optimistic state.
- Numeric `resourceId` values are stringified on events and backgrounds, so
  SQL-style numeric ids keep their resource column instead of detaching.
- `slot-max="24:00"` is the exclusive end of day (1440 minutes) and renders
  a full-day grid; interactions at that boundary roll to the next midnight.
- An invalid `date` attribute anchors on today in the configured zone with a
  one-time `console.warn`; an inverted or malformed `slot-min`/`slot-max` pair
  resets to the defaults. Neither throws inside the render frame any more.
- An unknown `view` name warns once instead of failing silently.

## 5. `revert()` cannot undo a newer write

`detail.revert()` is now bound to the write it was created for, not only to
the range it produced. A late undo no longer applies when the event was
removed, moved again, refetched, or confirmed by a realtime echo — including
the ABA case where a newer write returns the event to the same range.

Consumers that call `revert()` keep the same contract; the difference is only
observable when two writes overlap, where the stale one is now ignored.

## 6. Packaging

- `package.json` is `0.3.0`; `dist`, types and `custom-elements.json` are
  regenerated from `src`.
- `bun run verify` covers syntax, lint, types, unit tests, generated-artifact
  drift and the package contract. Browser, dist-smoke and showcase suites run
  in CI.
