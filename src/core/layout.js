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
export function layoutEvents(items) {
  const sorted = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);

  /** @type {Array<{ end: number, items: Array<{ event: T, start: number, end: number, index: number }> }>} */
  const groups = [];
  /** @type {{ end: number, items: Array<{ event: T, start: number, end: number, index: number }> } | null} */
  let current = null;
  for (const item of sorted) {
    if (!current || item.start >= current.end) {
      current = { end: item.end, items: [] };
      groups.push(current);
    } else if (item.end > current.end) {
      current.end = item.end;
    }
    current.items.push(item);
  }

  /** @type {Map<number, { column: number, columns: number }>} */
  const placed = new Map();
  for (const group of groups) {
    /** @type {number[]} */
    const columns = [];
    for (const item of group.items) {
      let column = columns.findIndex((lastEnd) => lastEnd <= item.start);
      if (column < 0) {
        column = columns.length;
        columns.push(item.end);
      } else {
        columns[column] = item.end;
      }
      placed.set(item.index, { column, columns: 0 });
    }
    for (const item of group.items) {
      /** @type {{ column: number, columns: number }} */
      const placement = /** @type {any} */ (placed.get(item.index));
      placement.columns = columns.length;
    }
  }

  return items.map((item, index) => {
    /** @type {{ column: number, columns: number }} */
    const placement = /** @type {any} */ (placed.get(index));
    const { column, columns } = placement;
    return {
      event: item.event,
      start: item.start,
      end: item.end,
      column,
      columns,
      left: column / columns,
      width: 1 / columns,
    };
  });
}

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
export function layoutDaySegments(segments) {
  const sorted = segments
    .map((segment, index) => ({ ...segment, index }))
    .sort((a, b) => a.startDay - b.startDay || b.endDay - a.endDay || a.index - b.index);
  /** @type {Array<Array<{ resourceId: string | null, end: number }>>} */
  const rows = [];
  /** @type {Map<number, number>} */
  const assigned = new Map();
  for (const segment of sorted) {
    let row = rows.findIndex((entries) =>
      entries.every((entry) => entry.resourceId !== segment.resourceId || entry.end <= segment.startDay),
    );
    if (row < 0) {
      row = rows.length;
      rows.push([]);
    }
    rows[row].push({ resourceId: segment.resourceId, end: segment.endDay });
    assigned.set(segment.index, row);
  }
  return segments.map((segment, index) => ({
    ...segment,
    row: /** @type {number} */ (assigned.get(index)),
  }));
}
