import { CalendarViewElement } from "./calendar-view.js";
import { DEFAULT_LABELS, formatLabel, resolveLabels } from "./core/labels.js";

export { CalendarViewElement, DEFAULT_LABELS, formatLabel, resolveLabels };
export function defineCalendarView(name = "calendar-view") {
  if (!customElements.get(name)) {
    customElements.define(name, CalendarViewElement);
  }
}
