import { expect, test } from "@playwright/test";
import {
  dashboardCompatibilityViews,
  dashboardRoutes
} from "../../lib/dashboard/route-contracts";

const baseUrl = "http://127.0.0.1:3000";

test.describe("dashboard route contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.addInitScript(() => {
      window.google = {
        maps: {
          importLibrary: async () => ({})
        }
      };
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("/dashboard remains the launch hub", async ({ page }) => {
    await page.goto(`${baseUrl}${dashboardRoutes.home}`, { waitUntil: "commit" });

    await expect(page).toHaveURL(`${baseUrl}${dashboardRoutes.home}`);
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
      "data-sheet-state",
      "collapsed"
    );
    await expect(page.getByTestId("ios-launch-sheet-collapsed")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveCount(0);
  });

  test("/dashboard/trips remains the canonical My Trips route", async ({ page }) => {
    await page.goto(`${baseUrl}${dashboardRoutes.trips}`, { waitUntil: "commit" });

    await expect(page).toHaveURL(`${baseUrl}${dashboardRoutes.trips}`);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
      "data-sheet-state",
      "collapsed"
    );
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
      "data-sheet-surface",
      "trips"
    );
    await expect(page.getByTestId("mobile-trips-sheet-content")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);
  });

  test("/dashboard?view=trips is compatibility-only and forwards to canonical trips", async ({
    page
  }) => {
    await page.goto(
      `${baseUrl}${dashboardRoutes.home}?view=${dashboardCompatibilityViews.trips}`,
      { waitUntil: "commit" }
    );

    await expect(page).toHaveURL(`${baseUrl}${dashboardRoutes.trips}`);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute(
      "data-sheet-surface",
      "trips"
    );
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);
  });
});
