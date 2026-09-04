/**
 * Overlap layout for events within a single day column.
 *
 * Input items carry numeric ranges so the core stays independent of the
 * date/time representation used at the boundary:
 *
 * ```js
 * layoutEvents([{ event, start: 540, end: 570 }])
 * // -> [{ event, column, columns, left, width }]
 * ```
 *
 * Rules:
 * - events are grouped transitively: A overlaps B and B overlaps C puts
 *   all three in one group even when A never meets C;
 * - adjacent events (`end === start`) never overlap;
 * - columns are assigned greedily in start order, so placement is
 *   deterministic regardless of input order;
 * - `left`/`width` are fractions of the column width.
 *
 * @template T
 * @param {Array<{ event: T, start: number, end: number }>} items
 * @returns {Array<{ event: T, start: number, end: number, column: number, columns: number, left: number, width: number }>}
 */
export declare function layoutEvents<T>(items: Array<{
    event: T;
    start: number;
    end: number;
}>): Array<{
    event: T;
    start: number;
    end: number;
    column: number;
    columns: number;
    left: number;
    width: number;
}>;
/**
 * Row packing for the all-day lane over a fixed set of visible civil dates.
 * Segments carry day indices into those dates (`endDay` exclusive) and a
 * `resourceId`: collisions only happen inside one resource block, so bars of
 * different rooms never fight for a row, while bars of the same room stack
 * exactly like the day column does with `layoutEvents`.
 *
 * Only civil-day geometry is involved, never instants: a 23- or 25-hour DST
 * day occupies one index either way.
 *
 * @template T
 * @param {Array<{ event: T, resourceId: string | null, startDay: number, endDay: number }>} segments
 * @returns {Array<{ event: T, resourceId: string | null, startDay: number, endDay: number, row: number }>}
 */
export declare function layoutDaySegments<T>(segments: Array<{
    event: T;
    resourceId: string | null;
    startDay: number;
    endDay: number;
}>): Array<{
    event: T;
    resourceId: string | null;
    startDay: number;
    endDay: number;
    row: number;
}>;
//# sourceMappingURL=layout.d.ts.map