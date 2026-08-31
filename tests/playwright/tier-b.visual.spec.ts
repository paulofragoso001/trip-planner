import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/design-system-visual");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await expect(page.getByTestId("tier-b-visual-fixture")).toBeVisible();
}

const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixels: 0,
  scale: "css" as const,
  threshold: 0,
};

test("warm neutral fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("tier-b-warm")).toHaveScreenshot("tier-b-warm-light.png", screenshotOptions);
});

test("focus fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("tier-b-focus")).toHaveScreenshot("tier-b-focus-light.png", screenshotOptions);
});

test("selected fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("tier-b-selected")).toHaveScreenshot("tier-b-selected-light.png", screenshotOptions);
});

test("shadow fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("tier-b-shadow")).toHaveScreenshot("tier-b-shadow-light.png", screenshotOptions);
});

test("mobile Tier B dark fixture", async ({ page }) => {
  await openFixture(page, { width: 390, height: 844 });
  await expect(page.getByTestId("tier-b-dark")).toHaveScreenshot("tier-b-mobile-dark.png", screenshotOptions);
});

test("trip typography fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("typography-trip")).toHaveScreenshot("typography-trip-light.png", screenshotOptions);
});

test("auth typography fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 });
  await expect(page.getByTestId("typography-auth")).toHaveScreenshot("typography-auth-light.png", screenshotOptions);
});
