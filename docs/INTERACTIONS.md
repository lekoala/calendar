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

Resource `droppable: false` or event `movable: false` must prevent drag before it starts.

`calendar:eventmove` detail shape:

```js
{ event, previous: { start, end, resourceId }, current: { start, end, resourceId }, nativeEvent, revert }
```

## 5. Resize

Support end resize first; start resize is also desirable and should be part of the design rather than an afterthought.

`calendar:eventresize` follows the same optimistic contract as move:

```js
{ event, previous: { start, end, resourceId }, current: { start, end, resourceId }, nativeEvent, revert }
```

## 6. Context actions

The core may dispatch a context event and provide anchor coordinates. It should not ship business menu items.

Desktop:

- right click;
- optional event action button authored by renderer/application.

Touch:

- optional long press with movement threshold;
- haptics are application/platform enhancement, not required core behavior.

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

Minimum accessible path to design/test:

- events focusable with `tabindex="0"` inside a core-owned wrapper;
- Enter/Space activates an event exactly like click;
- the accessible name survives custom `eventContent()` output;
- visible `:focus-visible` styling;
- keyboard users can invoke equivalent creation/edit actions;
- arrows/PageUp/PageDown navigation policy documented before implementation;
- drag/resize must have a non-pointer alternative, even if provided through commands rather than literal keyboard dragging.

## 10. Reduced motion / forced colors

Interaction feedback must remain understandable with reduced motion and forced colors. Do not encode state through color alone.
