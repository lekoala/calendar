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
//# sourceMappingURL=layout.d.ts.map