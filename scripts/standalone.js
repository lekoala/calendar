/**
 * Build-only entry for the zero-config standalone bundle.
 *
 * Never imported by src/ or shipped as source: `scripts/build.js` inlines
 * this into dist/calendar.standalone.min.js with the `.css` loader set to
 * `text`, so the component stylesheet travels inside the JS as a string.
 *
 * Registration stays semantically owned by `src/define.js` (the single
 * registration entry for source consumers), but a bare
 * `import "../src/define.js"` does not survive this bundler: Bun drops the
 * side-effect import — and the registration call with it — even unminified,
 * whether or not the target is listed in `sideEffects`. Only a call
 * referenced from the entry itself is kept, so the build-only entry
 * references the same exported registration explicitly.
 *
 * The style is injected before registration runs, and the first render is
 * deferred to requestAnimationFrame, so the first paint is already styled.
 */
// @ts-expect-error inlined as text by the Bun bundler (`loader: { ".css": "text" }`),
// so no type declarations exist for the stylesheet.
import cssText from "../src/calendar.css";
import { defineCalendarView } from "../src/index.js";

/** @type {string} */
const styles = cssText;

const STYLE_ID = "lekoala-calendar-style";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styles;

  const nonce = document.currentScript?.nonce;
  if (nonce) {
    style.nonce = nonce;
  }

  document.head.append(style);
}

defineCalendarView();
