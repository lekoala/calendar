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
    /**
     * BCP 47 tag suggesting `firstDay` when none is explicit; never parsed for math
     */
    locale?: string;
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
 * Contract for external navigators (mini-calendars): the result holds the
 * true civil weeks of the month — full 7-day rows from `firstDay`, 4 to 6
 * rows depending on the month, never padded to a fixed height. Row count
 * stability (e.g. an always-6-row mini grid) is a presentation choice and
 * belongs to the consumer. Rows are rectangular only when no hidden days
 * are configured; with hidden days each row keeps the same visible days.
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
/**
 * Normalize a locale option. Blank strings behave as "no locale" so empty
 * attributes and sloppy configuration fall back to the runtime default.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export declare function resolveLocale(value: unknown): string | undefined;
/**
 * First weekday suggested by a BCP 47 locale tag, ISO 1-7, or null when the
 * runtime cannot tell (no week-info support, unknown tag). Never throws and
 * never does date math: presentation hint only.
 *
 * @param {string} locale
 * @returns {number | null}
 */
export declare function firstDayFromLocale(locale: string): number | null;
/**
 * Locale-aware day-column header default, e.g. `Thu, 9/3` in English.
 * Hooks (`dayHeaderContent`) stay authoritative; this only feeds the fallback.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string | undefined} locale BCP 47 tag, or undefined for the runtime default
 * @returns {string}
 */
export declare function formatDayHeader(date: Temporal.PlainDate | string, locale: string | undefined): string;
/**
 * Locale-aware time-axis label default, e.g. `8:00 AM` in English.
 * `slotLabelContent` stays authoritative; this only feeds the fallback.
 * Out-of-`PlainTime` edges such as `24:00` keep the legacy 24h rendering.
 *
 * @param {number} minutes minutes after midnight
 * @param {string | undefined} locale BCP 47 tag, or undefined for the runtime default
 * @returns {string}
 */
export declare function formatSlotLabel(minutes: number, locale: string | undefined): string;
//# sourceMappingURL=dates.d.ts.map