# Calendar sync contract (draft)

The calendar synchronizes; the application decides what a change *means*.
Persistence is cheap, business effects are not: every finished gesture is
saved promptly, while notifications and other external effects stay
asynchronous, coalesced, and server-owned. No notification protocol is
exposed to the calendar.

Related: [data and realtime](DATA_AND_REALTIME.md), [integration](INTEGRATION.md).

## Client contract

### Optimistic update, then PATCH

The calendar applies each mutation optimistically and dispatches
`calendar:eventmove` / `calendar:eventresize` with
`detail.{ previous, current, nativeEvent, revert }`. The adapter sends one
`PATCH` per **finished semantic gesture**:

- pointer drop after a drag;
- resize handle release;
- external editor/form save (via `updateEvent` / `moveEvent` / `resizeEvent`);
- resource change commit.

Never during the gesture itself: no per-pixel stream, no commit on
`pointermove`. A short client debounce (a few hundred milliseconds per
event) may absorb a drop followed by an immediate nudge, but the adapter
never holds confirmed state local-only for seconds.

### PATCH payload

```js
PATCH /occurrences/:id
{
  id: "event-1",
  start: "2026-09-03T10:15:00+02:00[Europe/Brussels]",
  end: "2026-09-03T10:45:00+02:00[Europe/Brussels]",
  resourceId: "room-a",
  revision: 42,          // expected server revision (If-Match style)
  mutationId: "…",       // unique per commit, for echo deduplication
  clientId: "…",         // stable per client session, marks the origin
  origin: "drag",        // "drag" | "resize" | "edit" | "keyboard" | "paste"
}
```

| Field        | Purpose                                                     |
| ------------ | ----------------------------------------------------------- |
| `revision`   | Concurrency: the server accepts only the expected revision  |
| `mutationId` | Lets the sender recognize its own realtime echo             |
| `clientId`   | Marks where the mutation came from (audit, multi-tab)       |
| `origin`     | Semantic gesture kind, for the audit trail                  |

`start`/`end` are `Temporal.ZonedDateTime` values or ISO strings with
offset and IANA zone, as elsewhere in the core.

### Conflicts

When the expected `revision` no longer matches, the server answers
`409 Conflict` with the current canonical state. The adapter never reverts
blindly; it offers the choice:

```text
"This occurrence was changed by someone else."
[Reload] [Reapply my change]
```

- **Reload** applies the server state (`updateEvent` / refetch).
- **Reapply** re-commits the local `current` on top of the fresh base
  (a new `moveEvent` with a new `mutationId`).
- Field-level auto-merge is a later concern, not a POC one.

## Realtime

The server broadcasts every accepted mutation over the application's
transport (WebSocket / SSE / polling — external to the core):

```js
{ type: "created" | "updated" | "deleted", event?, id?, revision, mutationId, clientId }
```

- `revision` gives the order of canonical states.
- `mutationId` identifies the sender's own echo, which is ignored locally.
- Anything else is applied through `addEvent` / `updateEvent` /
  `removeEvent`, so all clients converge on the canonical state.

## Backend responsibilities

- **Audit** accepted semantic mutations (`before` / `after` / actor /
  `origin` / timestamp). Gesture internals (pointer path) are never stored.
- **External effects outside the UI transaction**: after a change that may
  have an external effect, the server schedules a deferred notification
  job. A later change may replace or invalidate the pending job, and the
  job must verify it still represents the state to notify before sending.
  This document prescribes no queue, delay, or cancellation technique.
- **Significance is a business rule**, computed from the consolidated
  before → after (never from intermediate steps), and it decides only the
  business consequences — never whether the change is saved. As an example,
  a backend *may* notify when the day changed, the resource changed, or the
  start/duration moved beyond its own threshold, and stay silent when the
  final state equals the initial one. Thresholds and audiences belong to the
  consuming project, not to this contract.

## Non-goals

- No explicit per-gesture "Confirm" button in normal calendar use
  (transactional multi-event workflows are a separate application concern).
- No field-level conflict merge in the POC.
- No notification, approval, or webhook protocol exposed to the calendar:
  other consumers remain free to choose immediate save without
  notification, human approval, instant webhooks, or nightly batches.
