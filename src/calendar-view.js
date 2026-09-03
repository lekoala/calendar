import { Temporal } from "temporal-polyfill";
import {
  getViewDays,
  getViewRange,
  getVisibleDates,
  isResourceView,
  minutesFromMidnight,
  toPlainDate,
} from "./core/dates.js";
import { normalizeBackground, normalizeEvent, normalizeResource } from "./core/model.js";
import { renderTimeGrid } from "./render/time-grid.js";

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

  _events = [];
  _resources = [];
  _backgrounds = [];
  _config = {};
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

  configure(options = {}) {
    this._config = { ...this._config, ...options };
    this._queueRender();
    return this;
  }

  get view() {
    return this.getAttribute("view") || DEFAULTS.view;
  }

  set view(value) {
    this.setView(value);
  }

  get date() {
    return toPlainDate(this.getAttribute("date"));
  }

  set date(value) {
    this.gotoDate(value);
  }

  get events() {
    return [...this._events];
  }

  set events(value) {
    this._events = Array.from(value ?? [], normalizeEvent);
    this._queueRender();
  }

  get resources() {
    return [...this._resources];
  }

  set resources(value) {
    this._resources = Array.from(value ?? [], normalizeResource);
    this._queueRender();
  }

  get backgrounds() {
    return [...this._backgrounds];
  }

  set backgrounds(value) {
    this._backgrounds = Array.from(value ?? [], normalizeBackground);
    this._queueRender();
  }

  setView(view) {
    const oldView = this.view;
    if (oldView === view) return;
    this.setAttribute("view", view);
    this.dispatchEvent(new CustomEvent("calendar:viewchange", { detail: { oldView, view } }));
    void this.refetchEvents();
  }

  gotoDate(value) {
    const next = toPlainDate(value).toString();
    const previous = this.getAttribute("date");
    if (previous === next) return;
    this.setAttribute("date", next);
    this.dispatchEvent(new CustomEvent("calendar:datechange", { detail: { date: toPlainDate(next) } }));
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

  scrollToTime(value) {
    const scroller = this.querySelector(".cv-scroller");
    if (!scroller) return 0;
    const options = this._options();
    const startMinutes = minutesFromMidnight(options.slotMin);
    const top = Math.max(0, (minutesFromMidnight(value) - startMinutes) * options.pxPerMinute);
    scroller.scrollTop = top;
    return top;
  }

  getEventById(id) {
    return this._events.find((event) => event.id === String(id)) ?? null;
  }

  addEvent(event) {
    const normalized = normalizeEvent(event);
    this._events = [...this._events, normalized];
    this._queueRender();
    return normalized;
  }

  updateEvent(event) {
    const normalized = normalizeEvent(event);
    const index = this._events.findIndex((item) => item.id === normalized.id);
    if (index < 0) return this.addEvent(normalized);
    this._events = this._events.with(index, { ...this._events[index], ...normalized });
    this._queueRender();
    return this._events[index];
  }

  removeEvent(id) {
    const key = String(id);
    const next = this._events.filter((event) => event.id !== key);
    if (next.length === this._events.length) return false;
    this._events = next;
    this._queueRender();
    return true;
  }

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
      this._events = Array.from(events ?? [], normalizeEvent);
      this._backgrounds = Array.from(backgrounds ?? [], normalizeBackground);
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

  _options() {
    return {
      timeZone: this._config.timeZone ?? DEFAULTS.timeZone,
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
    scroller.append(
      renderTimeGrid({
        dates,
        resources,
        events: this._events,
        backgrounds: this._backgrounds,
        options,
        eventContent: this._config.eventContent,
        dayHeaderContent: this._config.dayHeaderContent,
        resourceHeaderContent: this._config.resourceHeaderContent,
      }),
    );
    this.append(scroller);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;

    // TODO: use keyed/incremental reconciliation rather than full replacement.
    // TODO: route click/select/drag/resize through a dedicated pointer engine.
  }
}
