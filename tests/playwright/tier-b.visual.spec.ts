import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page, viewport: { width: number; height: number }, path = "/dashboard/design-system-visual") {
  await page.setViewportSize(viewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
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

test("ordinary web components fixture", async ({ page }) => {
  await openFixture(page, { width: 1280, height: 900 }, "/dashboard/design-system-visual?components=true");
  await expect(page.getByTestId("web-components-light")).toHaveScreenshot("web-components-light.png", screenshotOptions);
});

test("ordinary web components accessibility and responsive behavior", async ({ page }) => {
  await openFixture(page, { width: 640, height: 900 }, "/dashboard/design-system-visual?components=true");

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const primary = page.getByRole("button", { name: "Primary action" });
  const neutral = page.getByRole("button", { name: "Neutral action" });
  const destination = page.getByLabel("Destination");

  await primary.focus();
  await expect(primary).toBeFocused();
  await expect(primary).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(neutral).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(destination).toBeFocused();

  const invalid = page.getByLabel("Confirmation");
  await expect(invalid).toHaveAttribute("aria-invalid", "true");
  await expect(invalid).toHaveAttribute("aria-describedby", "fixture-error");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
