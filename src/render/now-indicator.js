import { Temporal } from "temporal-polyfill";
import { nowIndicatorMinutes } from "../core/temporal.js";

/**
 * Update only the clock markers, preserving event nodes and active gestures.
 * The owner cancels this timer before replacing the grid or disconnecting.
 *
 * @param {object} input
 * @param {Array<{ column: { date: Temporal.PlainDate }, body: HTMLElement }>} input.bodies
 * @param {string} input.timeZone
 * @param {number} input.slotMin
 * @param {number} input.slotMax
 * @param {number} input.pxPerMinute
 * @returns {() => void}
 */
export function startNowIndicator({ bodies, timeZone, slotMin, slotMax, pxPerMinute }) {
  /** @type {Map<HTMLElement, HTMLElement>} */
  const indicators = new Map();
  let timer = 0;
  const update = () => {
    const now = Temporal.Now.zonedDateTimeISO(timeZone);
    for (const { column, body } of bodies) {
      const minutes = nowIndicatorMinutes(now, column.date, slotMin, slotMax);
      let indicator = indicators.get(body);
      if (minutes === null) {
        indicator?.remove();
        indicators.delete(body);
        continue;
      }
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "cv-now";
        indicator.setAttribute("aria-hidden", "true");
        body.append(indicator);
        indicators.set(body, indicator);
      }
      indicator.style.top = `${(minutes - slotMin) * pxPerMinute}px`;
    }
    timer = window.setTimeout(update, 60_000 - (now.epochMilliseconds % 60_000));
  };
  update();
  return () => {
    clearTimeout(timer);
    for (const indicator of indicators.values()) indicator.remove();
    indicators.clear();
  };
}
