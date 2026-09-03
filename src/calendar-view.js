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

  #events = [];
  #resources = [];
  #backgrounds = [];
  #config = {};
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

  configure(options = {}) {
    this.#config = { ...this.#config, ...options };
    this.#queueRender();
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
    return [...this.#events];
  }

  set events(value) {
    this.#events = Array.from(value ?? [], normalizeEvent);
    this.#queueRender();
  }

  get resources() {
    return [...this.#resources];
  }

  set resources(value) {
    this.#resources = Array.from(value ?? [], normalizeResource);
    this.#queueRender();
  }

  get backgrounds() {
    return [...this.#backgrounds];
  }

  set backgrounds(value) {
    this.#backgrounds = Array.from(value ?? [], normalizeBackground);
    this.#queueRender();
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
    const timeZone = this.#config.timeZone ?? DEFAULTS.timeZone;
    this.gotoDate(Temporal.Now.plainDateISO(timeZone));
  }

  scrollToTime(value) {
    const scroller = this.querySelector(".cv-scroller");
    if (!scroller) return 0;
    const options = this.#options();
    const startMinutes = minutesFromMidnight(options.slotMin);
    const top = Math.max(0, (minutesFromMidnight(value) - startMinutes) * options.pxPerMinute);
    scroller.scrollTop = top;
    return top;
  }

  getEventById(id) {
    return this.#events.find((event) => event.id === String(id)) ?? null;
  }

  addEvent(event) {
    const normalized = normalizeEvent(event);
    this.#events = [...this.#events, normalized];
    this.#queueRender();
    return normalized;
  }

  updateEvent(event) {
    const normalized = normalizeEvent(event);
    const index = this.#events.findIndex((item) => item.id === normalized.id);
    if (index < 0) return this.addEvent(normalized);
    this.#events = this.#events.with(index, { ...this.#events[index], ...normalized });
    this.#queueRender();
    return this.#events[index];
  }

  removeEvent(id) {
    const key = String(id);
    const next = this.#events.filter((event) => event.id !== key);
    if (next.length === this.#events.length) return false;
    this.#events = next;
    this.#queueRender();
    return true;
  }

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
    try {
      const [events, backgrounds] = await Promise.all([
        eventSource ? eventSource(context) : this.#events,
        backgroundSource ? backgroundSource(context) : this.#backgrounds,
      ]);
      if (controller.signal.aborted || version !== this.#requestVersion) return;
      this.#events = Array.from(events ?? [], normalizeEvent);
      this.#backgrounds = Array.from(backgrounds ?? [], normalizeBackground);
      this.#queueRender();
    } catch (error) {
      if (controller.signal.aborted) return;
      this.dispatchEvent(new CustomEvent("calendar:loaderror", { detail: { error } }));
    } finally {
      if (version === this.#requestVersion) this.removeAttribute("aria-busy");
    }
  }

  #queueRender() {
    if (this.#batchDepth || this.#renderQueued) return;
    this.#renderQueued = true;
    requestAnimationFrame(() => {
      this.#renderQueued = false;
      this.#render();
    });
  }

  #options() {
    return {
      timeZone: this.#config.timeZone ?? DEFAULTS.timeZone,
      slotMin: this.getAttribute("slot-min") || DEFAULTS.slotMin,
      slotMax: this.getAttribute("slot-max") || DEFAULTS.slotMax,
      slotDuration: Number(this.getAttribute("slot-duration") || DEFAULTS.slotDuration),
      pxPerMinute: this.#config.pxPerMinute ?? DEFAULTS.pxPerMinute,
      snapDuration: this.#config.snapDuration ?? DEFAULTS.snapDuration,
      defaultTimedEventDuration: this.#config.defaultTimedEventDuration ?? DEFAULTS.defaultTimedEventDuration,
    };
  }

  #render() {
    const options = this.#options();

    const dates = getVisibleDates(this.date, this.view);
    const resources = isResourceView(this.view) ? this.#resources : [];

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
        events: this.#events,
        backgrounds: this.#backgrounds,
        options,
        eventContent: this.#config.eventContent,
        dayHeaderContent: this.#config.dayHeaderContent,
        resourceHeaderContent: this.#config.resourceHeaderContent,
      }),
    );
    this.append(scroller);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;

    // TODO: use keyed/incremental reconciliation rather than full replacement.
    // TODO: route click/select/drag/resize through a dedicated pointer engine.
  }
}
