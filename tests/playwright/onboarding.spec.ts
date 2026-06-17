import { expect, test } from "@playwright/test";

const sampleText =
  "Planning a Miami weekend trip. I want to visit Wynwood Walls, have dinner at Komodo, walk around Brickell City Centre, go to South Pointe Park, and maybe do a Biscayne Bay boat tour.";

test.describe("first-run onboarding", () => {
  test("sample inspiration opens Plan with AI and prefills the input", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("http://127.0.0.1:3000/dashboard/plan?sample=miami#saved-inspiration", {
      waitUntil: "commit"
    });

    await expect(page.getByTestId("imports-route")).toBeVisible();
    await expect(page.getByText("Sample inspiration loaded: miami")).toBeVisible();
    await expect(page.locator('textarea[name="rawText"]')).toHaveValue(sampleText);
    await expect(page.getByRole("button", { name: /Find places/ })).toBeVisible();
  });

  for (const width of [360, 390, 430] as const) {
    test(`sample onboarding has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
      await page.goto("http://127.0.0.1:3000/dashboard/plan?sample=miami#saved-inspiration", {
        waitUntil: "commit"
      });

      await expect(page.getByTestId("imports-route")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
