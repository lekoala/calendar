import { Temporal } from "temporal-polyfill";
import {
  getMonthWeeks,
  getViewRange,
  getVisibleDates,
  isResourceView,
  minutesFromMidnight,
  stepAnchor,
  toPlainDate,
} from "./core/dates.js";
import {
  isMovable,
  isResizable,
  normalizeBackground,
  normalizeEvent,
  normalizeResource,
} from "./core/model.js";
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
 * @property {number} [pxPerMinute]
 * @property {Temporal.Duration | { minutes: number }} [snapDuration]
 * @property {Temporal.Duration | { minutes: number }} [defaultTimedEventDuration]
 * @property {number} [monthEventLimit] event chips per month day cell before `+n more`
 * @property {number} [firstDay] first weekday of a civil week, ISO 1-7 (default 1, Monday)
 * @property {number[]} [hiddenDays] weekdays never rendered, ISO 1-7
 * @property {number} [slotLabelInterval] minutes between time axis labels (default 60)
 * @property {boolean} [editable]
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [eventSource]
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [backgroundSource]
 * @property {(info: object) => unknown} [eventContent]
 * @property {(info: object) => unknown} [dayHeaderContent]
 * @property {(info: object) => unknown} [resourceHeaderContent]
 * @property {(info: object) => unknown} [slotLabelContent]
 * @property {(info: object) => unknown} [moreLinkContent]
 */

const DEFAULTS = {
  view: "week",
  timeZone: "Europe/Brussels",
  slotMin: "08:00",
  slotMax: "18:00",
  slotDuration: 20,
  slotLabelInterval: 60,
  pxPerMinute: 1.8,
  snapDuration: Temporal.Duration.from({ minutes: 15 }),
  defaultTimedEventDuration: Temporal.Duration.from({ minutes: 30 }),
};

export class CalendarViewElement extends HTMLElement {
  static observedAttributes = ["view", "date", "slot-min", "slot-max", "slot-duration"];

  /** @type {Array<import("./core/model.js").NormalizedEvent>} */
  #events = [];
  /** @type {Array<import("./core/model.js").NormalizedResource>} */
  #resources = [];
  /** @type {Array<import("./core/model.js").NormalizedBackground>} */
  #backgrounds = [];
  /** @type {CalendarConfig} */
  #config = {};
  /** @type {AbortController | null} */
  #abortController = null;
  #requestVersion = 0;
  #batchDepth = 0;
  #renderQueued = false;

  connectedCallback() {
    this.classList.add("calendar-view");
    if (!this.hasAttribute("date")) {
      this.setAttribute("date", "2026-09-03");
    }
    this.#queueRender();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    // TODO: pointer engine/window listener teardown.
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
   * @param {Temporal.PlainDate | string} value
   * @returns {void}
   */
  gotoDate(value) {
    const next = toPlainDate(value).toString();
    const previous = this.getAttribute("date");
    if (previous === next) return;
    this.setAttribute("date", next);
    this.dispatchEvent(new CustomEvent("calendar:datechange", { detail: { date: toPlainDate(next) } }));
    this.#announce(`${this.view}, ${next}`);
    void this.refetchEvents();
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
    const index = this.#events.findIndex((item) => item.id === event.id);
    if (index < 0) return null;
    const before = this.#events[index];
    /**
     * @param {{ start: unknown, end: unknown, resourceId: string | null }} state
     * @returns {void}
     */
    const apply = (state) => {
      this.#events = this.#events.map((item, i) => (i === index ? { ...item, ...state } : item));
      this.#queueRender();
    };
    apply({ start: current.start, end: current.end, resourceId: current.resourceId });
    let reverted = false;
    const revert = () => {
      if (reverted) return;
      reverted = true;
      this.#events = this.#events.map((item, i) => (i === index ? before : item));
      this.#queueRender();
    };
    const accepted = this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { event: this.#events[index], previous, current, nativeEvent, revert },
      }),
    );
    if (!accepted) revert();
    return reverted ? null : this.#events[index];
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
        eventSource ? eventSource(context) : this.#events,
        backgroundSource ? backgroundSource(context) : this.#backgrounds,
      ]);
      if (controller.signal.aborted || version !== this.#requestVersion) return;
      this.#events = Array.from(
        /** @type {import("./core/model.js").EventInput[]} */ (events ?? []),
        normalizeEvent,
      );
      this.#backgrounds = Array.from(
        /** @type {import("./core/model.js").BackgroundInput[]} */ (backgrounds ?? []),
        normalizeBackground,
      );
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
      this.#render();
    });
  }

  /**
   * Polite announcement for view/date changes and keyboard commits. The
   * status node is rebuilt on every render, so the message is written after
   * the next frame flush; the last message wins.
   *
   * @param {string} message
   * @returns {void}
   */
  #announce(message) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        const status = this.querySelector(".cv-status");
        if (status) status.textContent = message;
      }),
    );
  }

  /**
   * Refocus an event after an optimistic commit re-rendered the grid.
   *
   * @param {string} id
   * @returns {void}
   */
  #refocusEvent(id) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        /** @type {HTMLElement | null} */ (
          this.querySelector(`[data-event-id="${CSS.escape(id)}"]`)
        )?.focus();
      }),
    );
  }

  /**
   * Options that drive date derivation. They live together because
   * `getVisibleRange()`, navigation and rendering must all agree on which
   * dates exist.
   *
   * @returns {{ firstDay: number | undefined, hiddenDays: number[] | undefined }}
   */
  #dateOptions() {
    return { firstDay: this.#config.firstDay, hiddenDays: this.#config.hiddenDays };
  }

  #options() {
    return {
      timeZone: this.#config.timeZone ?? DEFAULTS.timeZone,
      editable: this.#config.editable,
      slotMin: this.getAttribute("slot-min") || DEFAULTS.slotMin,
      slotMax: this.getAttribute("slot-max") || DEFAULTS.slotMax,
      slotDuration: Number(this.getAttribute("slot-duration") || DEFAULTS.slotDuration),
      slotLabelInterval: this.#config.slotLabelInterval ?? DEFAULTS.slotLabelInterval,
      pxPerMinute: this.#config.pxPerMinute ?? DEFAULTS.pxPerMinute,
      snapDuration: this.#config.snapDuration ?? DEFAULTS.snapDuration,
      defaultTimedEventDuration: this.#config.defaultTimedEventDuration ?? DEFAULTS.defaultTimedEventDuration,
      monthEventLimit: this.#config.monthEventLimit ?? 3,
    };
  }

  #render() {
    const options = this.#options();

    const dateOptions = this.#dateOptions();
    const dates = getVisibleDates(this.date, this.view, dateOptions);
    const resources = isResourceView(this.view) ? this.#resources : [];

    const scroll = this.querySelector(".cv-scroller");
    const scrollTop = scroll?.scrollTop ?? 0;
    const scrollLeft = scroll?.scrollLeft ?? 0;

    this.replaceChildren();
    this.dataset.view = this.view;

    const scroller = document.createElement("div");
    scroller.className = "cv-scroller";
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "Calendar");
    if (this.view === "month") {
      scroller.append(
        renderMonthGrid({
          weeks: getMonthWeeks(this.date, dateOptions),
          month: this.date.month,
          events: this.#events,
          options,
          eventContent: this.#config.eventContent,
          moreLinkContent: this.#config.moreLinkContent,
        }),
      );
    } else if (this.view === "list") {
      scroller.append(
        renderList({
          dates,
          events: this.#events,
          options,
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent,
        }),
      );
    } else {
      scroller.append(
        renderTimeGrid({
          dates,
          resources,
          view: this.view,
          events: this.#events,
          backgrounds: this.#backgrounds,
          options,
          host: {
            editable: this.#config.editable,
            isConnected: () => this.isConnected,
            announce: (message) => this.#announce(message),
            refocusEvent: (id) => this.#refocusEvent(id),
            commitEventMove: (input) => this.#commitEventMove(input),
            commitEventResize: (input) => this.#commitEventResize(input),
          },
          eventContent: this.#config.eventContent,
          dayHeaderContent: this.#config.dayHeaderContent,
          resourceHeaderContent: this.#config.resourceHeaderContent,
          slotLabelContent: this.#config.slotLabelContent,
        }),
      );
    }
    this.append(scroller);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;

    const status = document.createElement("p");
    status.className = "cv-status";
    status.setAttribute("role", "status");
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

    // TODO: use keyed/incremental reconciliation rather than full replacement.
    // TODO: route click/select/drag/resize through a dedicated pointer engine.
  }
}
