/**
 * Very small placeholder overlap layout.
 *
 * v0.1 TODO:
 * - build overlap groups;
 * - assign stable columns;
 * - expand events into free horizontal space where safe;
 * - preserve deterministic placement after incremental updates;
 * - test nested/chained/adjacent overlaps.
 */
export function layoutEvents(events) {
  return events.map((event) => ({
    event,
    column: 0,
    columns: 1,
    left: 0,
    width: 1,
  }));
}
