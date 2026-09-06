import { expect, test } from "@playwright/test";

/**
 * M16 resource grouping acceptance: one level, declared group order wins,
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
  await page.goto("/demo/resources.html");
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
  await page.goto("/demo/resources.html");
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
  await page.goto("/demo/resources.html");
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
  await page.goto("/demo/resources.html");
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
  await page.goto("/demo/resources.html");
  await setState(page, [{ id: "r1", title: "Room A" }], [{ id: "ghost", title: "Ghost" }]);
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-resource-header")).toHaveCount(1);
});

test("empty resources with groups configured show the explicit empty state", async ({ page }) => {
  await page.goto("/demo/resources.html");
  await setState(page, [], [{ id: "a", title: "Alpha" }]);
  await expect(page.locator(".cv-group-row")).toHaveCount(0);
  await expect(page.locator(".cv-empty")).toHaveCount(1);
});

test("solo views never render a group or resource row", async ({ page }) => {
  await page.goto("/demo/resources.html");
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

test("sticky offsets shift down exactly when a real group row exists", async ({ page }) => {
  await page.goto("/demo/resources.html");
  // No real group: resource row sticks at 0, day headers at 3rem.
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [{ id: "r1", title: "Room A" }];
    calendar.resourceGroups = [{ id: "ghost", title: "Ghost" }];
  });
  await flushRender(page);
  const groupedOffsets = await page.evaluate(() => {
    const resourceRow = document.querySelector(".cv-resource-row");
    const dayHeader = document.querySelector(".cv-day-header");
    return {
      resourceTop: resourceRow ? getComputedStyle(resourceRow).top : null,
      dayTop: dayHeader ? getComputedStyle(dayHeader).top : null,
    };
  });
  expect(groupedOffsets.resourceTop).toBe("0px");
  expect(groupedOffsets.dayTop).toBe("48px");

  // Real group row present: resource row sticks below it (3rem), day
  // headers below both (6rem).
  await page.evaluate(() => {
    const calendar = /** @type {any} */ (document.querySelector("calendar-view"));
    calendar.resources = [{ id: "r1", groupId: "a" }];
    calendar.resourceGroups = [{ id: "a", title: "Alpha" }];
  });
  await flushRender(page);
  const shifted = await page.evaluate(() => {
    const resourceRow = document.querySelector(".cv-resource-row");
    const dayHeader = document.querySelector(".cv-day-header");
    return {
      resourceTop: resourceRow ? getComputedStyle(resourceRow).top : null,
      dayTop: dayHeader ? getComputedStyle(dayHeader).top : null,
    };
  });
  expect(shifted.resourceTop).toBe("48px");
  expect(shifted.dayTop).toBe("96px");
});
