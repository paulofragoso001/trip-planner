import { expect, test } from "@playwright/test";

const viewports = [360, 390, 430, 768, 1024] as const;
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
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: /Saved/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Plan with AI/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /My Trips/ })).toHaveCount(0);
  });

  test("mobile bottom navigation has one active item for trips and map", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto("http://127.0.0.1:3000/dashboard/trips/demo/timeline", { waitUntil: "commit" });
    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /Trips/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Map/ })).not.toHaveAttribute("aria-current", "page");

    await page.goto("http://127.0.0.1:3000/dashboard/trips/demo/map", { waitUntil: "commit" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /Map/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Trips/ })).not.toHaveAttribute("aria-current", "page");
  });

  test("bottom nav does not cover the scrollable content area", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("http://127.0.0.1:3000/dashboard/imports", { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-main")).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toBeVisible();

    const spacing = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="app-shell-main"]');
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const mainPaddingBottom = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0;
      const navHeight = nav?.getBoundingClientRect().height || 0;
      return { mainPaddingBottom, navHeight };
    });

    expect(spacing.mainPaddingBottom).toBeGreaterThanOrEqual(spacing.navHeight + 20);
  });

  test("home and plan keep mobile guidance compact", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Where do you want to start?" })).toBeVisible();
    await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
    await expect(page.getByText("First Plan Guide")).toHaveCount(0);
    await expect(page.getByText("Add, review, create.")).toHaveCount(0);

    await page.goto("http://127.0.0.1:3000/dashboard/imports", { waitUntil: "commit" });
    await expect(page.getByTestId("imports-route")).toBeVisible();
    await expect(page.getByText("Create a trip from saved ideas.")).toHaveCount(0);
    await expect(page.locator("ol").filter({ hasText: "Add" })).toHaveCount(1);
  });

  test("demo map exposes ordered route cards on mobile", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("http://127.0.0.1:3000/dashboard/trips/demo/map", { waitUntil: "commit" });

    await expect(page.getByTestId("connected-trip-map")).toBeVisible();
    await expect(page.getByText("Place 1 of 4")).toBeVisible();
    await expect(page.getByRole("button", { name: /1 Barcelona-El Prat Airport/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 Fira Barcelona meeting/ })).toBeVisible();
  });
});
