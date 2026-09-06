import { expect, test } from "@playwright/test";

/**
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Seed two events and install a counting policy. `rule` runs in the page:
 * a body string receiving ({ action, event, target, context }) and
 * returning true, false or a reason.
 * @param {import("@playwright/test").Page} page
 * @param {string} rule
 */
async function seedWithPolicy(page, rule) {
  await page.evaluate((body) => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.events = [
      {
        id: "a",
        title: "A",
        start: "2026-09-03T09:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
      },
      {
        id: "blocker",
        title: "Blocker",
        start: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
        end: "2026-09-03T11:00:00+02:00[Europe/Brussels]",
      },
    ];
    calendar.backgrounds = [];
    /** @type {any} */ (window).__policyCalls = [];
    /** @type {any} */ (window).__moves = [];
    /** @type {any} */ (window).__selects = [];
    const fn = new Function("input", body);
    calendar.configure({
      interactionPolicy: (/** @type {any} */ input) => {
        /** @type {any} */ (window).__policyCalls.push({
          action: input.action,
          event: input.event?.id ?? null,
          start: String(input.target.start),
          context: input.context.events.overlapping.map((/** @type {any} */ entry) => entry.id),
        });
        return fn(input);
      },
    });
    calendar.addEventListener("calendar:eventmove", () => /** @type {any} */ (window).__moves.push(1));
    calendar.addEventListener("calendar:select", () => /** @type {any} */ (window).__selects.push(1));
  }, rule);
  await flushRender(page);
  await flushRender(page);
}

/**
 * @param {import("@playwright/test").Page} page
 */
function policyCalls(page) {
  return page.evaluate(() => /** @type {any[]} */ (/** @type {any} */ (window).__policyCalls));
}

test("a refused resize renders no handles but leaves others alone", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(
    page,
    `return input.action === "resize" && input.event?.id === "a" ? "Locked" : true;`,
  );
  await expect(page.locator('[data-event-id="a"] .cv-resize-handle')).toHaveCount(0);
  await expect(page.locator('[data-event-id="blocker"] .cv-resize-handle')).toHaveCount(2);
});

test("a refused drag never starts: no mirror, no commit", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(page, `return input.action === "move" && input.event?.id === "a" ? "Locked" : true;`);
  const box = await page.locator('[data-event-id="a"]').boundingBox();
  if (!box) throw new Error("expected event a to have a bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 5 });
  await page.waitForTimeout(200);
  await expect(page.locator(".cv-drag-mirror")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(0);
  await expect(page.locator('[data-event-id="a"]')).toHaveAttribute(
    "aria-label",
    "A, 2026-09-03, 09:00 to 09:30",
  );
});

test("a refused select never arms: no selection intent", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(page, `return input.action === "select" ? "No creation here" : true;`);
  const body = page.locator(".cv-day-body").first();
  await body.waitFor({ state: "visible" });
  const box = await body.boundingBox();
  if (!box) throw new Error("expected a day body");
  await page.mouse.click(box.x + box.width / 2, box.y + 200);
  await page.waitForTimeout(200);
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__selects.length)).toBe(0);
});

test("a refused destination marks the mirror and blocks the commit", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(
    page,
    `if (input.action !== "move") return true;
     const ids = input.context.events.overlapping.map((e) => e.id).filter((id) => id !== input.event?.id);
     return ids.length > 0 ? "Occupied" : true;`,
  );
  const box = await page.locator('[data-event-id="a"]').boundingBox();
  if (!box) throw new Error("expected event a to have a bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // 09:00 -> ~10:10: the destination overlaps "blocker".
  await page.mouse.move(x, y + 120, { steps: 5 });
  await expect(page.locator(".cv-drag-mirror.cv-invalid")).toBeVisible();
  await expect(page.locator(".cv-drag-mirror")).toHaveAttribute("data-reason", "Occupied");
  await page.mouse.up();
  await page.waitForTimeout(200);
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(0);
  await expect(page.locator('[data-event-id="a"]')).toHaveAttribute(
    "aria-label",
    "A, 2026-09-03, 09:00 to 09:30",
  );
});

test("the policy runs once per snapped target, not per pointermove", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(page, `return true;`);
  const box = await page.locator('[data-event-id="a"]').boundingBox();
  if (!box) throw new Error("expected event a to have a bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 150, { steps: 12 });
  await page.mouse.up();
  const calls = (await policyCalls(page)).filter((call) => call.action === "move");
  expect(calls.length).toBeGreaterThan(0);
  for (let i = 1; i < calls.length; i += 1) {
    expect(calls[i].start).not.toBe(calls[i - 1].start);
  }
});

test("a refused keyboard move commits nothing and announces the reason", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(page, `return input.action === "move" ? "Locked" : true;`);
  await page.locator('[data-event-id="a"]').focus();
  await page.keyboard.press("Shift+ArrowDown");
  await page.waitForTimeout(200);
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__moves.length)).toBe(0);
  await expect(page.locator('[data-event-id="a"]')).toHaveAttribute(
    "aria-label",
    "A, 2026-09-03, 09:00 to 09:30",
  );
  await expect(page.locator(".cv-status")).toContainText("Locked");
});

test("programmatic moveEvent stays authoritative under a refusing policy", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(page, `return false;`);
  const moved = await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    return (
      calendar.moveEvent("a", {
        start: "2026-09-03T09:30:00+02:00[Europe/Brussels]",
        end: "2026-09-03T10:00:00+02:00[Europe/Brussels]",
      })?.id ?? null
    );
  });
  expect(moved).toBe("a");
});

test("an external drop consults the policy with action external and a null event", async ({ page }) => {
  await page.goto("/demo/basic.html");
  await seedWithPolicy(
    page,
    `if (input.action === "external") return "No external placements";
     return true;`,
  );
  const seen = await page.evaluate(async () => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    const source = document.createElement("button");
    source.id = "ext-src";
    source.textContent = "New block";
    document.body.append(source);
    calendar.addExternalDrop(source, { kind: "occurrence", ref: "ext-1" }, { duration: 60 });
    const body = /** @type {HTMLElement} */ (document.querySelector(".cv-day-body"));
    const rect = body.getBoundingClientRect();
    return new Promise((resolve) => {
      let dropped = false;
      calendar.addEventListener("calendar:externaldrop", () => {
        dropped = true;
      });
      const dt = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      /** @type {HTMLElement} */ (calendar.querySelector(".cv-grid")).dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + 120,
        }),
      );
      resolve({ dropped });
    });
  });
  expect(seen).toEqual({ dropped: false });
  const calls = await policyCalls(page);
  const external = calls.filter((call) => call.action === "external");
  expect(external.length).toBeGreaterThan(0);
  expect(external[0].event).toBe(null);
});
