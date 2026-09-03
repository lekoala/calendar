import { CalendarViewElement } from "./calendar-view.js";

export { CalendarViewElement };
export function defineCalendarView(name = "calendar-view") {
  if (!customElements.get(name)) {
    customElements.define(name, CalendarViewElement);
  }
}
