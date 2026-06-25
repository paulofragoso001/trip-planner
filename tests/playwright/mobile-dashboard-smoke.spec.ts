import { expect, test, type Page } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const mobileViewport = { height: 900, width: 390 };

async function openAuthenticatedMobileRoute(page: Page, path: string) {
  await page.setViewportSize(mobileViewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseUrl}${path}`, { waitUntil: "commit" });
  await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
  await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
}

async function expectCollapsedWalletSheet(page: Page, surface = "home") {
  await expect(page.getByTestId("mobile-home-wallet-content")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
    "data-sheet-state",
    "collapsed"
  );
  await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
    "data-sheet-surface",
    surface
  );
  await expect(page.getByTestId("ios-launch-sheet-collapsed")).toBeVisible();
}

test.describe("authenticated mobile dashboard smoke", () => {
  test("/dashboard renders the launch globe wallet hub", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard");

    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.locator('[data-map-renderer="custom-globe"]')).toHaveAttribute(
      "data-map-system",
      "almidy-map-system"
    );
    await expectCollapsedWalletSheet(page);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveCount(0);
  });

  test("/dashboard/trips renders the canonical My Trips globe sheet", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips`);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
      "data-map-system",
      "almidy-map-system"
    );
    await expect(page.getByTestId("mobile-country-sheet")).toBeVisible();
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expectCollapsedWalletSheet(page, "trips");
    await expect(page.getByTestId("mobile-trips-sheet-content")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);

    await page.getByRole("button", { name: "Open My Trips" }).click();
    await expect(page.getByTestId("mobile-trips-sheet-expanded")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-native-actions")).toBeVisible();
    await expect(page.getByRole("link", { name: "Trip list Search and manage" })).toHaveAttribute(
      "href",
      "/dashboard/trips?view=list"
    );
  });

  test("/dashboard/trips?view=list renders the secondary list/create flow", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips?view=list");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips?view=list`);
    await expect(page.getByTestId("mobile-trips-wallet-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible();
  });

  test("/dashboard?view=trips forwards to the canonical My Trips route", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard?view=trips");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips`);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);
  });

  test("/dashboard/trips/[tripId] renders the authenticated trip workspace", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips/demo");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips/demo`);
    await expect(page.getByTestId("trip-pass-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
    await expect(page.getByTestId("trip-overview-page")).toBeVisible();
    await expect(page.getByTestId("overview-small-pass")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("overview-quick-actions")).toBeVisible();
  });
});
