import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Reusable page audit: loads a demo path on the local static server,
// reports console errors and page errors, and stores a screenshot in
// .temp/ on failure. Everything runs headless in this process, so no
// visible window is ever spawned.
//
// Usage: bun scripts/audit-page.js [/demo/]

const target = process.argv[2] ?? "/demo/";
const port = Number(process.env.PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

function startServer() {
  const server = spawn("bun", ["scripts/dev.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server did not start in time")), 10_000);
    server.stdout.on("data", () => {
      clearTimeout(timer);
      resolve(server);
    });
    server.on("error", reject);
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  });
}

const server = await startServer();
let failed = false;
try {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`[console] ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
    await page.goto(`${baseURL}${target}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    const summary = await page.evaluate(() => ({
      calendarViews: document.querySelectorAll("calendar-view").length,
      columns: document.querySelectorAll(".cv-day").length,
      events: document.querySelectorAll(".cv-event").length,
      nowIndicators: document.querySelectorAll(".cv-now").length,
    }));
    console.log(`audit ${target}`, JSON.stringify(summary));

    for (const error of errors) console.error(error);
    if (errors.length > 0) {
      failed = true;
      await mkdir(".temp", { recursive: true });
      const shot = `.temp/audit-${Date.now()}.png`;
      await page.screenshot({ path: shot });
      console.error(`screenshot: ${shot}`);
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
