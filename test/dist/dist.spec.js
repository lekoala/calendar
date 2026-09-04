import { expect, test } from "@playwright/test";

test("dist classic build registers and renders events", async ({ page }) => {
  await page.goto("/demo/dist.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(3);
});

test("dist minified CSS ships the core tokens", async ({ page }) => {
  const response = await page.request.get("/dist/calendar.min.css");
  expect(response.ok()).toBe(true);
  const css = await response.text();
  expect(css).toContain("--calendar-accent");
});

test("dist minified bundle self-registers the element", async ({ page }) => {
  await page.goto("/demo/dist.html");
  const tag = await page.evaluate(() => customElements.get("calendar-view")?.name ?? null);
  expect(tag).toBe("CalendarViewElement");
});

test("standalone build registers, styles and injects its CSS once", async ({ page }) => {
  // No <link> stylesheet on this page: all styling comes from the injected
  // <style> element the standalone script creates itself.
  await page.goto("/demo/dist-standalone.html");
  await expect(page.locator("calendar-view")).toBeVisible();
  await expect(page.locator(".cv-event")).toHaveCount(3);
  await expect(page.locator("#lekoala-calendar-style")).toHaveCount(1);
  const css = await page.evaluate(() => document.getElementById("lekoala-calendar-style")?.textContent ?? "");
  expect(css).toContain("--calendar-accent");
  // A structural rule from the component CSS is actually computed.
  const position = await page.evaluate(
    () => getComputedStyle(/** @type {any} */ (document.querySelector(".cv-event"))).position,
  );
  expect(position).toBe("absolute");
  // The script nonce propagates to the injected style. This helps only when
  // the same nonce is allowed by style-src, not just by script-src.
  const nonce = await page.evaluate(() => document.getElementById("lekoala-calendar-style")?.nonce ?? null);
  expect(nonce).toBe("standalone-test");
  // Loading the script again registers idempotently without duplicating CSS.
  // The minifier renames the class, so identity is checked by upgrade,
  // not by constructor name.
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../dist/calendar.standalone.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  });
  await expect(page.locator("#lekoala-calendar-style")).toHaveCount(1);
  const upgraded = await page.evaluate(() => {
    const Ctor = customElements.get("calendar-view");
    return Ctor != null && document.querySelector("calendar-view") instanceof Ctor;
  });
  expect(upgraded).toBe(true);
  await expect(page.locator(".cv-event")).toHaveCount(3);
});

test("standalone build exposes no globals", async ({ page }) => {
  await page.goto("/demo/dist-standalone.html");
  const leaked = await page.evaluate(() => "Calendar" in window || "CalendarView" in window);
  expect(leaked).toBe(false);
});
