import { Temporal } from "temporal-polyfill";
export type DateDerivationOptions = {
    /**
     * first weekday of a civil week, ISO 1-7 (default 1, Monday)
     */
    firstDay?: number;
    /**
     * weekdays never rendered, ISO 1-7
     */
    hiddenDays?: Iterable<number>;
};
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
 * @param {string} view
 * @returns {boolean}
 */
export declare function isWeekAnchoredView(view: string): boolean;
/**
 * Start of the civil week containing `date`.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {number} [firstDay] ISO 1-7, default Monday
 * @returns {Temporal.PlainDate}
 */
export declare function startOfWeek(date: Temporal.PlainDate | string, firstDay?: number): Temporal.PlainDate;
/**
 * Visible range with an exclusive end, covering every rendered date. Hidden
 * days shrink what is rendered but not what a source is asked for: the range
 * always spans from the first to the last rendered day.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {DateDerivationOptions} [options]
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export declare function getViewRange(date: Temporal.PlainDate | string, view: string, options?: DateDerivationOptions): {
    start: Temporal.PlainDate;
    end: Temporal.PlainDate;
};
/**
 * Dates rendered as columns or groups.
 *
 * Week-anchored views derive the civil week containing the anchor and then
 * drop hidden days, because a week is a fixed civil unit: hiding Sunday
 * leaves six columns. Rolling views instead fill their day count with
 * visible days, because `threeDays` means three usable days, not three
 * calendar days of which one may be blank.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate[]}
 */
export declare function getVisibleDates(date: Temporal.PlainDate | string, view: string, options?: DateDerivationOptions): Temporal.PlainDate[];
/**
 * Anchor date for the previous (`-1`) or next (`1`) range.
 *
 * Month steps by calendar months and week-anchored views by whole weeks, so
 * both keep the anchor weekday. Rolling views step by their own count of
 * visible days rather than by a fixed number of calendar days, so hidden
 * days never make two consecutive ranges overlap or skip a day.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {-1 | 1} direction
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate}
 */
export declare function stepAnchor(date: Temporal.PlainDate | string, view: string, direction: -1 | 1, options?: DateDerivationOptions): Temporal.PlainDate;
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
 * Weeks covering the anchor date calendar month, starting on `firstDay` and
 * with hidden days removed, so every row keeps the same length and the grid
 * stays rectangular.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate[][]}
 */
export declare function getMonthWeeks(date: Temporal.PlainDate | string, options?: DateDerivationOptions): Temporal.PlainDate[][];
/**
 * Visible month range with an exclusive end, matching the `getViewRange`
 * convention sources rely on. Hidden days do not shrink it: the grid still
 * spans whole weeks, and asking a source for a day that is not rendered is
 * harmless where asking for too little is not.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {DateDerivationOptions} [options]
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export declare function getMonthRange(date: Temporal.PlainDate | string, options?: DateDerivationOptions): {
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