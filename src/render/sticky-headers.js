/**
 * Stack sticky rows using their actual border-box heights. Custom content
 * can change those heights after render, for example when an image loads.
 *
 * @param {HTMLElement} scroller
 * @returns {(() => void) | null}
 */
export function observeStickyHeaders(scroller) {
  const resourceRow = scroller.querySelector(":scope > .cv-resource-row");
  if (!resourceRow) return null;
  const groupRow = scroller.querySelector(":scope > .cv-group-row");
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const property = entry.target === groupRow ? "--cv-group-row-height" : "--cv-resource-row-height";
      scroller.style.setProperty(property, `${entry.borderBoxSize[0].blockSize}px`);
    }
  });
  observer.observe(resourceRow, { box: "border-box" });
  if (groupRow) observer.observe(groupRow, { box: "border-box" });
  return () => observer.disconnect();
}
