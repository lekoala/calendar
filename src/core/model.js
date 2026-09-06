import { Temporal } from "temporal-polyfill";

/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} [title]
 * @property {unknown} start
 * @property {unknown} end
 * @property {string | null} [resourceId]
 * @property {boolean} [allDay] when true, boundaries are civil `Temporal.PlainDate` (half-open `[start, end)`)
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @typedef {Required<Pick<CalendarEvent, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarEvent} NormalizedEvent
 */

/**
 * Unvalidated input: sources and application code may pass partial or
 * mistyped payloads, which normalization either completes or rejects.
 *
 * @typedef {object} EventInput
 * @property {unknown} [id]
 * @property {string} [title]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string | null} [resourceId]
 * @property {boolean} [allDay]
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @typedef {object} CalendarResource
 * @property {string} id
 * @property {string} [title]
 * @property {boolean} [selectable]
 * @property {boolean} [droppable]
 * @property {string} [groupId] id of the single-level visual group this resource belongs to
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @typedef {object} CalendarBackground
 * @property {string} id
 * @property {unknown} start
 * @property {unknown} end
 * @property {string} [resourceId]
 * @property {boolean} [allDay] when true, boundaries are civil `Temporal.PlainDate`
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * Canonical boundary value for one event/background end. Timed ranges use
 * `Temporal.ZonedDateTime` instances; all-day ranges use `Temporal.PlainDate`
 * civil dates. Both keep the same half-open `[start, end)` contract, and the
 * conversion is strict: an `allDay` flag never changes the nature of already
 * dated input, and neither type silently accepts the other.
 *
 * @param {unknown} value
 * @param {boolean} allDay
 * @returns {Temporal.ZonedDateTime | Temporal.PlainDate}
 */
export function normalizeRangeBound(value, allDay) {
  if (allDay) {
    if (value instanceof Temporal.PlainDate) return value;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Temporal.PlainDate.from(value);
    }
    throw new TypeError("All-day boundaries must be Temporal.PlainDate or YYYY-MM-DD strings");
  }
  if (value instanceof Temporal.ZonedDateTime) return value;
  if (typeof value === "string") {
    try {
      return Temporal.ZonedDateTime.from(value);
    } catch {
      // Date-only strings never parse as instants; fall through to the
      // strict error so mis-flagged all-day input fails loudly.
    }
  }
  throw new TypeError("Timed boundaries must be Temporal.ZonedDateTime or ISO strings with a zone");
}

/**
 * @param {EventInput} event
 * @returns {NormalizedEvent}
 */
export function normalizeEvent(event) {
  if (!event || event.id == null || event.start == null || event.end == null) {
    throw new TypeError("Event requires id, start and end");
  }
  const { classNames, extendedProps, start, end, allDay = false, ...rest } = event;
  // No `editable` default here on purpose: an injected `true` would outrank
  // `configure({ editable: false })` in `isMovable`/`isResizable`, which
  // resolve the event flags *then* the calendar default. An event that omits
  // the flag stays undecided so the calendar keeps the last word.
  return /** @type {NormalizedEvent} */ ({
    ...rest,
    id: String(event.id),
    allDay,
    start: /** @type {Temporal.ZonedDateTime | Temporal.PlainDate} */ (normalizeRangeBound(start, allDay)),
    end: /** @type {Temporal.ZonedDateTime | Temporal.PlainDate} */ (normalizeRangeBound(end, allDay)),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
}

/**
 * Equality of one range boundary. Timed and civil bounds never compare equal
 * across types, mirroring the strictness of `normalizeRangeBound`.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function sameBound(a, b) {
  if (a === b) return true;
  if (a instanceof Temporal.ZonedDateTime && b instanceof Temporal.ZonedDateTime) return a.equals(b);
  if (a instanceof Temporal.PlainDate && b instanceof Temporal.PlainDate) return a.equals(b);
  return false;
}

/**
 * Structural equality over the three fields a move/resize commit owns.
 * Callers use it to check that a placement they applied is still the one in
 * state before undoing it.
 *
 * @param {{ start?: unknown, end?: unknown, resourceId?: string | null }} a
 * @param {{ start?: unknown, end?: unknown, resourceId?: string | null }} b
 * @returns {boolean}
 */
export function sameRange(a, b) {
  return (
    sameBound(a.start, b.start) &&
    sameBound(a.end, b.end) &&
    (a.resourceId ?? null) === (b.resourceId ?? null)
  );
}

/**
 * @param {Partial<CalendarEvent>} event
 * @param {boolean} [calendarEditable]
 * @returns {boolean}
 */
export function isMovable(event, calendarEditable) {
  return event.movable ?? event.editable ?? calendarEditable ?? true;
}

/**
 * @param {Partial<CalendarEvent>} event
 * @param {boolean} [calendarEditable]
 * @returns {boolean}
 */
export function isResizable(event, calendarEditable) {
  return event.resizable ?? event.editable ?? calendarEditable ?? true;
}

/**
 * @typedef {Required<Pick<CalendarResource, "id" | "title" | "classNames" | "extendedProps">> & CalendarResource} NormalizedResource
 */

/**
 * @typedef {object} ResourceInput
 * @property {unknown} [id]
 * @property {string} [title]
 * @property {boolean} [selectable]
 * @property {boolean} [droppable]
 * @property {string} [groupId]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @param {ResourceInput} resource
 * @returns {NormalizedResource}
 */
export function normalizeResource(resource) {
  if (!resource || resource.id == null) {
    throw new TypeError("Resource requires id");
  }
  const { classNames, extendedProps, groupId, ...rest } = resource;
  return /** @type {NormalizedResource} */ ({
    title: String(resource.id),
    selectable: true,
    droppable: true,
    ...rest,
    ...(groupId == null ? {} : { groupId: String(groupId) }),
    id: String(resource.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
}

/**
 * One-level visual resource grouping. Grouping is ordering and labels only:
 * the group never filters, selects or constrains its members, and it has no
 * children by design — one level is the whole contract.
 *
 * @typedef {object} CalendarResourceGroup
 * @property {string} id
 * @property {string} [title]
 */

/**
 * @typedef {Required<Pick<CalendarResourceGroup, "id" | "title">> & CalendarResourceGroup} NormalizedResourceGroup
 */

/**
 * @typedef {object} ResourceGroupInput
 * @property {unknown} [id]
 * @property {string} [title]
 */

/**
 * @param {ResourceGroupInput} resourceGroup
 * @returns {NormalizedResourceGroup}
 */
export function normalizeResourceGroup(resourceGroup) {
  if (!resourceGroup || resourceGroup.id == null) {
    throw new TypeError("Resource group requires id");
  }
  return /** @type {NormalizedResourceGroup} */ ({
    ...resourceGroup,
    id: String(resourceGroup.id),
    title: String(resourceGroup.title ?? resourceGroup.id),
  });
}

/**
 * @typedef {Required<Pick<CalendarBackground, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarBackground} NormalizedBackground
 */

/**
 * @typedef {object} BackgroundInput
 * @property {unknown} [id]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string} [resourceId]
 * @property {boolean} [allDay]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @param {BackgroundInput} background
 * @returns {NormalizedBackground}
 */
export function normalizeBackground(background) {
  if (!background || background.id == null || background.start == null || background.end == null) {
    throw new TypeError("Background requires id, start and end");
  }
  const { classNames, extendedProps, start, end, allDay = false, ...rest } = background;
  return /** @type {NormalizedBackground} */ ({
    ...rest,
    id: String(background.id),
    allDay,
    start: /** @type {Temporal.ZonedDateTime | Temporal.PlainDate} */ (normalizeRangeBound(start, allDay)),
    end: /** @type {Temporal.ZonedDateTime | Temporal.PlainDate} */ (normalizeRangeBound(end, allDay)),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
}
