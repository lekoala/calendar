/**
 * Sort a copy for month presentation. Comparator ties use the canonical
 * start instant, then stable source order; canonical state is never sorted.
 *
 * @param {import("./model.js").NormalizedEvent[]} events
 * @param {string} timeZone
 * @param {((a: import("./model.js").NormalizedEvent, b: import("./model.js").NormalizedEvent) => number)} [compare]
 * @returns {import("./model.js").NormalizedEvent[]}
 */
export declare function orderMonthEvents(events: import("./model.js").NormalizedEvent[], timeZone: string, compare?: ((a: import("./model.js").NormalizedEvent, b: import("./model.js").NormalizedEvent) => number)): import("./model.js").NormalizedEvent[];
//# sourceMappingURL=event-order.d.ts.map