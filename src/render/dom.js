/**
 * A missing hook result leaves the caller free to render its default.
 *
 * @param {HTMLElement} element
 * @param {unknown} content
 */
export function applyContent(element, content) {
  if (content == null) return false;
  if (content instanceof Node) element.append(content);
  else element.textContent = String(content);
  return true;
}

/**
 * @template T
 * @param {EventTarget} target
 * @param {string} name
 * @param {T} detail
 * @param {{ cancelable?: boolean }} [options]
 */
export function emitCalendarEvent(target, name, detail, { cancelable = false } = {}) {
  return target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }));
}

/**
 * Hit-test in the same tree as the renderer so shadow hosts do not hide
 * the elements inside them.
 *
 * @param {Element} origin
 * @param {number} x
 * @param {number} y
 */
export function elementAtPoint(origin, x, y) {
  const tree = origin.getRootNode();
  const hitRoot = tree instanceof ShadowRoot ? tree : origin.ownerDocument;
  return hitRoot.elementFromPoint(x, y);
}

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
export function dispatchContextMenu(target, detail, nativeEvent) {
  const handled = !target.dispatchEvent(
    new CustomEvent("calendar:eventcontextmenu", {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { ...detail, nativeEvent },
    }),
  );
  if (handled) nativeEvent.preventDefault?.();
}
