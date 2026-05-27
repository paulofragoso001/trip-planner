import { expect, test, type Page } from "@playwright/test";

const presetUrl = (preset: string) =>
  `http://127.0.0.1:3000/dashboard/layout-simulator?preset=${preset}`;

async function openPreset(page: Page, preset: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.goto(presetUrl(preset));
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      [data-testid="layout-preview-shell"] {
        height: 760px !important;
      }
    `
  });
  await expect(page.getByTestId("layout-simulator")).toHaveAttribute("data-hydrated", "true");
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));

  expect(Math.max(dimensions.body, dimensions.document)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("mobile drawer visual integrity", async ({ page }) => {
  test.setTimeout(60_000);

  await openPreset(page, "mobile-drawer", { width: 390, height: 844 });

  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "mobile");
  await expect(page.getByTestId("layout-preview-mobile-drawer")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page.getByTestId("layout-preview-shell")).toHaveScreenshot(
    "layout-visual-mobile-drawer-shell.png",
    { animations: "disabled", caret: "hide", scale: "css" }
  );
  await expect(page.getByTestId("layout-preview-mobile-drawer")).toHaveScreenshot(
    "layout-visual-mobile-drawer-panel.png",
    { animations: "disabled", caret: "hide", scale: "css" }
  );
});

test("collapsed right rail visual integrity", async ({ page }) => {
  test.setTimeout(60_000);

  await openPreset(page, "collapsed-right-rail", { width: 1440, height: 900 });

  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-sidebar-mode", "collapsed");
  await expect(page.getByTestId("layout-preview-right-rail")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page.getByTestId("layout-preview-shell")).toHaveScreenshot(
    "layout-visual-collapsed-right-rail-shell.png",
    { animations: "disabled", caret: "hide", scale: "css" }
  );
});

test("wide map workspace visual integrity", async ({ page }) => {
  test.setTimeout(60_000);

  await openPreset(page, "wide-map-workspace", { width: 1600, height: 1000 });

  await expect(page.getByTestId("layout-preview-shell")).toHaveAttribute("data-container-width", "full");
  await expect(page.getByTestId("layout-preview-map")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page.getByTestId("layout-preview-shell")).toHaveScreenshot(
    "layout-visual-wide-map-workspace-shell.png",
    { animations: "disabled", caret: "hide", scale: "css" }
  );
  await expect(page.getByTestId("layout-preview-map")).toHaveScreenshot(
    "layout-visual-wide-map-workspace-map.png",
    { animations: "disabled", caret: "hide", scale: "css" }
  );
});
