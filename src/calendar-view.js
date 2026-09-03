import { Temporal } from "temporal-polyfill";
import {
  getViewDays,
  getViewRange,
  getVisibleDates,
  isResourceView,
  minutesFromMidnight,
  toPlainDate,
} from "./core/dates.js";
import {
  isMovable,
  isResizable,
  normalizeBackground,
  normalizeEvent,
  normalizeResource,
} from "./core/model.js";
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
 * @property {boolean} [editable]
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [eventSource]
 * @property {(query: EventSourceQuery) => Promise<unknown[]>} [backgroundSource]
 * @property {(info: object) => unknown} [eventContent]
 * @property {(info: object) => unknown} [dayHeaderContent]
 * @property {(info: object) => unknown} [resourceHeaderContent]
 */

const DEFAULTS = {
  view: "week",
  timeZone: "Europe/Brussels",
  slotMin: "08:00",
  slotMax: "18:00",
  slotDuration: 20,
  pxPerMinute: 1.8,
  snapDuration: Temporal.Duration.from({ minutes: 15 }),
  defaultTimedEventDuration: Temporal.Duration.from({ minutes: 30 }),
};

export class CalendarViewElement extends HTMLElement {
  static observedAttributes = ["view", "date", "slot-min", "slot-max", "slot-duration"];

  /** @type {Array<import("./core/model.js").NormalizedEvent>} */
  _events = [];
  /** @type {Array<import("./core/model.js").NormalizedResource>} */
  _resources = [];
  /** @type {Array<import("./core/model.js").NormalizedBackground>} */
  _backgrounds = [];
  /** @type {CalendarConfig} */
  _config = {};
  /** @type {AbortController | null} */
  _abortController = null;
  _requestVersion = 0;
  _batchDepth = 0;
  _renderQueued = false;

  connectedCallback() {
    this.classList.add("calendar-view");
    if (!this.hasAttribute("date")) {
      this.setAttribute("date", "2026-09-03");
    }
    this._queueRender();
  }

  disconnectedCallback() {
    this._abortController?.abort();
    // TODO: pointer engine/window listener teardown.
  }

  attributeChangedCallback() {
    if (this.isConnected) this._queueRender();
  }

  /**
   * @param {Partial<CalendarConfig>} [options]
   * @returns {this}
   */
  configure(options = {}) {
    this._config = { ...this._config, ...options };
    this._queueRender();
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
    return [...this._events];
  }

  /** @param {import("./core/model.js").EventInput[] | null | undefined} value */
  set events(value) {
    this._events = Array.from(value ?? [], normalizeEvent);
    this._queueRender();
  }

  get resources() {
    return [...this._resources];
  }

  /** @param {import("./core/model.js").ResourceInput[] | null | undefined} value */
  set resources(value) {
    this._resources = Array.from(value ?? [], normalizeResource);
    this._queueRender();
  }

  get backgrounds() {
    return [...this._backgrounds];
  }

  /** @param {import("./core/model.js").BackgroundInput[] | null | undefined} value */
  set backgrounds(value) {
    this._backgrounds = Array.from(value ?? [], normalizeBackground);
    this._queueRender();
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
    this._announce(`${view}, ${this.getAttribute("date")}`);
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
    this._announce(`${this.view}, ${next}`);
    void this.refetchEvents();
  }

  getVisibleRange() {
    return getViewRange(this.date, this.view);
  }

  prev() {
    this.gotoDate(this.date.add({ days: -getViewDays(this.view) }));
  }

  next() {
    this.gotoDate(this.date.add({ days: getViewDays(this.view) }));
  }

  today() {
    const timeZone = this._config.timeZone ?? DEFAULTS.timeZone;
    this.gotoDate(Temporal.Now.plainDateISO(timeZone));
  }

  /**
   * @param {Temporal.PlainTime | string} value
   * @returns {number}
   */
  scrollToTime(value) {
    const scroller = this.querySelector(".cv-scroller");
    if (!scroller) return 0;
    const options = this._options();
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
    return this._events.find((event) => event.id === String(id)) ?? null;
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
  _commitEventMutation({ event, previous, current, name, nativeEvent }) {
    const index = this._events.findIndex((item) => item.id === event.id);
    if (index < 0) return null;
    const before = this._events[index];
    /**
     * @param {{ start: unknown, end: unknown, resourceId: string | null }} state
     * @returns {void}
     */
    const apply = (state) => {
      this._events = this._events.map((item, i) => (i === index ? { ...item, ...state } : item));
      this._queueRender();
    };
    apply({ start: current.start, end: current.end, resourceId: current.resourceId });
    let reverted = false;
    const revert = () => {
      if (reverted) return;
      reverted = true;
      this._events = this._events.map((item, i) => (i === index ? before : item));
      this._queueRender();
    };
    const accepted = this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { event: this._events[index], previous, current, nativeEvent, revert },
      }),
    );
    if (!accepted) revert();
    return reverted ? null : this._events[index];
  }

  /**
   * @param {object} input
   * @param {import("./core/model.js").NormalizedEvent} input.event
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.previous
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current
   * @param {Event | null} [input.nativeEvent]
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  _commitEventMove({ event, previous, current, nativeEvent = null }) {
    return this._commitEventMutation({ event, previous, current, name: "calendar:eventmove", nativeEvent });
  }

  /**
   * @param {object} input
   * @param {import("./core/model.js").NormalizedEvent} input.event
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.previous
   * @param {{ start: unknown, end: unknown, resourceId: string | null }} input.current
   * @param {Event | null} [input.nativeEvent]
   * @returns {import("./core/model.js").NormalizedEvent | null}
   */
  _commitEventResize({ event, previous, current, nativeEvent = null }) {
    return this._commitEventMutation({ event, previous, current, name: "calendar:eventresize", nativeEvent });
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
    if (!event || !isMovable(event, this._config.editable)) return null;
    return this._commitEventMove({
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
    if (!event || !isResizable(event, this._config.editable)) return null;
    return this._commitEventResize({
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
    this._events = [...this._events, normalized];
    this._queueRender();
    return normalized;
  }

  /**
   * @param {import("./core/model.js").EventInput} event
   * @returns {import("./core/model.js").NormalizedEvent}
   */
  updateEvent(event) {
    const normalized = normalizeEvent(event);
    const index = this._events.findIndex((item) => item.id === normalized.id);
    if (index < 0) return this.addEvent(normalized);
    this._events = this._events.map((item, i) =>
      i === index ? { ...this._events[index], ...normalized } : item,
    );
    this._queueRender();
    return this._events[index];
  }

  /**
   * @param {string | number} id
   * @returns {boolean}
   */
  removeEvent(id) {
    const key = String(id);
    const next = this._events.filter((event) => event.id !== key);
    if (next.length === this._events.length) return false;
    this._events = next;
    this._queueRender();
    return true;
  }

  /**
   * @template T
   * @param {() => T} callback
   * @returns {T}
   */
  batch(callback) {
    this._batchDepth += 1;
    try {
      return callback();
    } finally {
      this._batchDepth -= 1;
      if (this._batchDepth === 0) this._queueRender();
    }
  }

  async refetchEvents() {
    const eventSource = this._config.eventSource;
    const backgroundSource = this._config.backgroundSource;
    if (!eventSource && !backgroundSource) return;

    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    const version = ++this._requestVersion;
    const { start, end } = this.getVisibleRange();
    // Source scope follows selected resources, not the renderer type:
    // solo with an active resource sends ["resource-a"], [] means no filter.
    const resourceIds = this._resources.map((resource) => resource.id);
    const context = { start, end, resourceIds, signal: controller.signal, calendar: this };

    this.setAttribute("aria-busy", "true");
    try {
      const [events, backgrounds] = await Promise.all([
        eventSource ? eventSource(context) : this._events,
        backgroundSource ? backgroundSource(context) : this._backgrounds,
      ]);
      if (controller.signal.aborted || version !== this._requestVersion) return;
      this._events = Array.from(
        /** @type {import("./core/model.js").EventInput[]} */ (events ?? []),
        normalizeEvent,
      );
      this._backgrounds = Array.from(
        /** @type {import("./core/model.js").BackgroundInput[]} */ (backgrounds ?? []),
        normalizeBackground,
      );
      this._queueRender();
    } catch (error) {
      if (controller.signal.aborted) return;
      this.dispatchEvent(new CustomEvent("calendar:loaderror", { detail: { error } }));
    } finally {
      if (version === this._requestVersion) this.removeAttribute("aria-busy");
    }
  }

  _queueRender() {
    if (this._batchDepth || this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this._render();
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
  _announce(message) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        const status = this.querySelector(".cv-status");
        if (status) status.textContent = message;
      }),
    );
  }

  _options() {
    return {
      timeZone: this._config.timeZone ?? DEFAULTS.timeZone,
      editable: this._config.editable,
      slotMin: this.getAttribute("slot-min") || DEFAULTS.slotMin,
      slotMax: this.getAttribute("slot-max") || DEFAULTS.slotMax,
      slotDuration: Number(this.getAttribute("slot-duration") || DEFAULTS.slotDuration),
      pxPerMinute: this._config.pxPerMinute ?? DEFAULTS.pxPerMinute,
      snapDuration: this._config.snapDuration ?? DEFAULTS.snapDuration,
      defaultTimedEventDuration: this._config.defaultTimedEventDuration ?? DEFAULTS.defaultTimedEventDuration,
    };
  }

  _render() {
    const options = this._options();

    const dates = getVisibleDates(this.date, this.view);
    const resources = isResourceView(this.view) ? this._resources : [];

    const scroll = this.querySelector(".cv-scroller");
    const scrollTop = scroll?.scrollTop ?? 0;
    const scrollLeft = scroll?.scrollLeft ?? 0;

    this.replaceChildren();
    this.dataset.view = this.view;

    const scroller = document.createElement("div");
    scroller.className = "cv-scroller";
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "Calendar");
    scroller.append(
      renderTimeGrid({
        dates,
        resources,
        view: this.view,
        events: this._events,
        backgrounds: this._backgrounds,
        options,
        calendar: this,
        eventContent: this._config.eventContent,
        dayHeaderContent: this._config.dayHeaderContent,
        resourceHeaderContent: this._config.resourceHeaderContent,
      }),
    );
    this.append(scroller);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;

    const status = document.createElement("p");
    status.className = "cv-status";
    status.setAttribute("role", "status");
    this.append(status);

    // TODO: use keyed/incremental reconciliation rather than full replacement.
    // TODO: route click/select/drag/resize through a dedicated pointer engine.
  }
}
