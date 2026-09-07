import { Temporal } from "temporal-polyfill";
import {
  getMonthWeeks,
  getViewRange,
  getVisibleDates,
  isResourceView,
  minutesFromMidnight,
  resolveLocale,
  startOfWeek,
  stepAnchor,
  toPlainDate,
} from "./core/dates.js";
import { resolveLabels } from "./core/labels.js";
import {
  isMovable,
  isResizable,
  normalizeBackground,
  normalizeEvent,
  normalizeRangeBound,
  normalizeResource,
  normalizeResourceGroup,
  sameRange,
} from "./core/model.js";
import { queryOverlaps, queryRangeContext } from "./core/overlaps.js";
import { normalizePolicyDecision } from "./core/policy.js";
import { describeEvent, toZonedDateTime } from "./core/slicing.js";
import { nextStateChangeMs } from "./core/temporal.js";
import { renderList } from "./render/list.js";
import { renderMonthGrid } from "./render/month-grid.js";
import { renderTimeGrid } from "./render/time-grid.js";

/**
 * @typedef {object} EventSourceQuery
 * @property {Temporal.PlainDate} start
 * @property {Temporal.PlainDate} end
 * @property {string[]} resourceIds
 * @property {AbortSignal} signal
 * @property {CalendarViewElement} calendar
 */

/**
 * @typedef {object} CalendarConfig
 * @property {string} [timeZone]
 * @property {string} [locale] BCP 47 tag for default header/axis formatting and `firstDay` suggestion; content hooks stay authoritative
 * @property {Partial<import("./core/labels.js").CalendarLabels>} [labels] fixed UI strings merged over the English defaults
 * @property {number} [pxPerMinute]
 * @property {Temporal.Duration | { minutes: number }} [snapDuration]
 * @property {Temporal.Duration | { minutes: number }} [defaultTimedEventDuration]
 * @property {number} [monthEventLimit] event chips per month day cell before `+n more`
 * @property {number} [firstDay] first weekday of a civil week, ISO 1-7 (default 1, Monday)
 * @property {number[]} [hiddenDays] weekdays never rendered, ISO 1-7
 * @property {number} [slotLabelInterval] minutes between time axis labels (default 60)
 * @property {boolean} [editable]
 * @property {boolean} [allDaySlot] show the all-day lane in time grids when it has content (default true)
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [eventSource]
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [backgroundSource]
 * @property {(info: object) => unknown} [eventContent]
 * @property {(info: object) => unknown} [dayHeaderContent]
 * @property {(info: object) => unknown} [resourceHeaderContent]
 * @property {(info: object) => unknown} [resourceGroupContent]
 * @property {(info: object) => unknown} [slotLabelContent]
 * @property {(info: object) => unknown} [moreLinkContent]
 * @property {(decision: InteractionPolicyInput) => boolean | string | null | undefined} [interactionPolicy] synchronous gate for user-originated interactions (pointer, keyboard, external drop, selection); programmatic mutations never consult it
 */

/**
 * Input for the dynamic interaction policy.
 *
 * @typedef {object} InteractionPolicyInput
 * @property {"select" | "move" | "resize" | "external"} action the proposed interaction; `select` and `external` carry no existing event
 * @property {import("./core/model.js").NormalizedEvent | null} event the acted-on event, or null for select/external
 * @property {InteractionPolicyTarget} target the proposed placement
 * @property {import("./core/overlaps.js").RangeContext} context canonical range context of the proposed range
 * @property {Temporal.ZonedDateTime} now the moment the decision is taken
 */

/**
 * Proposed placement for a policy decision. Mirrors the external-drop
 * anchor and adds the full proposed range, so a policy never recomposes
 * `end` or reads the range back out of `context`.
 *
 * @typedef {object} InteractionPolicyTarget
 * @property {unknown} start proposed range start (zoned timed, civil all-day)
 * @property {unknown} end proposed range end (zoned timed, civil all-day)
 * @property {Temporal.PlainDate} date winner civil date
 * @property {Temporal.ZonedDateTime | null} time proposed start as an instant for timed ranges, null for all-day
 * @property {string | null} resourceId proposed resource, or null
 * @property {boolean} allDay true for all-day lane placements
 */

/**
 * Presentation metadata for an external drop (`addExternalDrop`). The core
 * uses it to draw a placement preview with the real duration; business
 * policy (overlaps, working hours, capabilities) stays in `validate`.
 *
 * @typedef {object} ExternalDropMeta
 * @property {Temporal.Duration | { minutes: number } | number} [duration] preview length in the time grid (defaults to `defaultTimedEventDuration`)
 * @property {boolean} [allDay] force the all-day lane as the target
 * @property {string} [title] preview label
 * @property {(target: {
 *   date: Temporal.PlainDate,
 *   time: Temporal.ZonedDateTime | null,
 *   resourceId: string | null,
 *   allDay: boolean,
 * }) => boolean | string | null | undefined} [validate] application policy on the target; a string is the refusal reason
 */

const DEFAULTS = {
  view: "week",
  timeZone: "UTC",
  slotMin: "08:00",
  slotMax: "18:00",
  slotDuration: 20,
  slotLabelInterval: 60,
  pxPerMinute: 1.8,
  snapDuration: Temporal.Duration.from({ minutes: 15 }),
  defaultTimedEventDuration: Temporal.Duration.from({ minutes: 30 }),
};

// Largest delay a `setTimeout` accepts; aging boundaries beyond it simply
// re-arm on the next render instead of overflowing.
const MAX_TIMEOUT_MS = 2147483647;

/**
 * Winner civil date of a proposed range start: civil input stays civil,
 * zoned input projects in `timeZone`.
 *
 * @param {unknown} start
 * @param {string} timeZone
 * @returns {Temporal.PlainDate}
 */
function targetDate(start, timeZone) {
  if (start instanceof Temporal.PlainDate) return start;
  if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return Temporal.PlainDate.from(start);
  }
  return toZonedDateTime(start, timeZone).toPlainDate();
}

/**
 * Civil date helpers shared with the main grid, exposed for external
 * navigators (mini-calendars, custom headers). One object with two access
 * paths: ESM `import { dates } from "…"`, and classic scripts
 * `customElements.get("calendar-view").dates` — the element static is the
 * very same reference, so nothing is re-wrapped.
 *
 * @type {{
 *   getMonthWeeks(
 *     date: Temporal.PlainDate | string,
 *     options?: { firstDay?: number, hiddenDays?: Iterable<number>, locale?: string },
 *   ): Temporal.PlainDate[][],
 *   startOfWeek(date: Temporal.PlainDate | string, firstDay?: number): Temporal.PlainDate,
 *   toPlainDate(value: Temporal.PlainDate | string): Temporal.PlainDate,
 * }}
 */
export const dates = { getMonthWeeks, startOfWeek, toPlainDate };

export class CalendarViewElement extends HTMLElement {
  static observedAttributes = ["view", "date", "lang", "slot-min", "slot-max", "slot-duration"];

  /** Pass-through for the shared civil helpers, same reference as the ESM `dates` export. */
  static dates = dates;

  /** @type {Array<import("./core/model.js").NormalizedEvent>} */
  #events = [];
  /** @type {Array<import("./core/model.js").NormalizedResource>} */
  #resources = [];
  /** @type {Array<import("./core/model.js").NormalizedResourceGroup>} */
  #resourceGroups = [];
  /** @type {Array<import("./core/model.js").NormalizedBackground>} */
  #backgrounds = [];
  /**
   * Registered external drop sources (element -> drag helpers + payload/meta).
   *
   * @type {Map<HTMLElement, {
   *   payload: unknown,
   *   meta: ExternalDropMeta,
   *   onStart: (event: DragEvent) => void,
   *   onEnd: () => void,
   * }>}
   */
  #externalDrops = new Map();
  /** The external drag in flight, read by the rendered grid to draw the preview. @type {{ payload: unknown, meta: ExternalDropMeta } | null} */
  #dragExternal = null;
  /**
   * Application-proposed range painted as a read-only overlay (server slot
   * proposals, armed placement targets). Render state, re-painted on every
   * render until replaced or cleared; paints only where the current view
   * can represent it.
   *
   * @type {{ start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime, resourceId: string | null } | null}
   */
  #preview = null;
  /** @type {CalendarConfig} */
  #config = {};
  /** @type {AbortController | null} */
  #abortController = null;
  #requestVersion = 0;
  #batchDepth = 0;
  #renderQueued = false;
  /**
   * Post-render callbacks, drained once the pending render inserted its
   * subtree. `cancel` runs instead of `run` when the queue is dropped, so a
   * caller awaiting the seam settles rather than hanging.
   * @type {Array<{ run: () => void, cancel?: () => void }>}
   */
  #afterRenderQueue = [];
  /** Latest pending live-region message; last write wins. @type {string | null} */
  #pendingAnnounce = null;
  /** Single cancellable announce frame for a11y timing. @type {number | null} */
  #announceFrame = null;
  /** One-shot aging timer to the next visible event boundary. @type {number | null} */
  #agingTimer = null;
  /**
   * Single timer clearing the reveal highlight. The highlight itself lives
   * on the rendered node, so a re-render removes it for free; the timer only
   * handles the quiet case where nothing else re-renders within the delay.
   *
   * @type {number | null}
   */
  #revealTimer = null;

  connectedCallback() {
    this.classList.add("calendar-view");
    if (!this.hasAttribute("date")) {
      const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
      this.setAttribute("date", Temporal.Now.plainDateISO(timeZone).toString());
    }
    this.#queueRender();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    // No work survives a disconnect: drop queued post-render callbacks and
    // cancel the single pending announce frame, if any. Dropping is not
    // silent - a queued callback an awaiting caller depends on gets its
    // cancel path, so `reveal()` settles instead of hanging forever.
    const dropped = this.#afterRenderQueue;
    this.#afterRenderQueue = [];
    for (const entry of dropped) entry.cancel?.();
    this.#pendingAnnounce = null;
    if (this.#announceFrame !== null) {
      cancelAnimationFrame(this.#announceFrame);
      this.#announceFrame = null;
    }
    if (this.#agingTimer !== null) {
      clearTimeout(this.#agingTimer);
      this.#agingTimer = null;
    }
    if (this.#revealTimer !== null) {
      clearTimeout(this.#revealTimer);
      this.#revealTimer = null;
    }
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#queueRender();
  }

  /**
   * @param {Partial<CalendarConfig>} [options]
   * @returns {this}
   */
  configure(options = {}) {
    this.#config = { ...this.#config, ...options };
    this.#queueRender();
    return this;
  }

  get view() {
    return this.getAttribute("view") || DEFAULTS.view;
  }

  /** @param {string} value */
  set view(value) {
    this.setView(value);
  }

  /**
   * @returns {Temporal.PlainDate}
   */
  get date() {
    return toPlainDate(/** @type {string} */ (this.getAttribute("date")));
  }

  /** @param {Temporal.PlainDate | string} value */
  set date(value) {
    this.gotoDate(value);
  }

  get events() {
    return [...this.#events];
  }

  /** @param {import("./core/model.js").EventInput[] | null | undefined} value */
  set events(value) {
    this.#events = Array.from(value ?? [], normalizeEvent);
    this.#queueRender();
  }

  get resources() {
    return [...this.#resources];
  }

  /** @param {import("./core/model.js").ResourceInput[] | null | undefined} value */
  set resources(value) {
    this.#resources = Array.from(value ?? [], normalizeResource);
    this.#queueRender();
  }

  get resourceGroups() {
    return [...this.#resourceGroups];
  }

  /** @param {import("./core/model.js").ResourceGroupInput[] | null | undefined} value */
  set resourceGroups(value) {
    this.#resourceGroups = Array.from(value ?? [], normalizeResourceGroup);
    this.#queueRender();
  }

  get backgrounds() {
    return [...this.#backgrounds];
  }

  /** @param {import("./core/model.js").BackgroundInput[] | null | undefined} value */
  set backgrounds(value) {
    this.#backgrounds = Array.from(value ?? [], normalizeBackground);
    this.#queueRender();
  }

  /**
   * @param {string} view
   * @returns {void}
   */
  setView(view) {
    const oldView = this.view;
    if (oldView === view) return;
    this.setAttribute("view", view);
    this.dispatchEvent(new CustomEvent("calendar:viewchange", { detail: { oldView, view } }));
    this.#announce(`${view}, ${this.getAttribute("date")}`);
    void this.refetchEvents();
  }

  /**
   * Moves the anchor date, then returns the source reload it triggered, so
   * callers that must act on the loaded state (like `reveal()`) can await a
   * single load instead of firing a second one. Ignoring the return keeps
   * the previous fire-and-forget behavior.
   *
   * @param {Temporal.PlainDate | string} value
   * @returns {Promise<void>}
   */
  async gotoDate(value) {
    const next = toPlainDate(value).toString();
    const previous = this.getAttribute("date");
    if (previous === next) return;
    this.setAttribute("date", next);
    this.dispatchEvent(new CustomEvent("calendar:datechange", { detail: { date: toPlainDate(next) } }));
    this.#announce(`${this.view}, ${next}`);
    return this.refetchEvents();
  }

  getVisibleRange() {
    return getViewRange(this.date, this.view, this.#dateOptions());
  }

  prev() {
    this.gotoDate(stepAnchor(this.date, this.view, -1, this.#dateOptions()));
  }

  next() {
    this.gotoDate(stepAnchor(this.date, this.view, 1, this.#dateOptions()));
  }

  today() {
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    this.gotoDate(Temporal.Now.plainDateISO(timeZone));
  }

  /**
   * @param {Temporal.PlainTime | string} value
   * @returns {number}
   */
  scrollToTime(value) {
    const scroller = this.querySelector(".cv-scroller");
    if (!scroller) return 0;
    const options = this.#options();
    const startMinutes = minutesFromMidnight(options.slotMin);
    const top = Math.max(0, (minutesFromMidnight(value) - startMinutes) * options.pxPerMinute);
    scroller.scrollTop = top;
    return top;
  }

  /**
   * @param {string | number} id
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  getEventById(id) {
    return this.#events.find((event) => event.id === String(id)) ?? null;
  }

  /**
   * Paints an application-proposed timed range as a read-only overlay with
   * the real event geometry (server slot proposals, an armed placement
   * target). Timed bounds only — the exact same canonical normalization as
   * events, so the preview accepts and rejects exactly what an event would.
   * Read-only render state: no dispatch, no policy check, no focus; it
   * repaints on every render until replaced or cleared, and paints nothing
   * where the current view cannot represent it (other views, hidden
   * resources, out-of-range days).
   *
   * @param {{ start: unknown, end: unknown, resourceId?: string | null }} range
   * @returns {void}
   */
  previewRange(range) {
    // Timed-only: `false` rejects civil input at runtime, the cast tells
    // the type checker what the flag already guarantees.
    const start = /** @type {Temporal.ZonedDateTime} */ (normalizeRangeBound(range?.start, false));
    const end = /** @type {Temporal.ZonedDateTime} */ (normalizeRangeBound(range?.end, false));
    if (Temporal.ZonedDateTime.compare(start, end) >= 0) {
      throw new TypeError("previewRange() requires a non-empty timed range");
    }
    const resourceId = range?.resourceId ?? null;
    this.#preview = {
      start,
      end,
      resourceId: resourceId === null ? null : String(resourceId),
    };
    this.#queueRender();
  }

  /**
   * Removes the range overlay set by `previewRange()`. No render when there
   * is nothing to clear.
   *
   * @returns {void}
   */
  clearPreview() {
    if (!this.#preview) return;
    this.#preview = null;
    this.#queueRender();
  }

  /**
   * In-range reveal: scrolls to an event that belongs to the current
   * rendered state, optionally highlights it and moves focus to it. Never
   * navigates and never reloads sources — out-of-range anchors are the
   * `reveal()` job.
   *
   * `true` means the event exists in canonical state, its date belongs to
   * the current rendered range, and the reveal has been scheduled (the
   * visuals ride the `afterRender` seam when a render is still pending). It
   * does not guarantee that the current view renders a DOM node for the
   * event; for example, a month event hidden behind `+n more` remains
   * hidden. `false` means the event is unknown or its date is outside the
   * current rendered range.
   *
   * @param {string | number} id
   * @param {{ focus?: boolean, highlight?: boolean }} [options]
   * @returns {boolean}
   */
  revealEvent(id, options = {}) {
    const key = String(id);
    if (this.#revealNode(key, options)) return true;
    // A render may still be pending after a mutation just applied: retry
    // once on the render seam instead of reporting a settled miss.
    const event = this.getEventById(key);
    if (!event || !this.isConnected) return false;
    if (!this.#isDateRendered(targetDate(event.start, this.#config.timeZone ?? DEFAULTS.timeZone))) {
      return false;
    }
    this.#afterRender(() => {
      this.#revealNode(key, options);
    });
    return true;
  }

  /**
   * Out-of-range reveal for external anchors such as search results: the
   * anchor knows where the event lives, so the calendar navigates there
   * (`gotoDate`, awaited as a single load), waits for sources, then reveals
   * through the same node path as `revealEvent()`. No data waiter and no
   * scanning of unseen periods. It shares `revealEvent()`'s boolean
   * contract once navigation and loading settled: `true` means the
   * navigation/loading won and the reveal was scheduled, not that the view
   * necessarily renders a node (a month event behind `+n more` stays
   * hidden — opening it is application business). A concurrent navigation
   * winning meanwhile resolves `false`.
   *
   * @param {{ eventId: string | number, date?: Temporal.PlainDate | string, start?: unknown, focus?: boolean, highlight?: boolean }} input
   * @returns {Promise<boolean>}
   */
  async reveal(input) {
    const eventId = input?.eventId;
    if (eventId === undefined || eventId === null || String(eventId) === "") {
      throw new TypeError("reveal() requires an eventId; range-only navigation is gotoDate().");
    }
    const anchorInput = input?.date ?? input?.start;
    if (anchorInput === undefined || anchorInput === null) {
      throw new TypeError("reveal() requires a date or start anchor.");
    }
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    // One projection for every anchor shape: `targetDate()` keeps a civil
    // `YYYY-MM-DD` civil and projects everything else into the calendar's
    // zone. A zoned *string* used to skip it and land on its own wall date,
    // so `…T23:30-04:00[America/New_York]` navigated to the day before the
    // one the event starts on in Brussels.
    const requested = targetDate(anchorInput, timeZone).toString();
    const key = String(eventId);
    const options = { focus: input?.focus ?? false, highlight: input?.highlight ?? true };
    // Fast path: already on the date with the event in state.
    if (this.date.toString() === requested && this.getEventById(key) && this.#revealNode(key, options)) {
      return true;
    }
    if (!this.isConnected) return false;
    if (this.date.toString() !== requested) {
      // Awaited as the single load `gotoDate` triggered; a concurrent
      // navigation winning meanwhile is detected by the anchor check below.
      await this.gotoDate(requested);
    } else if (!this.getEventById(key)) {
      await this.refetchEvents();
    }
    if (!this.isConnected || this.date.toString() !== requested) return false;
    if (this.#revealNode(key, options)) return true;
    // The load queued its render but the DOM is still stale: settle on the
    // post-render state, after the announce-triggered render flushed. Same
    // scheduled-not-guaranteed contract as `revealEvent()`: visuals apply
    // only when the view renders a node, a month event behind `+n more`
    // stays hidden without flipping the boolean.
    // Both hops carry a cancel path: a disconnect drops the post-render
    // queue, and a caller awaiting this promise has to settle rather than
    // wait for a render that will never come.
    return new Promise((resolve) => {
      const cancel = () => resolve(false);
      this.#afterRender(() => {
        const zone = this.#config.timeZone ?? DEFAULTS.timeZone;
        const event = this.getEventById(key);
        if (!this.isConnected || !event) {
          resolve(false);
          return;
        }
        this.#announce(describeEvent(event, zone, this.#options().labels.untitledEvent));
        this.#afterRender(() => {
          if (!this.isConnected) {
            resolve(false);
            return;
          }
          const fresh = this.querySelector(`[data-event-id="${CSS.escape(key)}"]`);
          if (fresh instanceof HTMLElement) this.#applyRevealVisuals(event, fresh, options);
          resolve(true);
        }, cancel);
      }, cancel);
    });
  }

  /**
   * Synchronous node reveal against the current DOM. Checks that a node
   * exists now, announces through the render seam (last message wins, so a
   * `gotoDate` announcement is superseded), and applies the visuals once
   * the pending render has flushed — the announcement itself queues a
   * render that would otherwise replace a synchronously highlighted node.
   * Returns whether a reveal was queued.
   *
   * @param {string} id
   * @param {{ focus?: boolean, highlight?: boolean }} [options]
   * @returns {boolean}
   */
  #revealNode(id, options = {}) {
    if (!this.isConnected) return false;
    const event = this.getEventById(id);
    if (!event) return false;
    const node = this.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
    if (!(node instanceof HTMLElement)) return false;
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    this.#announce(describeEvent(event, timeZone, this.#options().labels.untitledEvent));
    this.#afterRender(() => {
      if (!this.isConnected) return;
      const fresh = this.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
      if (!(fresh instanceof HTMLElement)) return;
      this.#applyRevealVisuals(event, fresh, options);
    });
    return true;
  }

  /**
   * Post-render reveal visuals against a freshly inserted node: precise
   * `scrollToTime` first in time grids, `scrollIntoView` in every view
   * (notably the horizontal axis of resource views), then the temporary
   * highlight and the optional focus.
   *
   * @param {import("./core/model.js").NormalizedEvent} event
   * @param {HTMLElement} node
   * @param {{ focus?: boolean, highlight?: boolean }} [options]
   * @returns {void}
   */
  #applyRevealVisuals(event, node, options = {}) {
    const { focus = false, highlight = true } = options;
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    if (this.view !== "month" && this.view !== "list" && event.allDay !== true) {
      this.scrollToTime(toZonedDateTime(event.start, timeZone).toPlainTime());
    }
    node.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (highlight) {
      if (this.#revealTimer !== null) {
        clearTimeout(this.#revealTimer);
        this.#revealTimer = null;
      }
      node.classList.add("cv-reveal");
      node.dataset.revealed = "true";
      this.#revealTimer = window.setTimeout(() => {
        this.#revealTimer = null;
        // A re-render replaces the node first; only touch it when it is
        // still the connected one this reveal highlighted.
        if (!node.isConnected) return;
        node.classList.remove("cv-reveal");
        delete node.dataset.revealed;
      }, 2000);
    }
    if (focus) node.focus({ preventScroll: true });
  }

  /**
   * Whether a civil date is part of what the current view renders (month
   * spill weeks included, hidden days excluded).
   *
   * @param {Temporal.PlainDate} date
   * @returns {boolean}
   */
  #isDateRendered(date) {
    const wanted = date.toString();
    return getVisibleDates(this.date, this.view, this.#dateOptions()).some(
      (rendered) => rendered.toString() === wanted,
    );
  }

  /**
   * Public read surface over canonical state: events (and optionally
   * backgrounds) overlapping `{ start, end }`, in paint order, or `[]`.
   * Comparison is by absolute instant over half-open ranges; `resourceIds`
   * scopes by resource (`[]` means no filter, resource-less backgrounds are
   * global and match any scope); `filter({ kind, event, background })`
   * narrows further without reading class arrays.
   *
   * @param {{ start: unknown, end: unknown }} range
   * @param {{ resourceIds?: string[], includeBackgrounds?: boolean, filter?: (entry: { kind: "event" | "background", event?: import("./core/model.js").NormalizedEvent, background?: import("./core/model.js").NormalizedBackground }) => boolean }} [options]
   * @returns {Array<import("./core/model.js").NormalizedEvent | import("./core/model.js").NormalizedBackground>}
   */
  getEventOverlaps(range, options = {}) {
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    return queryOverlaps({
      events: this.#events,
      backgrounds: this.#backgrounds,
      range,
      timeZone,
      resourceIds: options.resourceIds ?? [],
      includeBackgrounds: options.includeBackgrounds ?? false,
      filter: options.filter,
    });
  }

  /**
   * Canonical range context over canonical state: what `{ start, end }`
   * touches. `events.overlapping` is a plain intersection;
   * `backgrounds.covering` fully wraps the range while
   * `backgrounds.overlapping` merely intersects it. Comparison is by
   * absolute instant over half-open ranges; a nullish `resourceId` means no
   * filter, resource-less backgrounds are global and match any scope.
   *
   * This is the single definition of "context": interaction intents attach
   * snapshots produced here to their `detail.context`. Geometry only — when
   * several backgrounds cover the same range, priority stays
   * application-side.
   *
   * @param {{ start: unknown, end: unknown, resourceId?: string | null }} range
   * @returns {import("./core/overlaps.js").RangeContext}
   */
  getRangeContext(range) {
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    return queryRangeContext({
      events: this.#events,
      backgrounds: this.#backgrounds,
      range,
      timeZone,
      resourceId: range?.resourceId ?? null,
    });
  }

  /**
   * Single evaluation path for user-originated interactions (pointer,
   * keyboard, external drop, selection). Resolves the canonical context of
   * the proposed range, takes a fresh `now`, and normalizes the application
   * answer to `{ ok, reason }`. Strictly synchronous: server validation
   * stays in the commit/revert path. Programmatic mutations
   * (`moveEvent`/`resizeEvent`/`removeEvent`) never call this.
   *
   * @param {object} input
   * @param {"select" | "move" | "resize" | "external"} input.action
   * @param {import("./core/model.js").NormalizedEvent | null} input.event
   * @param {unknown} input.start proposed range start
   * @param {unknown} input.end proposed range end
   * @param {string | null} input.resourceId
   * @param {boolean} [input.allDay]
   * @returns {import("./core/policy.js").PolicyDecision}
   */
  checkInteraction({ action, event, start, end, resourceId, allDay = false }) {
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    const policy = this.#config.interactionPolicy;
    if (typeof policy !== "function") return { ok: true, reason: null };
    const context = this.getRangeContext({ start, end, resourceId });
    const target = {
      start,
      end,
      date: targetDate(start, timeZone),
      time: allDay ? null : toZonedDateTime(start, timeZone),
      resourceId: resourceId ?? null,
      allDay,
    };
    const now = Temporal.Now.zonedDateTimeISO(timeZone);
    return normalizePolicyDecision(policy({ action, event, target, context, now }));
  }

  /**
   * Optimistic mutation path shared by pointer interactions and programmatic
   * commands. Applies `current` immediately, dispatches a cancelable event
   * carrying an idempotent `revert()`, and reverts automatically when the
   * dispatch is prevented synchronously.
   *
   * @param {object} input
   * @param {import("./core/model.js").NormalizedEvent} input.event
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.previous
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current
   * @param {string} input.name
   * @param {Event | null} input.nativeEvent
   * @returns {import("./core/model.js").NormalizedEvent | null} the optimistic event, or null when rejected immediately
   */
  #commitEventMutation({ event, previous, current, name, nativeEvent }) {
    const id = event.id;
    const before = this.getEventById(id);
    if (!before) return null;
    // Optimistic commits keep the canonical boundary types: a committed
    // `current.start` string re-enters the same strict normalization as a
    // source payload, so `calendar.events` never mixes raw input and state.
    const allDay = before.allDay === true;
    const optimistic = {
      start: normalizeRangeBound(current.start, allDay),
      end: normalizeRangeBound(current.end, allDay),
      resourceId: current.resourceId,
    };
    const restored = { start: before.start, end: before.end, resourceId: before.resourceId ?? null };
    /**
     * @param {{ start: unknown, end: unknown, resourceId: string | null }} state
     * @returns {void}
     */
    const apply = (state) => {
      this.#events = this.#events.map((item) => (item.id === id ? { ...item, ...state } : item));
      this.#queueRender();
    };
    apply(optimistic);
    let reverted = false;
    // `revert()` may run long after the dispatch, once an application has
    // decided asynchronously. By then the event can have been removed,
    // reordered or moved again, so the undo addresses it by id and only
    // fires while the placement it owns is still the one in state: a stale
    // revert must never resurrect a deleted event, land on its neighbour,
    // or undo someone else's newer move.
    const revert = () => {
      if (reverted) return;
      reverted = true;
      const live = this.getEventById(id);
      if (!live || !sameRange(live, optimistic)) return;
      apply(restored);
    };
    const accepted = this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        // `context` is a snapshot of canonical state at dispatch time. For
        // move/resize the optimistic mutation is already applied, so the
        // mutated event may appear in `context.events.overlapping`.
        detail: {
          event: this.getEventById(id),
          previous,
          current,
          context: this.getRangeContext(current),
          nativeEvent,
          revert,
        },
      }),
    );
    if (!accepted) revert();
    return reverted ? null : this.getEventById(id);
  }

  /**
   * @param {object} input
   * @param {import("./core/model.js").NormalizedEvent} input.event
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.previous
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current
   * @param {Event | null} [input.nativeEvent]
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  #commitEventMove({ event, previous, current, nativeEvent = null }) {
    return this.#commitEventMutation({ event, previous, current, name: "calendar:eventmove", nativeEvent });
  }

  /**
   * @param {object} input
   * @param {import("./core/model.js").NormalizedEvent} input.event
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.previous
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current
   * @param {Event | null} [input.nativeEvent]
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  #commitEventResize({ event, previous, current, nativeEvent = null }) {
    return this.#commitEventMutation({ event, previous, current, name: "calendar:eventresize", nativeEvent });
  }

  /**
   * Non-pointer equivalent of dragging an event. Runs the same optimistic
   * commit as the pointer path, so keyboard and application commands share
   * one contract.
   *
   * @param {string | number} id
   * @param {{ start?: unknown, end?: unknown, resourceId?: string | null }} current
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  moveEvent(id, current) {
    const event = this.getEventById(id);
    if (!event || !isMovable(event, this.#config.editable)) return null;
    return this.#commitEventMove({
      event,
      previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
      current: {
        start: current.start ?? event.start,
        end: current.end ?? event.end,
        resourceId: current.resourceId ?? event.resourceId ?? null,
      },
    });
  }

  /**
   * Non-pointer equivalent of resizing an event. Runs the same optimistic
   * commit as the pointer path.
   *
   * @param {string | number} id
   * @param {{ start?: unknown, end?: unknown }} current
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  resizeEvent(id, current) {
    const event = this.getEventById(id);
    if (!event || !isResizable(event, this.#config.editable)) return null;
    // All-day events resize by day edges, not wall-clock minutes: the v0.x
    // time-grid wire-up for that is not shipped yet, so refuse loudly.
    if (event.allDay) return null;
    return this.#commitEventResize({
      event,
      previous: { start: event.start, end: event.end, resourceId: event.resourceId ?? null },
      current: {
        start: current.start ?? event.start,
        end: current.end ?? event.end,
        resourceId: event.resourceId ?? null,
      },
    });
  }

  /**
   * @param {import("./core/model.js").EventInput} event
   * @returns {import("./core/model.js").NormalizedEvent}
   */
  addEvent(event) {
    const normalized = normalizeEvent(event);
    this.#events = [...this.#events, normalized];
    this.#queueRender();
    return normalized;
  }

  /**
   * @param {import("./core/model.js").EventInput} event
   * @returns {import("./core/model.js").NormalizedEvent}
   */
  updateEvent(event) {
    const normalized = normalizeEvent(event);
    const index = this.#events.findIndex((item) => item.id === normalized.id);
    if (index < 0) return this.addEvent(normalized);
    this.#events = this.#events.map((item, i) =>
      i === index ? { ...this.#events[index], ...normalized } : item,
    );
    this.#queueRender();
    return this.#events[index];
  }

  /**
   * @param {string | number} id
   * @returns {boolean}
   */
  removeEvent(id) {
    const key = String(id);
    const next = this.#events.filter((event) => event.id !== key);
    if (next.length === this.#events.length) return false;
    this.#events = next;
    this.#queueRender();
    return true;
  }

  /**
   * Register an application-owned element as an external drop source
   * (external placement). The element becomes
   * `draggable`; while it is dragged over the rendered grid, the core draws
   * a placement preview from `meta` and, on a real drop, dispatches
   * `calendar:externaldrop` with the opaque `payload` and the resolved
   * target anchor. The calendar never interprets the payload.
   *
   * @param {HTMLElement} element
   * @param {unknown} payload opaque to the calendar
   * @param {ExternalDropMeta} [meta]
   * @returns {this}
   */
  addExternalDrop(element, payload, meta = {}) {
    if (this.#externalDrops.has(element)) return this;
    element.draggable = true;
    const entry = { payload, meta };
    /** @param {DragEvent} event @returns {void} */
    const onStart = (event) => {
      this.#dragExternal = entry;
      // Informative only: `dataTransfer` cannot carry the opaque payload
      // once it leaves the page, the in-memory `#dragExternal` does.
      event.dataTransfer?.setData("text/plain", String(payload ?? ""));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    };
    const onEnd = () => {
      this.#dragExternal = null;
    };
    element.addEventListener("dragstart", onStart);
    element.addEventListener("dragend", onEnd);
    this.#externalDrops.set(element, { ...entry, onStart, onEnd });
    return this;
  }

  /**
   * @param {HTMLElement} element
   * @returns {boolean} true when a source was removed
   */
  removeExternalDrop(element) {
    const entry = this.#externalDrops.get(element);
    if (!entry) return false;
    element.removeEventListener("dragstart", entry.onStart);
    element.removeEventListener("dragend", entry.onEnd);
    element.draggable = false;
    this.#externalDrops.delete(element);
    if (this.#dragExternal?.payload === entry.payload) this.#dragExternal = null;
    return true;
  }

  /**
   * @template T
   * @param {() => T} callback
   * @returns {T}
   */
  batch(callback) {
    this.#batchDepth += 1;
    try {
      return callback();
    } finally {
      this.#batchDepth -= 1;
      if (this.#batchDepth === 0) this.#queueRender();
    }
  }

  async refetchEvents() {
    const eventSource = this.#config.eventSource;
    const backgroundSource = this.#config.backgroundSource;
    if (!eventSource && !backgroundSource) return;

    this.#abortController?.abort();
    const controller = new AbortController();
    this.#abortController = controller;
    const version = ++this.#requestVersion;
    const { start, end } = this.getVisibleRange();
    // Source scope follows selected resources, not the renderer type:
    // solo with an active resource sends ["resource-a"], [] means no filter.
    const resourceIds = this.#resources.map((resource) => resource.id);
    const context = { start, end, resourceIds, signal: controller.signal, calendar: this };

    this.setAttribute("aria-busy", "true");
    this.#announceLoading(true);
    try {
      const [events, backgrounds] = await Promise.all([
        eventSource ? eventSource(context) : null,
        backgroundSource ? backgroundSource(context) : null,
      ]);
      if (controller.signal.aborted || version !== this.#requestVersion) return;
      // Each collection is replaced only by its own source. Reading the
      // other one before the await and writing it back here would undo the
      // incremental mutations (`addEvent`, `updateEvent`, `removeEvent`)
      // an application applied while the request was in flight.
      if (eventSource) {
        this.#events = Array.from(
          /** @type {import("./core/model.js").EventInput[]} */ (events ?? []),
          normalizeEvent,
        );
      }
      if (backgroundSource) {
        this.#backgrounds = Array.from(
          /** @type {import("./core/model.js").BackgroundInput[]} */ (backgrounds ?? []),
          normalizeBackground,
        );
      }
      this.#queueRender();
    } catch (error) {
      if (controller.signal.aborted) return;
      this.dispatchEvent(new CustomEvent("calendar:loaderror", { detail: { error } }));
    } finally {
      // Only the newest request settles the busy state: an aborted or stale
      // one is always followed by a request that is still in flight.
      if (version === this.#requestVersion) {
        this.removeAttribute("aria-busy");
        this.#announceLoading(false);
      }
    }
  }

  /**
   * Observable counterpart of `aria-busy`, so an application can render its
   * own pending state instead of reading an attribute off the element.
   *
   * @param {boolean} loading
   * @returns {void}
   */
  #announceLoading(loading) {
    this.dispatchEvent(
      new CustomEvent("calendar:loading", {
        bubbles: true,
        composed: true,
        detail: { loading },
      }),
    );
  }

  #queueRender() {
    if (this.#batchDepth || this.#renderQueued) return;
    this.#renderQueued = true;
    requestAnimationFrame(() => {
      this.#renderQueued = false;
      // A state change made while detached is covered by the next
      // `connectedCallback`, so no work survives a disconnect.
      if (!this.isConnected) return;
      this.#render();
    });
  }

  /**
   * Post-render lifecycle primitive. Runs `callback` once the
   * pending render has inserted its subtree, after the `calendar:render`
   * dispatch. Not a scheduler: no retries, promises or priorities. Callbacks
   * queued from inside a drain run on the next render, and the queue is
   * dropped on `disconnectedCallback`.
   *
   * @param {() => void} callback
   * @param {() => void} [onCancel] run in its place if the queue is dropped
   * @returns {void}
   */
  #afterRender(callback, onCancel) {
    this.#afterRenderQueue.push({ run: callback, cancel: onCancel });
    this.#queueRender();
  }

  /**
   * Polite announcement for view/date changes and keyboard commits. The
   * status node is reused across renders, so the write lands on the
   * `#afterRender` seam with at most one cancellable frame for a11y timing;
   * the last message wins.
   *
   * @param {string} message
   * @returns {void}
   */
  #announce(message) {
    this.#pendingAnnounce = message;
    this.#afterRender(() => {
      if (this.#announceFrame !== null) cancelAnimationFrame(this.#announceFrame);
      this.#announceFrame = requestAnimationFrame(() => {
        this.#announceFrame = null;
        if (!this.isConnected) return;
        const pending = this.#pendingAnnounce;
        this.#pendingAnnounce = null;
        if (pending === null) return;
        const status = this.querySelector(".cv-status");
        if (status) status.textContent = pending;
      });
    });
  }

  /**
   * Refocus an event once the pending render re-inserted the grid. The node
   * exists synchronously after `#render`, so no extra frame is needed.
   *
   * @param {string} id
   * @returns {void}
   */
  #refocusEvent(id) {
    this.#afterRender(() => {
      if (!this.isConnected) return;
      /** @type {HTMLElement | null} */ (this.querySelector(`[data-event-id="${CSS.escape(id)}"]`))?.focus();
    });
  }

  /**
   * Options that drive date derivation. They live together because
   * `getVisibleRange()`, navigation and rendering must all agree on which
   * dates exist. Only an explicit `configure({ locale })` suggests
   * `firstDay`: the `lang` attribute and document language feed formatting
   * alone, so date math never shifts implicitly with the document.
   *
   * @returns {{ firstDay: number | undefined, hiddenDays: number[] | undefined, locale: string | undefined }}
   */
  #dateOptions() {
    return {
      firstDay: this.#config.firstDay,
      hiddenDays: this.#config.hiddenDays,
      locale: resolveLocale(this.#config.locale),
    };
  }

  /**
   * BCP 47 locale for default formatting and `firstDay` suggestion.
   * Explicit `configure({ locale })` wins, then the `lang` attribute, then
   * the document language; blank means the runtime default.
   *
   * @returns {string | undefined}
   */
  #resolveLocale() {
    const docLang = typeof document === "undefined" ? undefined : document.documentElement?.lang;
    return resolveLocale(this.#config.locale ?? this.getAttribute("lang") ?? docLang);
  }

  #options() {
    return {
      timeZone: this.#config.timeZone ?? DEFAULTS.timeZone,
      locale: this.#resolveLocale(),
      labels: resolveLabels(this.#config.labels),
      editable: this.#config.editable,
      slotMin: this.getAttribute("slot-min") || DEFAULTS.slotMin,
      slotMax: this.getAttribute("slot-max") || DEFAULTS.slotMax,
      slotDuration: Number(this.getAttribute("slot-duration") || DEFAULTS.slotDuration),
      slotLabelInterval: this.#config.slotLabelInterval ?? DEFAULTS.slotLabelInterval,
      pxPerMinute: this.#config.pxPerMinute ?? DEFAULTS.pxPerMinute,
      snapDuration: this.#config.snapDuration ?? DEFAULTS.snapDuration,
      defaultTimedEventDuration: this.#config.defaultTimedEventDuration ?? DEFAULTS.defaultTimedEventDuration,
      monthEventLimit: this.#config.monthEventLimit ?? 3,
      allDaySlot: this.#config.allDaySlot ?? true,
    };
  }

  #render() {
    const options = this.#options();

    const dateOptions = this.#dateOptions();
    const dates = getVisibleDates(this.date, this.view, dateOptions);
    const resources = isResourceView(this.view) ? this.#resources : [];

    // `now` is whatever this render computes: one instant shared by the now
    // indicator, temporal states and the aging boundary. Never a clock
    // service; interaction decisions take their own `now` when they run.
    const now = Temporal.Now.zonedDateTimeISO(options.timeZone);

    const scroll = this.querySelector(".cv-scroller");
    const scrollTop = scroll?.scrollTop ?? 0;
    const scrollLeft = scroll?.scrollLeft ?? 0;
    // The live region outlives the grid so announcements scheduled before a
    // render are never lost when the subtree is replaced.
    const status = this.querySelector(":scope > .cv-status") ?? document.createElement("p");
    status.className = "cv-status";
    status.setAttribute("role", "status");

    this.replaceChildren();
    this.dataset.view = this.view;

    const scroller = document.createElement("div");
    scroller.className = "cv-scroller";
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", options.labels.calendarRegion);
    // Civil half-open scope of what this render paints; the aging timer only
    // watches boundaries inside it. Month weeks spill past the month, so the
    // scope follows the rendered weeks/dates, not the view range.
    /** @type {{ start: unknown, end: unknown } | null} */
    let visibleScope = null;
    if (this.view === "month") {
      const weeks = getMonthWeeks(this.date, dateOptions);
      scroller.append(
        renderMonthGrid({
          weeks,
          month: this.date.month,
          events: this.#events,
          options,
          now,
          eventContent: this.#config.eventContent,
          moreLinkContent: this.#config.moreLinkContent,
          getRangeContext: (range) => this.getRangeContext(range),
        }),
      );
      visibleScope = {
        start: weeks[0][0],
        end: weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1].add({ days: 1 }),
      };
    } else if (this.view === "list") {
      if (dates.length > 0) {
        visibleScope = { start: dates[0], end: dates[dates.length - 1].add({ days: 1 }) };
      }
      scroller.append(
        renderList({
          dates,
          events: this.#events,
          options,
          now,
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent,
        }),
      );
    } else {
      if (dates.length > 0) {
        visibleScope = { start: dates[0], end: dates[dates.length - 1].add({ days: 1 }) };
      }
      scroller.append(
        renderTimeGrid({
          dates,
          resources,
          resourceGroups: this.#resourceGroups,
          view: this.view,
          events: this.#events,
          backgrounds: this.#backgrounds,
          options,
          now,
          host: {
            editable: this.#config.editable,
            isConnected: () => this.isConnected,
            announce: (message) => this.#announce(message),
            refocusEvent: (id) => this.#refocusEvent(id),
            getRangeContext: (range) => this.getRangeContext(range),
            checkInteraction: (/** @type {Parameters<CalendarViewElement["checkInteraction"]>[0]} */ input) =>
              this.checkInteraction(input),
            commitEventMove: (input) => this.#commitEventMove(input),
            commitEventResize: (input) => this.#commitEventResize(input),
            getExternalDrag: () => this.#dragExternal,
            clearExternalDrag: () => {
              this.#dragExternal = null;
            },
            getPreview: () => this.#preview,
          },
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent,
          resourceHeaderContent: this.#config.resourceHeaderContent,
          resourceGroupContent: this.#config.resourceGroupContent,
          slotLabelContent: this.#config.slotLabelContent,
        }),
      );
    }
    this.append(scroller);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;

    this.append(status);

    // Dispatched once the whole subtree exists, so applications can decorate
    // rendered columns without observing mutations. Listeners that mutate
    // state simply queue the next frame, like any other mutation.
    this.dispatchEvent(
      new CustomEvent("calendar:render", {
        bubbles: true,
        composed: true,
        detail: { view: this.view, dates, resources },
      }),
    );

    // Post-render work (focus, announcements, future reveal highlight) runs
    // after app decorators so it sees the final subtree. Snapshot-and-clear:
    // callbacks queued from inside a drain run on the next render.
    const pending = this.#afterRenderQueue;
    this.#afterRenderQueue = [];
    for (const entry of pending) entry.run();

    // Temporal aging: one one-shot timer to the next visible event
    // boundary fires `queueRender()`; the next render recomputes states and
    // the following boundary. Cancelled/replaced on every render (so refetch
    // and navigation re-arm for free) and on `disconnectedCallback`.
    if (this.#agingTimer !== null) {
      clearTimeout(this.#agingTimer);
      this.#agingTimer = null;
    }
    const nextBoundary = nextStateChangeMs(
      this.#events,
      now.epochMilliseconds,
      options.timeZone,
      visibleScope,
    );
    if (nextBoundary !== null) {
      const delay = Math.min(Math.max(0, nextBoundary - now.epochMilliseconds), MAX_TIMEOUT_MS);
      if (delay > 0) {
        this.#agingTimer = window.setTimeout(() => {
          this.#agingTimer = null;
          if (!this.isConnected) return;
          this.#queueRender();
        }, delay);
      }
    }

    // Rendering is full replacement by design in 0.x; keyed reconciliation
    // and a consolidated pointer engine are roadmap debt (docs/ROADMAP.md).
  }
}
