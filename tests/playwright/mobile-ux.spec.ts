import { expect, test } from "@playwright/test";

const viewports = [360, 390, 430] as const;
const routes = [
  "/dashboard",
  "/dashboard/imports",
  "/dashboard/trips",
  "/dashboard/trips/demo/timeline",
  "/dashboard/trips/demo/map"
] as const;

test.describe("mobile soft-launch UX", () => {
  for (const width of viewports) {
    test(`core routes avoid horizontal overflow at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ height: 900, width });
      await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

      for (const route of routes) {
        await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "commit" });
        await expect(page.getByTestId("app-shell-root")).toBeVisible();

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth - window.innerWidth;
        });

        expect(overflow, `${route} overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("mobile bottom navigation exposes soft-launch destinations", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "commit" });

    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: /Home/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Plan/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Trips/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Map/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Profile/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Saved/ })).toHaveCount(0);
  });
});
