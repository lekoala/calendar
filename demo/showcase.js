// showcase.js — CalendarShowcase: the application shell behind demo/showcase.html.
//
// Classic script (file:// compatible): shares scope with showcase-foundation.js,
// showcase-chrome.js, showcase-placement.js, showcase-overlays.js and
// showcase-tools.js, so phases call bare functions and read bare bindings.
//
// Placement and the search combobox are application dependencies, never runtime
// dependencies of the core. The bare specifiers below matter:
// `@lekoala/combobox` imports `@lekoala/floating` itself, so the importmap in
// showcase.html gives both the page and this shell the same module instance
// instead of two copies of the positioning engine. `@lekoala/date-picker/calendar`
// is the calendar-only door of the picker package: it pulls no positioning
// engine and no text field, so the mini month costs one element and nothing else.
// (Kept from the former inline module; dynamic import() keeps it working over
// file://, where static imports of local files are CORS-blocked but the CDN
// imports below are allowed.)
//
// TODO(runtime): chrome controls still rely on native `title` tooltips
// (pinned tools, view switch, locale chips, theme swatches). Later pass:
// wire Actual's own runtime (`actual-css/js/tooltip` via `data-tooltip`),
// or route these triggers through the same floating-backed `.tooltip` the
// event hover already uses (`showTip`).
"use strict";

globalThis.CalendarShowcase = class CalendarShowcase {
  /**
   * @param {Document} [root] scope for the initial boot; the sections keep
   * reading shared bindings, so this is only the entry point, not a sandbox.
   */
  constructor(root = document) {
    this.root = root;
    // Debuggable handles over the section APIs (see Object.assign at the end
    // of each showcase-*.js). The sections themselves stay stateless wikis of
    // functions over shared top-level bindings.
    this.foundation = globalThis.ShowcaseFoundation;
    this.chrome = globalThis.ShowcaseChrome;
    this.placement = globalThis.ShowcasePlacement;
    this.overlays = globalThis.ShowcaseOverlays;
    this.tools = globalThis.ShowcaseTools;
  }

  /**
   * Load the CDN dependencies, publish the async shared state they provide,
   * then run the init phases in the order the former inline script used.
   * @returns {Promise<CalendarShowcase>}
   */
  async init() {
    const floating = await import("@lekoala/floating");
    autoUpdate = floating.autoUpdate;
    reposition = floating.reposition;
    repositionAt = floating.repositionAt;
    await import("@lekoala/combobox/define");
    // The mini month is the picker package's calendar primitive, driven as a
    // navigator. `/calendar` defines nothing by itself, which is what lets a
    // page take the element without the text field or its floating engine.
    const [{ DateCalendarElement }, fr, nl] = await Promise.all([
      import("@lekoala/date-picker/calendar"),
      import("@lekoala/date-picker/locales/fr"),
      import("@lekoala/date-picker/locales/nl"),
    ]);
    customElements.define("date-calendar", DateCalendarElement);
    MINI_MESSAGES = { fr: fr.default, nl: nl.default };
    // Same order as the former inline script, top to bottom.
    placementInitEarly();
    placementConfigureCalendar();
    chromeInit();
    overlaysInitHead();
    placementInitGuards();
    overlaysInit();
    toolsInit();
    chromeInitShell();
    return this;
  }
};
