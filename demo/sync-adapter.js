/**
 * Sync adapter helpers for the example consumer (see docs/SYNC_CONTRACT.md).
 *
 * Pure functions only: no timers, no change sets, no notifications, no DOM.
 * The calendar core stays generic; this module is application policy that a
 * demo or shell wires to `calendar:eventmove` / `calendar:eventresize` and
 * to its own transport.
 *
 * Field values accept `Temporal.ZonedDateTime` instances or ISO strings and
 * are normalized with `String()` before comparison or transport.
 */

/**
 * Recommended `origin` vocabulary for the audit trail. Callers pass the
 * string explicitly; anything outside this list still travels untouched.
 *
 * @type {Set<string>}
 */
export const SYNC_ORIGINS = new Set(["drag", "resize", "edit", "keyboard", "paste"]);

/**
 * Build the optimistic `PATCH` payload for one finished semantic gesture.
 * `revision` is the expected server revision (If-Match style), read from
 * `event.extendedProps.revision` unless `baseRevision` is given explicitly.
 *
 * @param {object} input
 * @param {{ id: string, extendedProps?: { revision?: unknown } }} input.event the optimistic event from the commit detail
 * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current the committed state
 * @param {string} input.origin semantic gesture kind, e.g. "drag"
 * @param {string} input.clientId stable identifier for this client session
 * @param {string} input.mutationId unique identifier for this commit
 * @param {number} [input.baseRevision] expected server revision override
 * @returns {{ id: string, start: string, end: string, resourceId: string | null, revision: number, mutationId: string, clientId: string, origin: string }}
 */
export function buildPatch({ event, current, origin, clientId, mutationId, baseRevision }) {
  const fallback = Number(event.extendedProps?.revision ?? 0);
  return {
    id: event.id,
    start: String(current.start),
    end: String(current.end),
    resourceId: current.resourceId ?? null,
    revision: baseRevision ?? (Number.isInteger(fallback) ? fallback : 0),
    mutationId,
    clientId,
    origin,
  };
}

/**
 * Decide whether an inbound realtime message is the sender's own echo.
 * Echoes carry the `mutationId` of a commit this client sent; anything else
 * (including third-party updates) must be applied.
 *
 * @param {{ mutationId?: unknown, revision?: unknown }} message inbound realtime message
 * @param {Iterable<string>} recentMutationIds `mutationId`s of commits sent by this client
 * @returns {boolean} true when the message must be ignored
 */
export function shouldIgnoreEcho(message, recentMutationIds) {
  if (message.mutationId == null) return false;
  for (const known of recentMutationIds) {
    if (known === message.mutationId) return true;
  }
  return false;
}

/**
 * Normalize one schedule state for comparison. Only scheduling geometry
 * participates: titles and metadata never cause a conflict decision.
 *
 * @param {{ start: unknown, end: unknown, resourceId?: string | null }} state
 * @returns {{ start: string, end: string, resourceId: string | null }}
 */
export function normalizeSchedule(state) {
  return {
    start: String(state.start),
    end: String(state.end),
    resourceId: state.resourceId ?? null,
  };
}

/**
 * Turn a `409 Conflict` answer into a UI decision. When the remote canonical
 * state already equals the local optimistic state the two sides converged
 * (e.g. the echo arrived first) and a silent reload is enough; otherwise the
 * application offers both branches and never reverts blindly.
 *
 * @param {object} input
 * @param {{ start: unknown, end: unknown, resourceId?: string | null }} input.local the optimistic state awaiting confirmation
 * @param {{ start: unknown, end: unknown, resourceId?: string | null, revision?: unknown }} input.remote the canonical server state from the 409 answer
 * @returns {{ action: "reload", remote: { start: string, end: string, resourceId: string | null } } | { action: "choose", reload: { start: string, end: string, resourceId: string | null }, reapply: { start: string, end: string, resourceId: string | null } }}
 */
export function decideOnConflict({ local, remote }) {
  const normalizedRemote = normalizeSchedule(remote);
  const normalizedLocal = normalizeSchedule(local);
  const converged =
    normalizedLocal.start === normalizedRemote.start &&
    normalizedLocal.end === normalizedRemote.end &&
    normalizedLocal.resourceId === normalizedRemote.resourceId;
  if (converged) return { action: "reload", remote: normalizedRemote };
  return { action: "choose", reload: normalizedRemote, reapply: normalizedLocal };
}

/**
 * Calendar mutation API subset used by realtime adapters.
 *
 * @typedef {object} CalendarMutations
 * @property {(event: unknown) => void} addEvent
 * @property {(event: unknown) => void} updateEvent
 * @property {(id: string | number) => void} removeEvent
 * @property {(fn: () => void) => void} batch
 */

/**
 * Apply one inbound realtime message through the calendar mutation API.
 * Unknown message types report `false` so the caller can log them instead of
 * crashing the stream. Remote updates inside one message batch together.
 *
 * @param {CalendarMutations} calendar subset of the calendar mutation API
 * @param {{ type: string, event?: { id: string }, id?: string | number }} message
 * @returns {boolean} true when a mutation ran
 */
export function applyRemoteUpdate(calendar, message) {
  if (message.type === "created" && message.event) {
    calendar.batch(() => calendar.addEvent(message.event));
    return true;
  }
  if (message.type === "updated" && message.event) {
    calendar.batch(() => calendar.updateEvent(message.event));
    return true;
  }
  if (message.type === "deleted" && message.id != null) {
    const id = message.id;
    calendar.batch(() => calendar.removeEvent(id));
    return true;
  }
  return false;
}
