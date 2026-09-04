import { CalendarViewElement } from "./calendar-view.js";
import { DEFAULT_LABELS, formatLabel, resolveLabels } from "./core/labels.js";
import { queryOverlaps, rangesOverlap } from "./core/overlaps.js";

export { CalendarViewElement, DEFAULT_LABELS, formatLabel, queryOverlaps, rangesOverlap, resolveLabels };
export function defineCalendarView(name = "calendar-view") {
  if (!customElements.get(name)) {
    customElements.define(name, CalendarViewElement);
  }
}
