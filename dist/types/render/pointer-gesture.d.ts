/**
 * Track one captured pointer gesture and guarantee a single, explicit
 * lifecycle for it. The primitive owns browser mechanics only: pointer
 * identity, best-effort capture, the movement threshold and cleanup. Target
 * resolution, snapping, policy and commits stay in the renderer that starts
 * the gesture.
 *
 * `onCleanup` runs exactly once, before `onEnd`/`onCancel`. It is where a
 * caller removes mirrors, stops autoscroll and drops temporary classes.
 * `dispose()` is the deterministic cancellation path when the calendar
 * itself replaces the node under an active gesture; `lostpointercapture`
 * remains the safety net for browser-initiated interruptions.
 *
 * @param {object} input
 * @param {HTMLElement} input.target element receiving the pointer events
 * @param {PointerEvent} input.event initiating pointerdown
 * @param {number} [input.threshold] movement in pixels before `onMove` runs
 * @param {(event: PointerEvent, state: { moved: boolean }) => void} input.onMove
 * @param {(event: PointerEvent, state: { moved: boolean }) => void} input.onEnd
 * @param {(reason: "pointercancel" | "lostpointercapture" | "dispose") => void} [input.onCancel]
 * @param {() => void} [input.onCleanup]
 * @returns {{ dispose: () => void }}
 */
export declare function startPointerGesture({ target, event, threshold, onMove, onEnd, onCancel, onCleanup }: {
    target: HTMLElement;
    event: PointerEvent;
    threshold?: number;
    onMove: (event: PointerEvent, state: {
        moved: boolean;
    }) => void;
    onEnd: (event: PointerEvent, state: {
        moved: boolean;
    }) => void;
    onCancel?: (reason: "pointercancel" | "lostpointercapture" | "dispose") => void;
    onCleanup?: () => void;
}): {
    dispose: () => void;
};
//# sourceMappingURL=pointer-gesture.d.ts.map