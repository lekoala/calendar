import { CalendarViewElement, dates, defineCalendarView } from "../../dist/types/index.js";

const element = document.createElement("calendar-view") as CalendarViewElement;
element.configure({ timeZone: "Europe/Brussels", monthEventLimit: 3 });
element.setView("week");
element.gotoDate("2026-09-03");
element.prev();
element.next();
element.today();
void element.scrollToTime("10:00");
void element.getVisibleRange();
void element.getEventById("event-1");

const created = element.addEvent({
  id: "event-1",
  title: "Event",
  start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
  end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
});
void created;

void element.moveEvent("event-1", { resourceId: "resource-a" });
void element.resizeEvent("event-1", {});
void element.removeEvent("event-1");
element.batch(() => {
  element.resources = [{ id: "resource-a", title: "Resource A" }];
});
void element.refetchEvents();

const anchor = dates.toPlainDate("2026-09-03");
void dates.startOfWeek(anchor);
const weeks: unknown = dates.getMonthWeeks(anchor);
void weeks;

// Classic-script consumers reach the exact same object through a static.
void CalendarViewElement.dates.getMonthWeeks(anchor, { firstDay: 1 });
void CalendarViewElement.dates.startOfWeek(anchor);
void CalendarViewElement.dates.toPlainDate("2026-09-03");

defineCalendarView();
customElements.define("app-calendar-view", class extends CalendarViewElement {});

void CalendarViewElement;
void element;
