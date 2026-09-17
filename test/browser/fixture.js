import assert from "node:assert/strict";
import { expect } from "@playwright/test";

/**
 * Shared fixture-readiness seam for the browser suites.
 *
 * Every demo marks its first *configured* render with
 * `html[data-calendar-ready]`: the element renders once on connect (neutral
 * UTC defaults) before the demo module applies its fixture, and `goto` does
 * not wait for the configured tree. Interacting earlier touches the
 * pre-config tree (wrong zone, transient nodes). `openDemo` waits for the
 * signal; `flushRender` stays the tool for renders the test itself causes.
 *
 * Coordinate helpers below read live geometry in atomic evaluates. Points
 * for one gesture are measured together in a single layout state (at most
 * one scroll): a scroll between press and move cancels the press on touch
 * engines and restarts the gesture at the second point. Snap/duration/zone
 * semantics belong to the core unit tests; the browser only converts civil
 * times to client points and asserts rendered results.
 */

/**
 * Open a demo and wait for its first configured render.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} name demo file base name without extension
 */
export async function openDemo(page, name) {
  await page.goto(`/demo/${name}.html`);
  await expect(page.locator("html")).toHaveAttribute("data-calendar-ready", "");
}

/**
 * Client points for civil wall times inside day columns. Every point is
 * measured in one atomic evaluate — one layout state, at most one scroll —
 * because a scroll between press and move cancels the press on touch engines
 * and restarts the gesture at the second point.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Array<{ date?: string, resourceId?: string, time: string }>} targets
 * civil day (`YYYY-MM-DD`, default first column), resource column
 * (`data-resource-id`, default first match) and wall time (`HH:MM`)
 * @returns {Promise<Array<{ x: number, y: number }>>}
 */
export async function slotPoints(page, targets) {
  const points = await page.evaluate(
    (specs) => {
      const days = new Map();
      for (const spec of specs) {
        const key = `${spec.wanted ?? ""}|${spec.resource ?? ""}`;
        if (!days.has(key)) {
          const scope =
            spec.wanted != null
              ? `.cv-day[data-date="${spec.wanted}"]${spec.resource != null ? `[data-resource-id="${spec.resource}"]` : ""} .cv-day-body`
              : ".cv-day-body";
          days.set(key, document.querySelector(scope));
        }
      }
      const labels = [...document.querySelectorAll(".cv-axis-label")];
      const minutes = new Map();
      for (const label of labels) {
        const match = /^(\d{1,2}):(\d{2})/.exec(label.textContent ?? "");
        if (match) minutes.set(Number(match[1]) * 60 + Number(match[2]), label.getBoundingClientRect().y);
      }
      const rows = [...minutes.entries()].sort((a, b) => a[1] - b[1]);
      if (rows.length < 3) return null;
      // The first label sits below its hour line instead of straddling it,
      // so it names slotMin but cannot anchor the pitch: measure past it.
      const slotMin = rows[0][0];
      const pitch = (rows[2][1] - rows[1][1]) / 60;
      /** @param {DOMRect} rect @param {string} clock */
      const at = (rect, clock) => {
        const [hour, minute] = clock.split(":").map(Number);
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + (hour * 60 + minute - slotMin) * pitch,
        };
      };
      const read = () =>
        specs.map((spec) => {
          const rect = days.get(`${spec.wanted ?? ""}|${spec.resource ?? ""}`)?.getBoundingClientRect();
          return rect && rect.width > 0 && rect.height > 0 ? at(rect, spec.clock) : null;
        });
      let points = read();
      // Only scroll when a target point itself is outside the viewport, then
      // re-measure everything: blindly scrolling a taller-than-viewport column
      // can push other targets, like the all-day lane, out of view instead.
      if (points.some((point) => !point || point.y < 0 || point.y > window.innerHeight)) {
        const lowest = Math.max(...points.map((point) => point?.y ?? 0));
        window.scrollBy(0, lowest - window.innerHeight / 2);
        points = read();
      }
      /** @type {Array<{ x: number, y: number }>} */
      const done = [];
      for (const point of points) {
        if (!point) return null;
        done.push(point);
      }
      return done;
    },
    targets.map(({ date, resourceId, time }) => ({
      wanted: date ?? null,
      resource: resourceId ?? null,
      clock: time,
    })),
  );
  assert(points, "expected slot points");
  return points;
}

/**
 * Client point for a civil wall time inside a day column. Single-target
 * shorthand over {@link slotPoints}; gestures spanning several points must
 * use the batch form so every point shares one layout state.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{ date?: string, resourceId?: string, time: string }} target civil
 * day (`YYYY-MM-DD`, default first column), resource column
 * (`data-resource-id`, default first match) and wall time (`HH:MM`)
 * @returns {Promise<{ x: number, y: number }>}
 */
export async function slotPoint(page, target) {
  const [point] = await slotPoints(page, [target]);
  return point;
}

/**
 * Bounding box of a day-column body. No scrolling: callers only read the
 * column x from it (times go through slotPoint, which centers its own
 * target), so this stays out of the viewport's way.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} [date] civil day (`YYYY-MM-DD`), default first column
 * @returns {Promise<{ x: number, y: number, width: number, height: number }>}
 */
export async function dayBodyBox(page, date) {
  const box = await page.evaluate((wanted) => {
    const day =
      wanted != null
        ? document.querySelector(`.cv-day[data-date="${wanted}"] .cv-day-body`)
        : document.querySelector(".cv-day-body");
    const rect = day?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null;
  }, date ?? null);
  assert(box, `expected a day body for ${date ?? "first column"}`);
  return box;
}
