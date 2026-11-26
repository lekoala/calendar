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
