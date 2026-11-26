import { eventGeometry } from "./geometry.js";
import { layoutEvents } from "./layout.js";
import { backgroundAppliesToColumn, eventBelongsToColumn } from "./resources.js";
import { sliceTimedEventForDay } from "./slicing.js";

/**
 * Clip timed ranges to one column and compute their positions before painting.
 *
 * @param {import("./resources.js").TimeGridColumn} column
 * @param {import("./model.js").NormalizedEvent[]} events
 * @param {import("./model.js").NormalizedBackground[]} backgrounds
 * @param {{ timeZone: string, slotMin: number, slotMax: number, pxPerMinute: number }} options
 */
export function deriveTimedColumn(column, events, backgrounds, options) {
  const dayEvents = [];
  for (const event of events) {
    if (event.allDay === true || !eventBelongsToColumn(event, column)) continue;
    const slice = sliceTimedEventForDay(event, column.date, options);
    if (slice) dayEvents.push({ event, ...slice });
  }

  const dayBackgrounds = [];
  for (const background of backgrounds) {
    if (background.allDay === true || !backgroundAppliesToColumn(background, column)) continue;
    const slice = sliceTimedEventForDay(background, column.date, options);
    if (!slice) continue;
    const geometry = eventGeometry({
      startMinutes: slice.start,
      endMinutes: slice.end,
      dayStartMinutes: options.slotMin,
      pxPerMinute: options.pxPerMinute,
      gap: 0,
    });
    dayBackgrounds.push({ background, ...slice, geometry });
  }

  return {
    events: layoutEvents(dayEvents).map((item) => ({
      ...item,
      geometry: eventGeometry({
        startMinutes: item.start,
        endMinutes: item.end,
        dayStartMinutes: options.slotMin,
        pxPerMinute: options.pxPerMinute,
      }),
    })),
    backgrounds: dayBackgrounds,
  };
}
