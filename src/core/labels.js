/**
 * Fixed UI strings rendered by the core. `locale` drives `Intl` date/time
 * formatting; `labels` drives the few remaining literal strings (empty
 * states, the `+n more` fallback, the region name, the untitled fallback).
 * English ships as the default; applications override per instance through
 * `configure({ labels })`. There is deliberately no async loader here:
 * fetching a translation file is transport and belongs to the application.
 *
 * @typedef {object} CalendarLabels
 * @property {string} noEvents text of an empty list day group
 * @property {string} noResources text when a resource view has no columns
 * @property {string} more month `+n more` fallback template, with a `{hidden}` placeholder
 * @property {string} calendarRegion accessible name of the scroll region
 * @property {string} untitledEvent fallback title for events without one
 * @property {string} allDaySlotLabel corner label of the all-day lane
 */

/** @type {CalendarLabels} */
export const DEFAULT_LABELS = {
  noEvents: "No events",
  noResources: "No resources selected.",
  more: "+{hidden} more",
  calendarRegion: "Calendar",
  untitledEvent: "Event",
  allDaySlotLabel: "All day",
};

const LABEL_PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Fill a label template. Unknown placeholders render empty rather than
 * leaking `{key}` into the UI.
 *
 * @param {string} template
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export function formatLabel(template, values) {
  return String(template ?? "").replace(LABEL_PLACEHOLDER_PATTERN, (_, key) => String(values[key] ?? ""));
}

/**
 * Merge an instance override over the shipped English defaults. Explicit
 * labels always win over locale-derived formatting.
 *
 * @param {Partial<CalendarLabels> | null | undefined} [input]
 * @returns {CalendarLabels}
 */
export function resolveLabels(input) {
  return { ...DEFAULT_LABELS, ...input };
}
