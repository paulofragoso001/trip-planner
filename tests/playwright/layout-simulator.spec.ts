import { expect, test } from "@playwright/test";

async function readLayoutContract(page: import("@playwright/test").Page) {
  return page.getByTestId("layout-preview-shell").evaluate((shell) => {
    const requiredRegions = [
      "layout-preview-shell",
      "layout-preview-topbar",
      "layout-preview-main",
      "layout-preview-content",
      "layout-preview-kpis",
      "layout-preview-states"
    ];

    return {
      contract: {
        accent: shell.getAttribute("data-accent"),
        cardRadius: shell.getAttribute("data-card-radius"),
        containerWidth: shell.getAttribute("data-container-width"),
        contentLayout: shell.getAttribute("data-content-layout"),
        density: shell.getAttribute("data-density"),
        mockPreset: shell.getAttribute("data-mock-preset"),
        rightRail: shell.getAttribute("data-right-rail"),
        sidebarMode: shell.getAttribute("data-sidebar-mode"),
        theme: shell.getAttribute("data-theme"),
        topbarMode: shell.getAttribute("data-topbar-mode")
      },
      regions: requiredRegions.reduce<Record<string, boolean>>((result, testId) => {
        result[testId] = Boolean(document.querySelector(`[data-testid="${testId}"]`));
        return result;
      }, {}),
      optionalRegions: {
        map: Boolean(document.querySelector('[data-testid="layout-preview-map"]')),
        mobileDrawer: Boolean(document.querySelector('[data-testid="layout-preview-mobile-drawer"]')),
        rightRail: Boolean(document.querySelector('[data-testid="layout-preview-right-rail"]')),
        sidebar: Boolean(document.querySelector('[data-testid="layout-preview-sidebar"]')),
        table: Boolean(document.querySelector('[data-testid="layout-preview-table"]')),
        timeline: Boolean(document.querySelector('[data-testid="layout-preview-timeline"]'))
      }
    };
  });
}

async function gotoPreset(page: import("@playwright/test").Page, preset: string) {
  await page.goto(`http://127.0.0.1:3000/dashboard/layout-simulator?preset=${preset}`);
  await expect(page.getByTestId("layout-simulator")).toHaveAttribute("data-hydrated", "true");
}

test("previews flight operations shell layout modes", async ({ page }) => {
  test.setTimeout(60_000);

  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.goto("http://127.0.0.1:3000/dashboard/layout-simulator");

  await expect(page.getByTestId("layout-simulator")).toBeVisible();
  await expect(page.getByTestId("layout-simulator")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("layout-integrity-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: "App shell simulator" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Preview primary navigation" })).toBeVisible();

  await page.getByLabel("Sidebar mode").selectOption("collapsed");
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByLabel("Accent color").selectOption("blue");
  await page.getByLabel("Top bar mode").selectOption("filter-heavy");
  await page.getByLabel("Content layout").selectOption("map-list");
  await page.getByLabel("Mock page preset").selectOption("map-workspace");

  await expect(page.getByRole("heading", { name: "Map Workspace" })).toBeVisible();
  await expect(page.getByLabel("Map canvas preview")).toBeVisible();

  await page.getByRole("button", { name: "Reset simulator" }).click();
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "expanded");
});

test("snapshots reference shell contracts", async ({ page }) => {
  test.setTimeout(60_000);

  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await gotoPreset(page, "trip-detail");

  await expect(page.getByTestId("layout-reference-trip-detail")).toBeVisible();
  await expect(page.getByTestId("layout-reference-flight-monitor")).toBeVisible();

  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-mock-preset", "trip-detail");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-content-layout", "timeline-inspector");
  await expect(page.getByTestId("layout-preset-trip-detail")).toBeVisible();
  await expect(page.getByTestId("layout-preview-timeline")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-trip-detail.json"
  );

  await gotoPreset(page, "flight-monitor");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-mock-preset", "flight-monitor");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-content-layout", "ops-3-panel");
  await expect(page.getByTestId("layout-preset-flight-monitor")).toBeVisible();
  await expect(page.getByTestId("layout-preview-map")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-flight-monitor.json"
  );
});

test("snapshots edge-case shell contracts", async ({ page }) => {
  test.setTimeout(60_000);

  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await gotoPreset(page, "mobile-drawer");

  await expect(page.getByTestId("layout-reference-mobile-drawer")).toBeVisible();
  await expect(page.getByTestId("layout-reference-collapsed-right-rail")).toBeVisible();
  await expect(page.getByTestId("layout-reference-map-inspector-stress")).toBeVisible();
  await expect(page.getByTestId("layout-reference-wide-map-workspace")).toBeVisible();

  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "mobile");
  await expect(page.getByTestId("layout-preview-mobile-drawer")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-mobile-drawer.json"
  );

  await gotoPreset(page, "collapsed-right-rail");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "collapsed");
  await expect(page.getByTestId("layout-preview-right-rail")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-collapsed-right-rail.json"
  );

  await gotoPreset(page, "wide-map-workspace");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-container-width", "full");
  await expect(page.getByTestId("layout-preview-map")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-wide-map-workspace.json"
  );

  await gotoPreset(page, "map-inspector-stress");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "collapsed");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-content-layout", "ops-3-panel");
  await expect(page.getByTestId("layout-preview-map")).toBeVisible();
  await expect(page.getByTestId("layout-preview-right-rail")).toBeVisible();
  expect(JSON.stringify(await readLayoutContract(page), null, 2)).toMatchSnapshot(
    "layout-contract-map-inspector-stress.json"
  );
});
