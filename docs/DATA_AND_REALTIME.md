# Data, async sources and realtime

## Visible-window loading

A calendar should request only the useful range/resources:

```js
async ({ start, end, resourceIds, signal }) => Event[]
```

`resourceIds` reflects selected resources even in a solo grid (`["resource-a"]`). `[]` means no resource filter. Showing an empty grid when nothing is selected is an application policy.

## Abort + stale guard

Use both:

1. `AbortController` to cancel obsolete work;
2. request version/id so a source that ignores abort cannot overwrite current state.

Test rapid sequences such as:

```text
resource A request (slow)
resource B request (fast) → render B
A completes late           → ignored
```

and:

```text
[A,B] → [A,B,C] → [B,C]
```

## Cache

Do not build a complex cache before profiling. A simple range/resource key cache may later reduce repeated navigation loads.

Cache must never make stale application state invisible. Provide explicit invalidation/refetch.

## Realtime

Transport is external:

```text
WebSocket / SSE / polling / provider
            ↓
application adapter
            ↓
calendar mutation API
```

Core APIs:

```js
addEvent(event)
updateEvent(event)
removeEvent(id)
refetchEvents()
batch(fn)
```

## Optimistic interaction + realtime echo

A common flow:

```text
user drags event
→ optimistic position
→ PUT/PATCH server
→ server emits realtime update
```

The application should be able to attach `revision`/`updatedAt` in `extendedProps` and reconcile its own authoritative payload. The calendar should not invent a domain conflict-resolution strategy.

## Full refetch is valid

Incremental updates are convenience/performance. For broad changes (schedule rules, bulk import, permissions) a full source refetch is an acceptable safe path.

Refetch should preserve viewport/date/scroll and application-owned selection state.
