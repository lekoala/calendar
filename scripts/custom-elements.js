/**
 * Generate custom-elements.json (Custom Elements Manifest 2.1.0) from source.
 *
 * The sources are read as text: the script never imports the browser-only
 * modules under Bun. The JS source stays the single source of truth:
 * - attributes come from `observedAttributes` in src/calendar-view.js
 * - members come from non-private methods/getters of CalendarViewElement
 *   (lifecycle callbacks excluded)
 * - events come from the literal `calendar:*` names dispatched in src/
 * - CSS custom properties come from the `--calendar-*` tokens in calendar.css
 */
import { readFile, writeFile } from "node:fs/promises";

const OUT = "custom-elements.json";
const SCHEMA_VERSION = "2.1.0";
const TAG = "calendar-view";
const MODULE = "src/calendar-view.js";

const LIFECYCLE = new Set(["connectedCallback", "disconnectedCallback", "attributeChangedCallback"]);
const KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "try",
  "return",
  "const",
  "let",
  "var",
  "import",
  "export",
  "new",
  "this",
  "super",
  "typeof",
  "function",
]);
const EXCLUDED_MEMBERS = new Set(["observedAttributes"]);

/** @param {string} file */
const read = (file) => readFile(file, "utf8");

/**
 * Extract observed attribute names from `static observedAttributes = [...]`.
 * @param {string} source
 * @returns {string[]}
 */
function extractAttributes(source) {
  const match = source.match(/static\s+observedAttributes\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/["']([a-z][\w-]*)["']/g)].map((m) => m[1]);
}

/**
 * Extract the first sentence of a JSDoc block for the manifest description.
 * @param {string} text
 * @returns {string|undefined}
 */
function extractDescription(text) {
  const cleaned = text
    .replace(/\/\*+|\*+\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"))
    .join(" ");
  if (!cleaned) return undefined;
  const sentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  return sentence || undefined;
}

/**
 * Extract public (non-#, non-lifecycle) methods/getters/setters of the element.
 * @param {string} source
 * @returns {Array<{ kind: string, name: string, description: string | undefined }>}
 */
function extractMembers(source) {
  const lines = source.split("\n");
  /** @type {Array<{ kind: string, name: string, description: string | undefined }>} */
  const members = [];
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[] | null} */
  let doc = null;
  /** @type {string | null} */
  let pendingDoc = null;
  for (const line of lines) {
    if (doc) {
      doc.push(line);
      if (line.includes("*/")) {
        const text = doc.join("\n");
        doc = null;
        pendingDoc = text;
      }
      continue;
    }
    if (/^\s*\/\*\*/.test(line)) {
      if (line.includes("*/")) {
        pendingDoc = line;
      } else {
        doc = [line];
      }
      continue;
    }
    // Class members live at exactly one indent level (two spaces).
    if (!line.startsWith("  ") || line.startsWith("   ")) {
      if (pendingDoc && line.trim() !== "") pendingDoc = null;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("@")) {
      continue;
    }
    const def =
      trimmed.match(/^static\s+(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(\(|=)/) ??
      trimmed.match(/^(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(\(|=|\{)/);
    if (def && pendingDoc !== undefined) {
      const name = def[1];
      const delimiter = def[2];
      const isPrivate = line.includes("#") || name.startsWith("#");
      if (
        !isPrivate &&
        !LIFECYCLE.has(name) &&
        !KEYWORDS.has(name) &&
        !EXCLUDED_MEMBERS.has(name) &&
        !seen.has(`${trimmed.startsWith("get ") ? "getter" : "method"}:${name}`)
      ) {
        let kind = "method";
        if (trimmed.startsWith("get ") || trimmed.startsWith("static get ")) kind = "getter";
        else if (trimmed.startsWith("set ") || trimmed.startsWith("static set ")) kind = "setter";
        else if (delimiter === "=") kind = "field";
        if (!trimmed.includes("=>") && !trimmed.startsWith("import ") && !trimmed.startsWith("const ")) {
          const description = pendingDoc ? extractDescription(pendingDoc) : undefined;
          members.push({ kind, name, description });
          seen.add(`${kind}:${name}`);
        }
      }
      pendingDoc = null;
      continue;
    }
    if (pendingDoc && trimmed !== "") {
      // JSDoc not followed by a member (e.g. typedef): drop it.
      if (!/^(?:@|\*|\/)/.test(trimmed)) pendingDoc = null;
    }
  }
  return members.filter((m) => m.name !== "constructor");
}

/**
 * Extract literal `calendar:*` event names dispatched in src/.
 * @param {string[]} sources
 * @returns {string[]}
 */
function extractEvents(sources) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const source of sources) {
    for (const m of source.matchAll(/["'](calendar:[a-z]+)["']/g)) names.add(m[1]);
  }
  return [...names].sort();
}

/**
 * Extract the public `--calendar-*` custom properties from the stylesheet.
 * @param {string} css
 * @returns {string[]}
 */
function extractCssProperties(css) {
  /** @type {string[]} */
  const names = [];
  for (const m of css.matchAll(/(--calendar-[a-z][\w-]*)/g)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names.sort();
}

async function main() {
  const elementSource = await read(MODULE);
  const indexSource = await read("src/index.js");
  const cssSource = await read("src/calendar.css");
  const renderSources = await Promise.all(
    ["src/render/time-grid.js", "src/render/month-grid.js", "src/render/list.js"].map(read),
  );

  const attributes = extractAttributes(elementSource);
  const members = extractMembers(elementSource);
  const events = extractEvents([elementSource, ...renderSources]);
  const cssProperties = extractCssProperties(cssSource);
  const hasDefine = /function defineCalendarView/.test(indexSource);

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    readme: "README.md",
    modules: [
      {
        kind: "javascript-module",
        path: MODULE,
        declarations: [
          {
            kind: "class",
            name: "CalendarViewElement",
            description:
              "Light-DOM calendar and resource scheduling element: dates x time x events, optionally resources x dates x time x events.",
            tagName: TAG,
            attributes: attributes.map((name) => ({ name })),
            members: members.map(({ kind, name, description }) => ({
              kind,
              name,
              ...(description ? { description } : {}),
            })),
            events: events.map((name) => ({ name })),
            cssProperties: cssProperties.map((name) => ({ name })),
          },
        ],
        exports: [
          {
            kind: "js",
            name: "CalendarViewElement",
            declaration: { name: "CalendarViewElement", module: MODULE },
          },
          ...(hasDefine
            ? [
                {
                  kind: "js",
                  name: "defineCalendarView",
                  declaration: { name: "defineCalendarView", module: "src/index.js" },
                },
              ]
            : []),
        ],
      },
    ],
  };

  await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `wrote ${OUT} (${attributes.length} attributes, ${members.length} members, ${events.length} events, ${cssProperties.length} css properties)`,
  );
}

await main();
