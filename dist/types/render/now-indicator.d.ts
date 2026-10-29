import { Temporal } from "temporal-polyfill";
/**
 * Update only the clock markers, preserving event nodes and active gestures.
 * The owner cancels this timer before replacing the grid or disconnecting.
 *
 * @param {object} input
 * @param {Array<{ column: { date: Temporal.PlainDate }, body: HTMLElement }>} input.bodies
 * @param {string} input.timeZone
 * @param {number} input.slotMin
 * @param {number} input.slotMax
 * @param {number} input.pxPerMinute
 * @returns {() => void}
 */
export declare function startNowIndicator({ bodies, timeZone, slotMin, slotMax, pxPerMinute }: {
    bodies: Array<{
        column: {
            date: Temporal.PlainDate;
        };
        body: HTMLElement;
    }>;
    timeZone: string;
    slotMin: number;
    slotMax: number;
    pxPerMinute: number;
}): () => void;
//# sourceMappingURL=now-indicator.d.ts.map