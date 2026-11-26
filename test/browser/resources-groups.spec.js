import { expect, test } from "@playwright/test";
import { openDemo } from "./fixture.js";

/**
 * Resource grouping acceptance: one level, declared group order wins,
 * resources array order preserved within a group, unknown/missing group ids
 * trail ungrouped, first duplicate group id wins, and configured-but-empty
 * groups reserve no header space.
 *
 * @param {import("@playwright/test").Page} page
 */
function flushRender(page) {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {Array<{ id: string, title?: string, groupId?: string }>} resources
 * @param {Array<{ id: string, title?: string }>} resourceGroups
 */
async function setState(page, resources, resourceGroups) {
  await page.evaluate(
    ({ resources: res, resourceGroups: groups }) => {
      const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
      calendar.resources = res;
      calendar.resourceGroups = groups;
    },
    { resources, resourceGroups },
  );
  await flushRender(page);
}

test("group row renders one header per non-empty group spanning its columns", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(
    page,
    [
      { id: "r1", title: "one", groupId: "cardio" },
      { id: "r2", title: "two", groupId: "cardio" },
      { id: "r3", title: "three", groupId: "neuro" },
      { id: "r4", title: "four" },
    ],
    [
      { id: "cardio", title: "Cardiology" },
      { id: "neuro", title: "Neurology" },
    ],
  );
  // view is resourceThreeDays: 3 dates per resource.
  const headers = page.locator(".cv-group-header");
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(0)).toHaveAttribute("data-group-id", "cardio");
  await expect(headers.nth(0)).toContainText("Cardiology");
  await expect(headers.nth(0)).toHaveAttribute("style", /span 6/);
  await expect(headers.nth(1)).toHaveAttribute("data-group-id", "neuro");
  await expect(headers.nth(1)).toHaveAttribute("style", /span 3/);
});

test("resource and day columns follow the grouped order", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(
    page,
    [{ id: "r1", groupId: "b" }, { id: "r2", groupId: "a" }, { id: "r3", groupId: "a" }, { id: "r4" }],
    [{ id: "a" }, { id: "b" }],
  );
  const resources = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-resource-header")].map(
      (node) => /** @type {HTMLElement} */ (node).dataset.resourceId,
    ),
  );
  expect(resources).toEqual(["r2", "r3", "r1", "r4"]);
  const days = await page.evaluate(() =>
    [...document.querySelectorAll(".cv-day")].map(
      (node) => /** @type {HTMLElement} */ (node).dataset.resourceId,
    ),
  );
  expect(days).toEqual(["r2", "r2", "r2", "r3", "r3", "r3", "r1", "r1", "r1", "r4", "r4", "r4"]);
});

test("resourceGroupContent runs once per group with member list", async ({ page }) => {
  await openDemo(page, "resources");
  const calls = await page.evaluate(() => {
    const hooks = /** @type {any} */ (window);
    hooks.__groups = [];
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [
      { id: "r1", groupId: "a" },
      { id: "r2", groupId: "a" },
      { id: "r3", groupId: "b" },
      { id: "r4" },
    ];
    calendar.resourceGroups = [
      { id: "a", title: "Alpha" },
      { id: "b", title: "Beta" },
    ];
    calendar.configure({
      resourceGroupContent: (/** @type {any} */ info) => {
        hooks.__groups.push({
          id: info.group.id,
          members: info.resources.map((/** @type {any} */ resource) => resource.id),
          hasElement: info.element instanceof HTMLElement,
        });
        return info.group.title;
      },
    });
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(hooks.__groups))),
    );
  });
  expect(calls).toEqual([
    { id: "a", members: ["r1", "r2"], hasElement: true },
    { id: "b", members: ["r3"], hasElement: true },
  ]);
});

test("first duplicate group id wins and members render exactly once", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(
    page,
    [
      { id: "r1", groupId: "cardio" },
      { id: "r2", groupId: "cardio" },
    ],
    [
      { id: "cardio", title: "First" },
      { id: "cardio", title: "Second" },
    ],
  );
  const headers = page.locator(".cv-group-header");
  await expect(headers).toHaveCount(1);
  await expect(headers.nth(0)).toContainText("First");
  await expect(page.locator(".cv-resource-header")).toHaveCount(2);
});

test("configured groups with no matching resource render no group row", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(page, [{ id: "r1", title: "Room A" }], [{ id: "ghost", title: "Ghost" }]);
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-resource-header")).toHaveCount(1);
});

test("empty resources with groups configured show the explicit empty state", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(page, [], [{ id: "a", title: "Alpha" }]);
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-empty")).toHaveCount(1);
});

test("solo views never render a group or resource row", async ({ page }) => {
  await openDemo(page, "resources");
  await setState(
    page,
    [
      { id: "r1", groupId: "a" },
      { id: "r2", groupId: "a" },
    ],
    [{ id: "a", title: "Alpha" }],
  );
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("calendar-view")).setView("threeDays");
  });
  await flushRender(page);
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-resource-header")).toHaveCount(0);
});

for (const grouped of [false, true]) {
  test(`sticky headers follow custom row heights with groups ${grouped}`, async ({ page }) => {
    await openDemo(page, "resources");
    await page.evaluate((grouped) => {
      const calendar = /** @type {import("../../src/calendar-view.js").CalendarViewElement} */ (
        document.querySelector("calendar-view")
      );
      calendar.resources = [{ id: "r1", groupId: grouped ? "a" : undefined }];
      calendar.resourceGroups = [{ id: "a", title: "Group A" }];
      calendar.configure({
        resourceHeaderContent: () => {
          const node = document.createElement("div");
          node.className = "test-resource-content";
          node.textContent = "Resource A";
          return node;
        },
        resourceGroupContent: () => {
          const node = document.createElement("div");
          node.style.height = "60px";
          return node;
        },
      });
    }, grouped);
    await flushRender(page);
    // Grow the same node after the render, as asynchronously loaded content would.
    await page.locator(".test-resource-content").evaluate((node) => {
      node.style.height = "96px";
    });
    await page.locator(".cv-scroller").evaluate((node) => {
      node.scrollTop = 340;
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scroller = document.querySelector(".cv-scroller");
          const group = document.querySelector(".cv-group-row")?.getBoundingClientRect();
          const resource = document.querySelector(".cv-resource-row")?.getBoundingClientRect();
          const day = document.querySelector(".cv-day-header")?.getBoundingClientRect();
          if (!scroller || !resource || !day) throw new Error("Missing headers");
          return {
            grouped: group != null,
            scrolled: scroller.scrollTop > 0,
            resourceExpanded: resource.height >= 96,
            groupExpanded: group == null || group.height >= 60,
            resourceAligned:
              Math.abs(resource.top - (group?.bottom ?? scroller.getBoundingClientRect().top)) < 1,
            dayAligned: Math.abs(day.top - resource.bottom) < 1,
          };
        }),
      )
      .toEqual({
        grouped,
        scrolled: true,
        resourceExpanded: true,
        groupExpanded: true,
        resourceAligned: true,
        dayAligned: true,
      });
  });
}
