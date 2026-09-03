/**
 * Resource/date column derivation for the time grid.
 *
 * The core never infers the view from `resources.length`. The renderer
 * chooses explicitly:
 *
 * ```js
 * isResourceView(view)
 *   ? getResourceColumns(resources, dates)
 *   : getTimeGridColumns(dates)
 * ```
 *
 * Consequences:
 * - `timeGrid` with several resources in state still renders one column
 *   per date (`resource: null`);
 * - `resourceTimeGrid` with zero resources renders zero columns (explicit
 *   empty state, never a silent solo fallback).
 *
 * Event/background applicability is intentionally asymmetric:
 * - an event belongs to exactly one resource column; an event without
 *   `resourceId` is visible in solo views and hidden in resource views.
 *   Duplicating it across every resource would suggest N events while the
 *   model holds one;
 * - a background without `resourceId` is global context and applies to
 *   every column. Do not "unify" the two predicates in a refactor.
 */

/**
 * @typedef {object} TimeGridColumn
 * @property {import("temporal-polyfill").Temporal.PlainDate} date
 * @property {import("./model.js").CalendarResource | null} resource
 */

/**
 * Solo columns: one per date, no resource dimension.
 *
 * @param {Array<import("temporal-polyfill").Temporal.PlainDate>} dates
 * @returns {TimeGridColumn[]}
 */
export function getTimeGridColumns(dates) {
  return dates.map((date) => ({ date, resource: null }));
}

/**
 * Resource columns in `resource -> dates` order: all dates of resource A,
 * then all dates of resource B, and so on. An empty resource list yields
 * an empty column list.
 *
 * @param {Array<import("./model.js").CalendarResource>} resources
 * @param {Array<import("temporal-polyfill").Temporal.PlainDate>} dates
 * @returns {TimeGridColumn[]}
 */
export function getResourceColumns(resources, dates) {
  return resources.flatMap((resource) => dates.map((date) => ({ date, resource })));
}

/**
 * An event belongs to a column when the resource matches. Solo columns
 * (`resource: null`) accept every event; resource columns require an exact
 * `resourceId` match, so unassigned events stay hidden in resource grids.
 *
 * @param {{ resourceId?: string | null }} event
 * @param {TimeGridColumn} column
 * @returns {boolean}
 */
export function eventBelongsToColumn(event, column) {
  if (!column.resource) return true;
  return event.resourceId === column.resource.id;
}

/**
 * A background applies to a column when it is global (`resourceId` absent)
 * or targeted at that column's resource. Solo columns accept everything.
 *
 * @param {{ resourceId?: string | null }} background
 * @param {TimeGridColumn} column
 * @returns {boolean}
 */
export function backgroundAppliesToColumn(background, column) {
  if (!column.resource) return true;
  if (background.resourceId == null) return true;
  return background.resourceId === column.resource.id;
}
