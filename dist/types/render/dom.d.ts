/**
 * A missing hook result leaves the caller free to render its default.
 *
 * @param {HTMLElement} element
 * @param {unknown} content
 */
export declare function applyContent(element: HTMLElement, content: unknown): boolean;
/**
 * @template T
 * @param {EventTarget} target
 * @param {string} name
 * @param {T} detail
 * @param {{ cancelable?: boolean }} [options]
 */
export declare function emitCalendarEvent<T>(target: EventTarget, name: string, detail: T, { cancelable }?: {
    cancelable?: boolean;
}): boolean;
/**
 * Hit-test in the same tree as the renderer so shadow hosts do not hide
 * the elements inside them.
 *
 * @param {Element} origin
 * @param {number} x
 * @param {number} y
 */
export declare function elementAtPoint(origin: Element, x: number, y: number): Element | null;
/**
 * Dispatch a cancelable context intent. When the application handles the
 * intent (`preventDefault()` on the dispatched event), the native browser
 * menu is suppressed; otherwise it is left alone.
 *
 * @param {Element} target
 * @param {object} detail
 * @param {Event} nativeEvent
 * @returns {void}
 */
export declare function dispatchContextMenu(target: Element, detail: object, nativeEvent: Event): void;
//# sourceMappingURL=dom.d.ts.map