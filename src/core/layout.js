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
 */
export function layoutEvents(items) {
  const sorted = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);

  const groups = [];
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

  const placed = new Map();
  for (const group of groups) {
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
      placed.get(item.index).columns = columns.length;
    }
  }

  return items.map((item, index) => {
    const { column, columns } = placed.get(index);
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
