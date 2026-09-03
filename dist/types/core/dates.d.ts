import { Temporal } from "temporal-polyfill";
/**
 * @param {Temporal.PlainDate | string} value
 * @returns {Temporal.PlainDate}
 */
export declare function toPlainDate(value: Temporal.PlainDate | string): Temporal.PlainDate;
/**
 * @param {string} view
 * @returns {number}
 */
export declare function getViewDays(view: string): number;
/**
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export declare function getViewRange(date: Temporal.PlainDate | string, view: string): {
    start: Temporal.PlainDate;
    end: Temporal.PlainDate;
};
/**
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @returns {Temporal.PlainDate[]}
 */
export declare function getVisibleDates(date: Temporal.PlainDate | string, view: string): Temporal.PlainDate[];
/**
 * @param {string} view
 * @returns {boolean}
 */
export declare function isResourceView(view: string): boolean;
/**
 * @param {string} view
 * @returns {boolean}
 */
export declare function isMonthView(view: string): boolean;
/**
 * Full Monday → Sunday weeks covering the anchor date's calendar month,
 * including leading/trailing days of adjacent months. Week start is ISO
 * Monday; a `weekStart` option stays a future extension.
 *
 * @param {Temporal.PlainDate | string} date
 * @returns {Temporal.PlainDate[][]}
 */
export declare function getMonthWeeks(date: Temporal.PlainDate | string): Temporal.PlainDate[][];
/**
 * Visible month range with an exclusive end, matching the `getViewRange`
 * convention sources rely on.
 *
 * @param {Temporal.PlainDate | string} date
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export declare function getMonthRange(date: Temporal.PlainDate | string): {
    start: Temporal.PlainDate;
    end: Temporal.PlainDate;
};
/**
 * @param {Temporal.PlainTime | string} value
 * @returns {Temporal.PlainTime}
 */
export declare function parseClock(value: Temporal.PlainTime | string): Temporal.PlainTime;
/**
 * @param {Temporal.PlainTime | string} value
 * @returns {number}
 */
export declare function minutesFromMidnight(value: Temporal.PlainTime | string): number;
/**
 * @param {Temporal.Duration | Parameters<typeof Temporal.Duration.from>[0]} duration
 * @returns {number}
 */
export declare function durationMinutes(duration: Temporal.Duration | Parameters<typeof Temporal.Duration.from>[0]): number;
/**
 * @param {Temporal.PlainDate | string} date
 * @param {number} minutes
 * @param {string} timeZone
 * @returns {Temporal.ZonedDateTime}
 */
export declare function zonedDateTimeAt(date: Temporal.PlainDate | string, minutes: number, timeZone: string): Temporal.ZonedDateTime;
/**
 * @param {number} minutes
 * @returns {string}
 */
export declare function formatClock(minutes: number): string;
//# sourceMappingURL=dates.d.ts.map