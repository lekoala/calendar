import { Temporal } from "temporal-polyfill";

const VIEW_DAYS = {
  day: 1,
  threeDays: 3,
  week: 7,
  resourceDay: 1,
  resourceThreeDays: 3,
};

export function toPlainDate(value) {
  return value instanceof Temporal.PlainDate ? value : Temporal.PlainDate.from(value);
}

export function getViewDays(view) {
  return VIEW_DAYS[view] ?? 1;
}

export function getViewRange(date, view) {
  const start = toPlainDate(date);
  const end = start.add({ days: getViewDays(view) });
  return { start, end };
}

export function getVisibleDates(date, view) {
  const start = toPlainDate(date);
  const count = getViewDays(view);
  return Array.from({ length: count }, (_, index) => start.add({ days: index }));
}

export function isResourceView(view) {
  return view === "resourceDay" || view === "resourceThreeDays";
}

export function parseClock(value) {
  return Temporal.PlainTime.from(value);
}

export function minutesFromMidnight(value) {
  const time = value instanceof Temporal.PlainTime ? value : parseClock(value);
  return time.hour * 60 + time.minute + time.second / 60;
}
