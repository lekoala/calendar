/**
 * Application-owned move workbench (USE_CASES §12).
 *
 * Holds the list of events waiting to be placed elsewhere, plus the one
 * currently armed ("active") for a paste or drag. The workbench is the
 * single source of truth for that queue: cut, "park" and bulk fills all
 * converge on it, and it only emits `change` for its own UI to re-render.
 * It knows nothing about Temporal types or the calendar store.
 *
 * Dual distribution, mirroring how `dist/calendar.js` reaches the
 * classic-script showcase: the file sets `globalThis.MoveWorkbench` when
 * loaded as a plain `<script src>` (which works over file://, where module
 * fetches are CORS-blocked), and exports the same class when required from
 * the ESM unit tests via `module.exports`.
 *
 * @param {typeof globalThis} root
 * @param {() => typeof MoveWorkbench} factory
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = { MoveWorkbench: api };
  else Object.assign(root, { MoveWorkbench: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  class MoveWorkbench extends EventTarget {
    /** @type {Array<{ eventId: string, original: object, status: "pending" }>} */
    #items = [];
    /** @type {string | null} */
    #activeId = null;

    get items() {
      return this.#items.map((item) => ({ ...item }));
    }

    get activeId() {
      return this.#activeId;
    }

    /** @returns {{ eventId: string, original: object, status: string } | null} */
    get active() {
      return this.#items.find((item) => item.eventId === this.#activeId) ?? null;
    }

    /** @param {string | number} eventId */
    has(eventId) {
      return this.#items.some((item) => item.eventId === String(eventId));
    }

    get size() {
      return this.#items.length;
    }

    /**
     * @param {{ id: unknown, title?: unknown, start?: unknown, end?: unknown, resourceId?: unknown }} event
     * @param {boolean} announce true to emit a `change` beat (single-item adds)
     * @returns {boolean} true when the event was newly queued
     */
    add(event, announce = true) {
      if (this.has(String(event.id))) return false;
      this.#items.push({
        eventId: String(event.id),
        // The canonical event reference: display reads start/end/title off it,
        // and a future placement re-reads it for the move.
        original: event,
        status: "pending",
      });
      if (announce) this.#emit();
      return true;
    }

    /**
     * Queue many events in one gesture (one `change` beat).
     *
     * @param {Array<{ id: unknown }>} events
     * @returns {number} newly queued count
     */
    addMany(events) {
      let added = 0;
      for (const event of events) {
        if (this.add(event, false)) added += 1;
      }
      if (added > 0) this.#emit();
      return added;
    }

    /**
     * Arm (or disarm, with `null`) the active item. `Paste`/drag consume the
     * active item, never an implicit "first".
     *
     * @param {string | null} eventId
     */
    activate(eventId) {
      const next = eventId === null ? null : String(eventId);
      if (next !== null && !this.has(next)) return;
      if (this.#activeId === next) return;
      this.#activeId = next;
      this.#emit();
    }

    /**
     * @param {string | number} eventId
     * @returns {boolean}
     */
    remove(eventId) {
      const key = String(eventId);
      const index = this.#items.findIndex((item) => item.eventId === key);
      if (index < 0) return false;
      this.#items.splice(index, 1);
      if (this.#activeId === key) this.#activeId = null;
      this.#emit();
      return true;
    }

    /** @returns {void} */
    clear() {
      if (this.#items.length === 0 && this.#activeId === null) return;
      this.#items = [];
      this.#activeId = null;
      this.#emit();
    }

    /**
     * Success helper: drop a placed item and explicitly arm the next pending
     * one from the same queue position, so a keyboard `Paste` never picks an
     * implicit FIFO item on its own.
     *
     * @param {string | number} eventId
     * @returns {boolean}
     */
    complete(eventId) {
      const key = String(eventId);
      const index = this.#items.findIndex((item) => item.eventId === key);
      if (index < 0) return false;
      this.#items.splice(index, 1);
      const next = this.#items[index] ?? this.#items[index - 1] ?? null;
      this.#activeId = next?.eventId ?? null;
      this.#emit();
      return true;
    }

    /** @returns {void} */
    #emit() {
      this.dispatchEvent(new Event("change"));
    }
  }

  return MoveWorkbench;
});