/** Install a real tarball into an independent ESM consumer and render its bundle. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const consumer = mkdtempSync(join(tmpdir(), "calendar-consumer-"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const bun = /** @type {any} */ (globalThis).Bun;
try {
  const packArgs = ["pack", "--json"];
  const raw = execFileSync(
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
    process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...packArgs] : packArgs,
    {
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: join(consumer, "npm-cache"),
        npm_config_pack_destination: consumer,
      },
    },
  );
  const [packed] = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  assert.equal(packed.version, pkg.version);
  const tarballs = readdirSync(consumer).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, "npm pack must create one tarball");
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        [pkg.name]: `file:./${tarballs[0]}`,
        "temporal-polyfill": pkg.peerDependencies["temporal-polyfill"],
      },
    }),
  );
  execFileSync(process.execPath, ["install", "--ignore-scripts"], {
    cwd: consumer,
    stdio: "inherit",
    timeout: 120_000,
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: join(consumer, "bun-cache"), BUN_TMPDIR: consumer },
  });
  writeFileSync(
    join(consumer, "entry.js"),
    `
import { CalendarViewElement } from "@lekoala/calendar";
if (customElements.get("calendar-view")) throw new Error("Main entry registered the element");
await import("@lekoala/calendar/define");
await import("@lekoala/calendar/calendar.css");
if (customElements.get("calendar-view") !== CalendarViewElement) throw new Error("Registration failed");
const calendar = document.createElement("calendar-view");
calendar.setAttribute("date", "2026-11-06");
calendar.setAttribute("view", "day");
calendar.configure({ timeZone: "Europe/Brussels" });
calendar.events = [{ id: "smoke", title: "Installed event", allDay: true, start: "2026-11-06", end: "2026-11-07" }];
document.body.append(calendar);
`,
  );
  const build = await bun.build({
    entrypoints: [join(consumer, "entry.js")],
    outdir: join(consumer, "build"),
    target: "browser",
    splitting: false,
  });
  assert(build.success, String(build.logs));
  const js = build.outputs.find(
    /** @param {{ path: string }} output */ (output) => output.path.endsWith(".js"),
  );
  const css = build.outputs.find(
    /** @param {{ path: string }} output */ (output) => output.path.endsWith(".css"),
  );
  assert(js && css, "The installed JS and CSS exports must both bundle");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    /** @type {Error[]} */
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.setContent("<!doctype html><html><head></head><body></body></html>");
    await page.addStyleTag({ path: css.path });
    await page.addScriptTag({ path: js.path, type: "module" });
    await page.locator('[data-event-id="smoke"]').waitFor();
    assert.equal(await page.locator('[data-event-id="smoke"]').textContent(), "Installed event");
    assert.equal(
      await page.locator("calendar-view").evaluate((node) => getComputedStyle(node).display),
      "block",
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log(`Installed package smoke passed: ${pkg.name}@${pkg.version}`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
