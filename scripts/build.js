/**
 * Build the distributable artifacts into dist/.
 *
 * - dist/calendar.js      classic iife bundle, unminified (file:// friendly)
 * - dist/calendar.min.js  classic iife bundle, minified
 * - dist/calendar.css     component stylesheet, unminified
 * - dist/calendar.min.css component stylesheet, minified
 * - dist/calendar.standalone.min.js  zero-config iife: auto-register plus
 *   the stylesheet injected as a `<style>` element (minified only; the
 *   unminified classic build already covers debugging)
 *
 * The classic build is produced from the single side-effect entry
 * src/define.js, so dist never touches customElements beyond registration.
 * The standalone build uses the build-only entry scripts/standalone.js,
 * which imports src/define.js after inlining the CSS as text.
 * The Temporal ponyfill is bundled inline so the classic build works over
 * file:// without an import map.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

// Scripts run under Bun; keep the global untyped for `tsc` (no bun-types).
const BunApi = /** @type {any} */ (/** @type {any} */ (globalThis).Bun);

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const BANNER = `/*! @lekoala/calendar v${pkg.version} - https://github.com/lekoala/calendar */`;

mkdirSync("dist", { recursive: true });

/**
 * @param {string} entry
 * @param {string} outfile
 * @param {boolean} minify
 * @param {Record<string, string>} [loader] Bun bundler loaders (e.g. `{ ".css": "text" }`)
 */
async function bundle(entry, outfile, minify, loader) {
  const result = await BunApi.build({
    entrypoints: [entry],
    outdir: "dist",
    naming: outfile,
    target: "browser",
    format: "iife",
    minify,
    ...(loader ? { loader } : {}),
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  const file = BunApi.file(`dist/${outfile}`);
  if (await file.exists()) {
    await BunApi.write(`dist/${outfile}`, `${BANNER}\n${await file.text()}`);
  }
}

await bundle("src/define.js", "calendar.js", false);
await bundle("src/define.js", "calendar.min.js", true);
await bundle("scripts/standalone.js", "calendar.standalone.min.js", true, { ".css": "text" });

copyFileSync("src/calendar.css", "dist/calendar.css");

const cssResult = await BunApi.build({
  entrypoints: ["src/calendar.css"],
  outdir: "dist",
  naming: "calendar.min.css",
  minify: true,
});
if (!cssResult.success) {
  for (const log of cssResult.logs) console.error(log);
  process.exit(1);
}

console.log(
  "built dist/calendar.js, dist/calendar.min.js, dist/calendar.standalone.min.js, dist/calendar.css, dist/calendar.min.css",
);
