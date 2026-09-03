/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} [title]
 * @property {unknown} start
 * @property {unknown} end
 * @property {string} [resourceId]
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @typedef {Required<Pick<CalendarEvent, "id" | "classNames" | "extendedProps">> & CalendarEvent} NormalizedEvent
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
 * @property {string} [resourceId]
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
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @typedef {object} CalendarBackground
 * @property {string} id
 * @property {unknown} start
 * @property {unknown} end
 * @property {string} [resourceId]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @param {EventInput} event
 * @returns {NormalizedEvent}
 */
export function normalizeEvent(event) {
  if (!event || event.id == null || !event.start || !event.end) {
    throw new TypeError("Event requires id, start and end");
  }
  const { classNames, extendedProps, ...rest } = event;
  return /** @type {NormalizedEvent} */ ({
    editable: true,
    ...rest,
    id: String(event.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
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
  const { classNames, extendedProps, ...rest } = resource;
  return /** @type {NormalizedResource} */ ({
    title: String(resource.id),
    selectable: true,
    droppable: true,
    ...rest,
    id: String(resource.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
}

/**
 * @typedef {Required<Pick<CalendarBackground, "id" | "classNames" | "extendedProps">> & CalendarBackground} NormalizedBackground
 */

/**
 * @typedef {object} BackgroundInput
 * @property {unknown} [id]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string} [resourceId]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */

/**
 * @param {BackgroundInput} background
 * @returns {NormalizedBackground}
 */
export function normalizeBackground(background) {
  if (!background || background.id == null || !background.start || !background.end) {
    throw new TypeError("Background requires id, start and end");
  }
  const { classNames, extendedProps, ...rest } = background;
  return /** @type {NormalizedBackground} */ ({
    ...rest,
    id: String(background.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  });
}
