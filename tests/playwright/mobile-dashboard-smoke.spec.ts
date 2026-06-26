import { expect, test, type Page } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const mobileViewport = { height: 900, width: 390 };

async function openAuthenticatedMobileRoute(page: Page, path: string) {
  await page.setViewportSize(mobileViewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installMockMobileLocation(page);
  await installMockGoogleMaps3D(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "commit" });
  await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
  await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
}

async function installMockMobileLocation(page: Page) {
  await page.route("**/api/travel-data/geocode", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: {
          result: {
            address: "Miami, FL, USA",
            city: "Miami",
            coordinate: { lat: 25.7617, lng: -80.1918 },
            countryCode: "US",
            countryName: "United States",
            placeId: "test-miami",
            types: ["locality", "political"]
          }
        }
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.addInitScript(() => {
    window.localStorage.removeItem("wayline:last-user-location");
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () => Promise.resolve({ state: "granted" })
      }
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: (position: GeolocationPosition) => void) {
          success({
            coords: {
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 25.7617,
              longitude: -80.1918,
              speed: null
            },
            timestamp: Date.now()
          } as GeolocationPosition);
        }
      }
    });
  });
}

async function installMockGoogleMaps3D(page: Page) {
  await page.addInitScript(() => {
    class MockMap3DElement extends HTMLElement {
      constructor(options?: Record<string, unknown>) {
        super();
        Object.assign(this, options);
        window.setTimeout(() => this.dispatchEvent(new Event("gmp-steadychange")), 0);
      }
    }

    if (!customElements.get("almidy-test-map-3d")) {
      customElements.define("almidy-test-map-3d", MockMap3DElement);
    }

    (window as typeof window & {
      google?: {
        maps?: {
          importLibrary?: (libraryName: string) => Promise<unknown>;
        };
      };
    }).google = {
      maps: {
        importLibrary: async (libraryName: string) => {
          if (libraryName === "maps3d") {
            return {
              GestureHandling: { GREEDY: "GREEDY" },
              Map3DElement: MockMap3DElement,
              MapMode: { HYBRID: "HYBRID" }
            };
          }

          return {};
        }
      }
    };
  });
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
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "google-maps-3d");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expect(page.locator('[data-map-renderer="google-maps-3d"]').first()).toHaveAttribute(
      "data-map-system",
      "almidy-google-maps-3d"
    );
    await expect(page.locator('[data-map-renderer="custom-globe"]')).toHaveCount(0);
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
