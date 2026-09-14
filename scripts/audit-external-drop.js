import { chromium } from "@playwright/test";

// Run against `bun run dev`: bun scripts/audit-external-drop.js [baseURL] [--showcase]
// Measures synchronous hover work separately from the browser's native drag cadence.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => console.error(error.message));
  page.on("requestfailed", (request) => console.error(request.url(), request.failure()?.errorText));
  const showcase = process.argv.includes("--showcase");
  const baseURL = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "http://127.0.0.1:4173";
  await page.goto(`${baseURL}/demo/${showcase ? "showcase" : "basic"}.html`);
  if (showcase) {
    await page.locator('.cv-event[data-kind="planning"]').first().click({ button: "right" });
    await page.locator("#context-menu").getByRole("menuitem", { name: "Cut" }).click();
  } else {
    await page.locator(".cv-event").first().waitFor();
    await page.evaluate(async () => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      const seed = calendar.events[0];
      calendar.events = [
        ...calendar.events,
        ...Array.from({ length: 600 }, (_, i) => ({
          ...seed,
          id: `audit-${i}`,
          start: seed.start.add({ days: 30 + (i % 20) }),
          end: seed.end.add({ days: 30 + (i % 20) }),
        })),
      ];
      calendar.configure({ interactionPolicy: () => true });
      const source = document.createElement("button");
      source.id = "audit-source";
      document.body.append(source);
      calendar.addExternalDrop(source, {}, { duration: 30, title: "External event" });
      await new Promise(requestAnimationFrame);
    });
  }
  const report = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const source = /** @type {HTMLElement} */ (
      document.querySelector("#workbench-list button, #audit-source")
    );
    const root = /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid"));
    const body = /** @type {HTMLElement} */ (root.querySelector(".cv-day-body"));
    const rect = body.getBoundingClientRect();
    const dt = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    /** @type {Record<string, { calls: number, ms: number }>} */
    const methods = {};
    for (const name of ["checkInteraction", "getRangeContext", "getEventOverlaps"]) {
      const original = calendar[name].bind(calendar);
      methods[name] = { calls: 0, ms: 0 };
      calendar[name] = (/** @type {any[]} */ ...args) => {
        const start = performance.now();
        try {
          return original(...args);
        } finally {
          methods[name].calls += 1;
          methods[name].ms += performance.now() - start;
        }
      };
    }
    /** @type {Record<string, unknown>} */
    const results = {};
    for (const moving of [false, true]) {
      const observer = new MutationObserver(() => {});
      observer.observe(root, { childList: true, subtree: true });
      const start = performance.now();
      for (let i = 0; i < 120; i += 1) {
        root.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + 190 + (moving ? (i % 12) * 24 : i % 2),
          }),
        );
      }
      results[moving ? "moving" : "sameSlot"] = {
        ms: performance.now() - start,
        childListMutations: observer.takeRecords().length,
      };
      observer.disconnect();
    }
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    return { events: calendar.events.length, backgrounds: calendar.backgrounds.length, results, methods };
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
