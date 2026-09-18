// showcase-tools.js — tools menu and shelf, account (theme, skin, locale), search palette and realtime stand-ins.
// Classic script (file:// compatible): shares scope with the other showcase-*.js
// files, so top-level bindings stay bare and cross-file calls need no imports.
// Extracted verbatim from demo/showcase.html; see .temp/split-showcase.mjs.
"use strict";


// --- Tools menu ----------------------------------------------------------
const sources = {
  local: undefined,
  slow: async ({ signal }) => {
    await sleep(600, signal);
    record("slow source resolved (stale responses are dropped by the core)");
    return visibleStore();
  },
  failing: async () => {
    await sleep(250);
    throw new Error("room service unavailable");
  },
};


// --- Tools shelf: filter + pinned tools ----------------------------------
// The mega menu is a catalog; the shelf narrows it. Pins are session-only
// (an application would persist the ids), which keeps the demo restartable.
const toolsFilter = document.getElementById("tools-filter");

const toolsPinnedSection = document.getElementById("tools-pinned");

const toolsPinnedList = document.getElementById("tools-pinned-list");


// --- Account menu, including the theme switcher --------------------------
// Light/dark is a mode and belongs in a list; the named themes are a
// palette and belong in a row of swatches. Eight list rows were what made
// this menu scroll.
const THEME_MODES = [
  { value: "", label: "System", icon: "device-desktop" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];


const THEME_ACCENTS = ["indigo", "ocean", "forest", "sunset", "brutalist"];


const themeMenu = document.getElementById("theme-menu");

const themeSwatches = document.getElementById("theme-swatches");

const localeChips = document.getElementById("locale-chips");

const skinChips = document.getElementById("skin-chips");


// Two card skins, switched by `data-skin` on the root element and nothing
// else: no re-render, no `configure()`, no second markup path. `soft` is
// the default and is set in the document's own `<html>` tag so the first
// paint is already right; this only ever changes it afterwards.
// The two glyphs draw the difference rather than label it: a rounded
// square for the washed cards, a sharp one for the filled slabs. Both are
// core Tabler outlines - the `-filled` variants are not all in the webfont
// build, and a missing glyph renders as nothing at all.
const SKINS = [
  { value: "soft", label: "Soft", icon: "square-rounded" },
  { value: "solid", label: "Solid", icon: "square" },
];


// --- Search: a command palette over the loaded bookings ------------------
// `<combo-box>` enhances a real `input list`, which keeps owning the text;
// the shell only supplies the results and decides what a selection means.
// Its `load(query, { signal })` is deliberately the same shape as the
// calendar's own `eventSource`, so both async seams read alike and a
// superseded keystroke aborts its request.
const searchDialog = document.getElementById("search-dialog");

const searchCombo = document.getElementById("search-combo");

const searchInput = document.getElementById("tools-search");


/** The five strings the combobox generates, per locale, like the core's. */
const SEARCH_MESSAGES = {
  en: { noResults: "No booking matches", loading: "Searching…", loadError: "The booking search failed" },
  fr: { noResults: "Aucune réservation ne correspond", loading: "Recherche…", loadError: "La recherche a échoué" },
  nl: { noResults: "Geen boeking gevonden", loading: "Zoeken…", loadError: "Zoeken is mislukt" },
};


function refreshPinnedSection() {
  // Re-derive visibility with the current filter: it keeps any row found.
  applyToolFilter();
  renderPinnedBar();
}


/**
 * Pinned tools as a one-click desktop strip: an icon per pinned row that
 * re-fires the row's own menu action. The menu button works programmatic
 * clicks while the popover is closed, so no action logic is duplicated.
 */
function renderPinnedBar() {
  const bar = document.getElementById("tools-pinned-bar");
  bar.replaceChildren();
  const pinned = [...toolsPinnedList.querySelectorAll(".menu-item")];
  for (const item of pinned) {
    const label = item.querySelector(".menu-item-text")?.textContent?.trim() ?? "Pinned tool";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn sm neutral ghost icon-only sc-pinned-tool";
    button.title = label;
    button.setAttribute("aria-label", label);
    const glyph = item.querySelector(".menu-item-icon .ti");
    const tone = glyph ? [...glyph.classList].find((name) => name.startsWith("ti-")) : null;
    if (tone) button.append(icon(tone.slice(3)));
    button.addEventListener("click", () => item.click());
    bar.append(button);
  }
  bar.hidden = pinned.length === 0;
}


function applyToolFilter() {
  const query = toolsFilter.value.trim().toLowerCase();
  for (const section of toolsMenu.querySelectorAll(":scope > section")) {
    let any = false;
    for (const row of section.querySelectorAll("li")) {
      const visible = query === "" || (row.textContent?.toLowerCase() ?? "").includes(query);
      row.hidden = !visible;
      if (visible) any = true;
    }
    // Empty sections hide only while a filter is active; the pinned lane
    // additionally hides on its own when it holds nothing.
    const pinned = section === toolsPinnedSection;
    section.hidden = query !== "" ? !any : pinned && toolsPinnedList.children.length === 0;
  }
}


/**
 * Wrap one pinnable tool row with its pin button. The pin sits beside the
 * row's own button, never inside it, so activation stays unambiguous and
 * the section's delegated click handlers ignore it.
 *
 * @param {HTMLLIElement} row
 * @returns {void}
 */
function decorateToolRow(row) {
  const item = row.querySelector(".menu-item");
  const home = row.closest("ul.menu")?.id ?? "";
  if (!item || !home) return;
  row.dataset.home = home;
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "sc-pin";
  pin.setAttribute("aria-pressed", "false");
  pin.setAttribute(
    "aria-label",
      `Pin ${item.querySelector(".menu-item-text")?.textContent?.trim() ?? "tool"}`,
  );
  pin.append(icon("star"));
  pin.addEventListener("click", () => {
    const pinned = row.dataset.pinned === "true";
    row.dataset.pinned = String(!pinned);
    pin.setAttribute("aria-pressed", String(!pinned));
    (pinned
      ? /** @type {HTMLUListElement | null} */ (document.getElementById(row.dataset.home ?? ""))
      : toolsPinnedList
    )?.append(row);
    refreshPinnedSection();
      record(pinned ? "tool unpinned" : `tool pinned: ${item.querySelector(".menu-item-text")?.textContent?.trim()}`);
  });
  row.append(pin);
}


/** @param {string} value */
function applySkin(value) {
  document.documentElement.dataset.skin = value;
  renderSkins();
    record(`skin → ${value} (one attribute; the cards are not re-rendered)`);
}


function renderSkins() {
  const current = document.documentElement.dataset.skin ?? "soft";
  skinChips.replaceChildren();
  for (const skin of SKINS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sc-skin";
    chip.dataset.skinValue = skin.value;
    chip.setAttribute("aria-pressed", String(skin.value === current));
    chip.append(icon(skin.icon));
    const text = document.createElement("span");
    text.textContent = skin.label;
    chip.append(text);
    chip.addEventListener("click", () => applySkin(skin.value));
    skinChips.append(chip);
  }
}


/**
 * One call carries both halves of the contract: `locale` for everything
 * `Intl` and `Temporal` format, `labels` for the five strings the core
 * writes itself. An empty override resets to the shipped English.
 * @param {string} value
 */
function setLocale(value) {
  chosenLocale = value;
  const locale = value || undefined;
  const base = (locale ?? effectiveLocale() ?? "").slice(0, 2);
  calendar.configure({ locale, labels: CORE_LABELS[base] ?? {} });
  fmt = buildFormatters(effectiveLocale());
  // Instances snapshot their messages at construction, so a locale change
  // reconfigures them explicitly - the documented path.
  searchCombo.configure({ messages: searchMessages() });
  // The mini calendar takes the same two halves as the core: `locale` for
  // everything `Intl` formats, `messages` for the strings it writes
  // itself. Empty resets both to the runtime default and to English.
  mini.locale = locale ?? "";
  mini.messages = MINI_MESSAGES[base] ?? {};
  renderLocales();
  refreshChrome();
    record(`locale → ${effectiveLocale() ?? "runtime default"}`);
}


function renderLocales() {
  localeChips.replaceChildren();
  for (const entry of LOCALES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sc-locale";
    chip.dataset.locale = entry.value;
    chip.textContent = entry.chip;
    chip.title = entry.label;
    chip.setAttribute("aria-label", entry.label);
    chip.setAttribute("aria-pressed", String(entry.value === chosenLocale));
    chip.addEventListener("click", () => setLocale(entry.value));
    localeChips.append(chip);
  }
}


/** @param {string} value */
function applyTheme(value) {
  if (value) document.documentElement.dataset.theme = value;
  else document.documentElement.removeAttribute("data-theme");
  renderThemes();
    record(`theme → ${value || "system"}`);
}


function renderThemes() {
  const current = document.documentElement.dataset.theme ?? "";
  themeSwatches.replaceChildren();
  for (const value of THEME_ACCENTS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "sc-theme";
    swatch.dataset.theme = value;
    swatch.title = value;
    swatch.setAttribute("aria-label", value);
    swatch.setAttribute("aria-pressed", String(value === current));
    swatch.addEventListener("click", () => applyTheme(value));
    themeSwatches.append(swatch);
  }
  themeMenu.replaceChildren();
  for (const theme of THEME_MODES) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-item";
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", String(theme.value === current));
    // Not `data-theme`: Actual's theme stylesheet keys on that attribute,
    // so putting it on a button would re-theme the button itself.
    button.dataset.themeValue = theme.value;
    const iconSlot = document.createElement("span");
    iconSlot.className = "menu-item-icon";
    iconSlot.append(icon(theme.icon));
    const text = document.createElement("span");
    text.className = "menu-item-text";
    text.textContent = theme.label;
    const end = document.createElement("span");
    end.className = "menu-item-end";
    const tick = icon("check");
    tick.classList.add("sc-tick");
    end.append(tick);
    button.append(iconSlot, text, end);
    button.addEventListener("click", () => applyTheme(theme.value));
    item.append(button);
    themeMenu.append(item);
  }
}


function searchMessages() {
  return SEARCH_MESSAGES[(effectiveLocale() ?? "en").slice(0, 2)] ?? SEARCH_MESSAGES.en;
}


function openSearch() {
  if (sidebar.matches(":popover-open")) sidebar.hidePopover();
  const combo = searchCombo.combobox;
  // Navigation, not a value: the palette opens on an empty query, and the
  // previous search's transient results go with it. This runs before
  // `showModal()` on purpose - the dialog autofocuses the field, which is
  // what asks the engine to open, so clearing afterwards would already
  // have re-run the previous query.
  combo?.clearQuery({ show: false });
  combo?.clearResults();
  if (!searchDialog.open) searchDialog.showModal();
  searchInput.focus();
}


/** @param {string} id */
async function revealBooking(id) {
  const item = store.find((entry) => entry.id === id);
  if (!item) return;
  // The search result carries the anchor; the calendar navigates, loads,
  // scrolls, highlights and focuses through its own reveal path.
  const revealed = await calendar.reveal({
    eventId: id,
    date: String(item.start).slice(0, 10),
    start: String(item.start),
    focus: true,
  });
    record(revealed ? `search → ${id}` : `search → ${id} (not shown)`);
}
function toolsInit() {


    // The shelf pins rows into a separate lane, so every tool handler
    // delegates from the menu root instead of its section list: a pinned row
    // still reaches its own section logic.
    toolsMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source]");
      if (!button) return;
      const mode = button.dataset.source;
      for (const item of toolsMenu.querySelectorAll("[data-source]")) {
        item.setAttribute("aria-checked", String(item === button));
      }
      calendar.configure({ eventSource: sources[mode] });
    record(`event source → ${mode}`);
      if (mode === "local") calendar.events = visibleStore();
      else void calendar.refetchEvents();
    });


    // Grid density and derivation options, all of them `configure()` calls.
    toolsMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-grid]");
      if (!button) return;
      const on = button.getAttribute("aria-checked") !== "true";
      button.setAttribute("aria-checked", String(on));
      const option = button.dataset.grid;
      if (option === "monday") {
        // Documented precedence, both directions: an explicit `firstDay`
        // always wins, and removing it hands the choice back to the locale.
        // The mini-month rows follow along.
        calendar.configure({ firstDay: on ? 1 : undefined });
        miniFirstDay = on ? 1 : undefined;
        backgroundKey = "";
        refreshChrome();
      } else if (option === "viewer") {
        // Availability markers are viewer-dependent; navigation is not.
        POLICY.viewer = on ? "external" : "admin";
        renderMiniMonth();
      } else if (option === "weeks") {
        mini.showWeekNumbers = on;
        renderMiniMonth();
      } else if (option === "sunday") {
        calendar.configure({ hiddenDays: on ? [7] : [] });
        backgroundKey = "";
        refreshChrome();
      } else if (option === "allday") {
        // The core already hides the lane when nothing is in it; this says
        // "never show it", which is a display choice, not a data one.
        calendar.configure({ allDaySlot: on });
      } else if (option === "dense") {
        calendar.configure({ pxPerMinute: on ? 1 : 1.5 });
      } else if (option === "halfhour") {
        calendar.configure({ slotLabelInterval: on ? 30 : 60 });
      } else if (option === "groups") {
        // Off is not "ungroup the rooms": the rooms keep their `groupId` and
        // the core simply has no group declared to match, so every column
        // trails in the headerless block. That is the same path an unknown
        // `groupId` takes, and it is why the group row reserves no space when
        // nothing matches.
        groupRooms = on;
        applyRoomGroups();
        renderRooms();
      }
    record(`grid → ${option} ${on ? "on" : "off"}`);
    });


    toolsFilter.addEventListener("input", applyToolFilter);


    // A text field inside an `auto` popover swallows Escape by spec, so the
    // platform never closes the shelf from the input: Escape first clears the
    // query, a second press closes the menu.
    toolsFilter.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (toolsFilter.value !== "") {
        toolsFilter.value = "";
        applyToolFilter();
        event.stopPropagation();
        event.preventDefault();
      } else {
        toolsMenu.hidePopover();
      }
    });


    // The menu keeps its DOM across renders, so a closed shelf must forget any
    // filter before the next open shows a half-hidden catalog.
    toolsMenu.addEventListener("toggle", (event) => {
      if (event.newState !== "open") return;
      toolsFilter.value = "";
      applyToolFilter();
    });


    refreshPinnedSection();

    for (const row of toolsMenu.querySelectorAll("li")) decorateToolRow(row);


    toolsMenu.addEventListener("click", (event) => {
      const tool = event.target.closest("[data-tool]")?.dataset?.tool;
      if (!tool) return;
      if (tool === "refetch") {
        void calendar.refetchEvents();
        record("refetch requested");
      } else if (tool === "activity") {
        toggleActivity();
        return;
      } else if (tool === "now") {
        calendar.today();
        calendar.scrollToTime(nowStamp().slice(11));
        record("revealed now");
      } else if (tool === "reschedule-day") {
        // Queue every booking of the first day on screen; placement comes later
        // (drag or paste). The workbench keeps them all safe meanwhile.
        parkDay(String(visibleDay()));
      } else if (tool === "shortcuts") {
        toolsMenu.hidePopover();
        shortcutsDialog.showModal();
        return;
      }
      toolsMenu.hidePopover();
    });


    accountMenu.addEventListener("click", (event) => {
      const action = event.target.closest("[data-account]")?.dataset?.account;
      if (!action) return;
      accountMenu.hidePopover();
      if (action === "shortcuts") {
        shortcutsDialog.showModal();
        return;
      }
    record(`account → ${action} (the shell stops at the intent)`);
    toast(`“${action}” is a stand-in in this demo.`, "success");
    });


    searchCombo.configure({
      minChars: 2,
      debounce: 160,
      messages: searchMessages(),
      async load(query, { signal }) {
        // Stands in for a backend query: the store is local, the contract is
        // not. `sleep` rejects on abort, which is what makes the superseded
        // request disappear instead of racing the newest one.
        await sleep(220, signal);
        const needle = query.trim().toLowerCase();
        return store
          .filter((item) =>
          `${item.title} ${roomTitle(String(item.resourceId ?? ""))}`.toLowerCase().includes(needle))
          .sort((a, b) => (a.start < b.start ? -1 : 1))
          .slice(0, 8)
          .map((item) => ({
            value: item.id,
            label: item.title,
            data: {
              kind: item.extendedProps?.kind ?? "review",
            when: `${fmt.range.format(asDate(String(item.start)))} · ${wallClock(String(item.start))}`,
              room: roomTitle(String(item.resourceId ?? "")),
            },
          }));
      },
      render: {
        // Strings are text and rich rows are DOM nodes here too, so the same
        // rule that governs the calendar's content hooks governs this one.
        option(item) {
          const row = document.createElement("span");
          row.className = "sc-hit";
          row.dataset.kind = item.data?.kind ?? "review";
          const swatch = document.createElement("span");
          swatch.className = "sc-swatch";
          const text = document.createElement("span");
          const title = document.createElement("strong");
          title.textContent = item.label;
          const meta = document.createElement("small");
        meta.textContent = `${item.data?.when ?? ""} · ${item.data?.room ?? ""}`;
          text.append(title, meta);
          row.append(swatch, text);
          return row;
        },
      },
    });


    // Focusing the input asks the engine to open the picker. With an empty
    // catalogue - every suggestion comes from `load()` - that means an empty
    // query would open a picker with nothing but a state row in it. The
    // threshold is a policy, so it is enforced on the cancellable event
    // rather than by suppressing focus.
    searchInput.addEventListener("combobox:beforeopen", (event) => {
      if (searchInput.value.trim().length < 2) event.preventDefault();
    });


    document.getElementById("search-toggle").addEventListener("click", openSearch);

    document.getElementById("search-open").addEventListener("click", openSearch);


    // For an `input list` combobox the input *is* the source control, so the
    // value events land on it.
    searchInput.addEventListener("combobox:select", (event) => {
      searchDialog.close();
      revealBooking(String(event.detail.item.value));
    });


    searchInput.addEventListener("combobox:loaderror", (event) => {
    record(`search failed: ${event.detail?.error?.message ?? "unknown"}`);
    });


    // --- Realtime stand-ins --------------------------------------------------
    document.getElementById("rt-add").addEventListener("click", () => {
    const id = `pushed-${Date.now()}`;
      const day = visibleDay();
      const created = {
        id,
        title: "Pushed booking",
        start: stamp(day, 13 * 60),
        end: stamp(day, 13 * 60 + 30),
        resourceId: "room-a",
        extendedProps: { kind: "planning", seats: 5 },
      };
      store.push(created);
      markFresh(id);
      calendar.addEvent(created);
    record(`realtime add: ${id}`);
      refreshChrome();
      toolsMenu.hidePopover();
    });


    document.getElementById("rt-move").addEventListener("click", () => {
      if (!calendar.getEventById("live")) {
        record("realtime move: “Live sync” no longer exists");
        toast("“Live sync” is not loaded any more.", "warning");
      } else {
        shiftById("live");
      }
      toolsMenu.hidePopover();
    });


    document.getElementById("rt-remove").addEventListener("click", () => {
      if (calendar.removeEvent("live")) {
        store = store.filter((item) => item.id !== "live");
        record("realtime remove: “Live sync”");
        refreshChrome();
      } else {
        record("realtime remove: already gone");
      }
      toolsMenu.hidePopover();
    });
}
Object.assign(globalThis.ShowcaseTools ??= {}, { refreshPinnedSection, renderPinnedBar, applyToolFilter, decorateToolRow, applySkin, renderSkins, setLocale, renderLocales, applyTheme, renderThemes, searchMessages, openSearch, revealBooking });
