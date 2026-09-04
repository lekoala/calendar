# Interaction model

The quality bar is closer to a polished scheduling application than a static calendar grid.

All interaction events are `bubbles: true`, `composed: true` and `cancelable: true`. `dispatchEvent()` is synchronous: `preventDefault()` rejects an operation immediately, while `detail.revert()` is idempotent and may be called after an `await`.

## 1. Empty-slot hover

Desktop pointer movement over an empty slot should be able to produce a non-interactive overlay:

```text
+ 10:20
```

or a duration preview based on `defaultTimedEventDuration` (default 30 minutes, a `Temporal.Duration`).

Requirements:

- derived from shared hit testing;
- `pointer-events: none`;
- hidden during conflicting active interaction;
- no full view rerender on every pointer move.

## 2. Range selection

Pointer down on empty grid → move → selection ghost → pointer up → `calendar:select`.

The selection payload needs:

```js
{ start, end, resourceId, nativeEvent }
```

`calendar:select` is an intention: it is cancelable but carries no `revert()` because no event was mutated. The application decides what to create. An explicit drag selection carries its own `start/end`; snapping uses `snapDuration` (default 15 minutes).

Snap rule: the drag anchor snaps with floor and the moving edge snaps with ceil, so the dragged area is always covered; the resulting range is at least one snap step. A plain click without drag selects `defaultTimedEventDuration` from the snapped point.

Neighbor snapping (magnetism): after the grid snap, a moving edge (drag
start, resize start/end, selection anchor/moving edge) that lands within
`min(snapStep / 2, 5 minutes)` of a neighboring event or background boundary
in the same column uses that boundary instead. This makes a 10-minute event
follow its predecessor without a gap on 20-minute slots. Comparison is made
on the raw pointer position, not on the already-snapped value, so near-misses
still attract. Keyboard moves and resizes step by exact `snapDuration`
increments and never magnetize: they are already precise.

Residual click after a true drag-selection must be suppressed.

## 3. Event click

Click/Enter dispatches `calendar:eventclick` with event identity and native event context. No built-in editor.

## 4. Event drag

The engine must eventually support:

- time change within same day;
- date change;
- resource change in `resourceTimeGrid`;
- snap via `snapDuration`;
- visual mirror/ghost;
- autoscroll;
- optimistic application with `detail.revert()`;
- revert on `preventDefault()` or on persistence rejection.

Resource `droppable: false` or event `movable: false` must prevent drag before it starts. Dropping on a non-droppable resource reverts silently without dispatching.

During a drag the original node stays in place while a detached mirror follows the pointer across time, days and resources. The calendar commits optimistically on drop and re-renders; the residual click after a moved drag is suppressed.

A viewport autoscroller advances the scroll while the pointer rests near the scroller edge. It is a separate helper, not part of layout math.

Event nodes use `touch-action: none` so pointer drag works on touch. Touch range selection remains a later milestone.

`calendar:eventmove` detail shape:

```js
{ event, previous: { start, end, resourceId }, current: { start, end, resourceId }, nativeEvent, revert }
```

## 5. Resize

Support end resize first; start resize is also desirable and should be part of the design rather than an afterthought. Both edges expose a resize handle on resizable events; the start edge snaps with floor and the end edge with ceil, keeping at least one snap step of duration.

`calendar:eventresize` follows the same optimistic contract as move:

```js
{ event, previous: { start, end, resourceId }, current: { start, end, resourceId }, nativeEvent, revert }
```

## 6. Context actions

The core dispatches a context event and provides anchor coordinates. It does not ship business menu items.

```js
calendar.addEventListener("calendar:eventcontextmenu", (event) => {
  // detail: { event|null, date, time, resourceId, clientX, clientY, nativeEvent }
});
```

Desktop: right-click (`contextmenu`) on an event or an empty slot. The core never calls `preventDefault()` on the native event; the application suppresses the browser menu when it handles the intent.

Touch/pen: press-and-hold (550 ms, 12 px tolerance) on an event or an empty slot fires the same event. A fired long-press suppresses the residual click/select/drag that would otherwise follow. Mouse pointers never trigger long-press; they use right-click.

`time` is the slot-snapped (`snapDuration`, floor) wall time at the pointer, resolved through the shared hit testing. For events, `event` carries the target; for empty slots it is `null` and `date`/`resourceId` describe the column.

## 7. Pointer engine

Target state machine:

```text
idle
 └─ pointerdown
    ├─ select-pending → selecting
    ├─ event-pending  → dragging
    ├─ resize-start
    └─ resize-end
```

Use Pointer Events rather than maintaining separate mouse/touch engines.

## 8. Hit testing

One shared primitive should resolve:

```js
{
  date,
  time,
  resourceId,
  column,
  minutes
}
```

from pointer coordinates.

Hover preview, select, drag and drop should all consume this result.

## 9. Keyboard

Events are native `<button>` elements: Tab reaches them, Enter/Space fires `calendar:eventclick`, and the accessible name (`title, date, start to end` in wall-clock time) survives custom `eventContent()` output. Focus is `:focus-visible` styled.

Arrow keys move focus between events without changing data:

```text
Up/Down     previous/next event in the same column (time order)
Left/Right  nearest-by-time event in the previous/next column
Home/End    first/last event of the column
```

PageUp/PageDown keep their native scroll behavior and are never hijacked.

Data-changing keys act on the focused event through the same optimistic commit as pointer and commands (`calendar:eventmove` / `calendar:eventresize` with `revert()`, reverted on synchronous `preventDefault()`). They honor `movable`/`resizable`/`editable`; moving across resources stays a command/API operation (`moveEvent` with `resourceId`) so applications can expose their own resource picker UI:

```text
Shift + Up/Down       move ± snapDuration (same day)
Shift + Left/Right    move ∓/± 1 day, wall time and resource preserved
Alt + Up/Down         resize start ∓/± snapDuration (earlier/later)
Alt + Left/Right      resize end ∓/± snapDuration (shorter/longer)
```

Minimum duration is one snap step. After a committed key operation the re-rendered event regains focus and a polite live region announces the result (`title, date, start to end`); navigation keys announce nothing. Escape is reserved and currently a no-op.

Range creation stays pointer-initiated: applications expose creation through their own controls and feed the resulting range back through events/sources. Day bodies are intentionally not tab stops.

View/date changes (`setView`, `gotoDate`, `prev/next/today`) announce the new anchor (`view, date`) through the same live region.

## 10. Reduced motion / forced colors

Interaction feedback must remain understandable with reduced motion and forced colors. Do not encode state through color alone.

- `prefers-reduced-motion: reduce` disables transitions/animations inside the component. Autoscroll stays functional (it is viewport movement, not decoration).
- `forced-colors: active` maps surfaces to system colors: event borders to `CanvasText`, interactive overlays and focus to `Highlight`, the now-indicator to `Highlight`, invalid drop targets keep a dashed outline. Background tints that cannot render become transparent with a visible border.
