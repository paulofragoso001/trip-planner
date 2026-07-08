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

type MockLocationPermission = "denied" | "granted" | "prompt";

async function installMockMobileLocation(
  page: Page,
  {
    permission = "granted"
  }: {
    permission?: MockLocationPermission;
  } = {}
) {
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

  await page.addInitScript(({ mockedPermission }) => {
    window.localStorage.removeItem("wayline:last-user-location");
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () => Promise.resolve({ state: mockedPermission })
      }
    });
    let geolocationCalls = 0;
    Object.defineProperty(window, "__waylineGeolocationCalls", {
      configurable: true,
      get: () => geolocationCalls
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(
          success: (position: GeolocationPosition) => void,
          error?: (positionError: GeolocationPositionError) => void
        ) {
          geolocationCalls += 1;
          if (mockedPermission === "denied") {
            error?.({
              code: 1,
              message: "User denied Geolocation",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3
            } as GeolocationPositionError);
            return;
          }

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
  }, { mockedPermission: permission });
}

async function installMockGoogleMaps3D(page: Page) {
  await page.addInitScript(() => {
    type MockMapInstance = {
      __panes: Record<string, HTMLElement>;
      fitBounds: () => void;
      getDiv: () => HTMLElement;
      panTo: (latLng?: { lat?: number | (() => number); lng?: number | (() => number) }) => void;
      setCenter: () => void;
      setClickableIcons: () => void;
      setHeading: () => void;
      setMapTypeId: () => void;
      setOptions: () => void;
      setStreetView: () => void;
      setTilt: () => void;
      setZoom: (zoom?: number) => void;
    };

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

    class MockMap {
      __panes: Record<string, HTMLElement>;
      private div: HTMLElement;
      mapTypes = { set: () => {} };

      constructor(div: HTMLElement) {
        this.div = div;
        this.__panes = {
          floatPane: document.createElement("div"),
          mapPane: document.createElement("div"),
          markerLayer: document.createElement("div"),
          overlayLayer: document.createElement("div"),
          overlayMouseTarget: document.createElement("div")
        };
        Object.entries(this.__panes).forEach(([name, pane]) => {
          pane.style.inset = "0";
          pane.style.overflow = "visible";
          pane.style.pointerEvents = name === "overlayMouseTarget" ? "auto" : "none";
          pane.style.position = "absolute";
          pane.style.zIndex = name === "overlayMouseTarget" ? "30" : "1";
          div.appendChild(pane);
        });
      }

      fitBounds() {}
      getDiv() {
        return this.div;
      }
      panTo(latLng?: { lat?: number | (() => number); lng?: number | (() => number) }) {
        const lat = typeof latLng?.lat === "function" ? latLng.lat() : Number(latLng?.lat ?? 0);
        const lng = typeof latLng?.lng === "function" ? latLng.lng() : Number(latLng?.lng ?? 0);
        this.div.dataset.googleMapPanTo = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      }
      setCenter() {}
      setClickableIcons() {}
      setHeading() {}
      setMapTypeId() {}
      setOptions() {}
      setStreetView() {}
      setTilt() {}
      setZoom(zoom?: number) {
        this.div.dataset.googleMapZoom = String(zoom ?? "");
      }
    }

    class MockLatLng {
      private latitude: number;
      private longitude: number;

      constructor(lat: number, lng: number) {
        this.latitude = Number(lat);
        this.longitude = Number(lng);
      }

      lat() {
        return this.latitude;
      }

      lng() {
        return this.longitude;
      }
    }

    class MockLatLngBounds {
      extend() {
        return this;
      }
    }

    class MockOverlayView {
      private map: MockMapInstance | null = null;

      draw() {}
      getPanes() {
        return this.map?.__panes ?? null;
      }
      getProjection() {
        const map = this.map;
        return {
          fromLatLngToDivPixel(latLng: { lat?: number | (() => number); lng?: number | (() => number) }) {
            const lat = typeof latLng.lat === "function" ? latLng.lat() : Number(latLng.lat ?? 0);
            const lng = typeof latLng.lng === "function" ? latLng.lng() : Number(latLng.lng ?? 0);
            const rect = map?.getDiv().getBoundingClientRect() ?? { height: 900, width: 390 };
            return {
              x: ((lng + 180) / 360) * rect.width,
              y: ((90 - lat) / 180) * rect.height
            };
          }
        };
      }
      onAdd() {}
      onRemove() {}
      setMap(map: MockMapInstance | null) {
        this.map = map;
        if (map) {
          this.onAdd();
          this.draw();
        } else {
          this.onRemove();
        }
      }
    }

    (window as typeof window & {
      google?: {
        maps?: {
          importLibrary?: (libraryName: string) => Promise<unknown>;
        };
      };
    }).google = {
      maps: {
        ColorScheme: { DARK: "DARK" },
        event: {
          addListener: () => ({ remove: () => {} }),
          clearInstanceListeners: () => {},
          removeListener: () => {}
        },
        importLibrary: async (libraryName: string) => {
          if (libraryName === "maps3d") {
            return {
              GestureHandling: { GREEDY: "GREEDY" },
              Map3DElement: class {
                constructor(options?: Record<string, unknown>) {
                  const element = document.createElement("almidy-test-map-3d");
                  Object.assign(element, options);
                  window.setTimeout(() => element.dispatchEvent(new Event("gmp-steadychange")), 0);
                  return element;
                }
              },
              MapMode: { HYBRID: "HYBRID" }
            };
          }

          return {};
        },
        LatLngBounds: MockLatLngBounds,
        LatLng: MockLatLng,
        Map: MockMap,
        OverlayView: MockOverlayView
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

async function expectNoNativeGoogleMapsErrorUi(page: Page) {
  const bodyText = await page.locator("body").innerText();

  expect(bodyText).not.toContain("Oops! Something went wrong.");
  expect(bodyText).not.toContain("This page didn't load Google Maps correctly.");
  expect(bodyText).not.toContain("This page didn’t load Google Maps correctly.");
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
    await expectNoNativeGoogleMapsErrorUi(page);
    await expect(page.locator('[data-map-renderer="google-maps-3d"]').first()).toHaveAttribute(
      "data-map-system",
      "almidy-google-maps-3d"
    );
    await expect(page.locator('[data-map-renderer="custom-globe"]')).toHaveCount(0);
    await expectCollapsedWalletSheet(page);
    const firstTripCard = page.getByTestId("launch-first-trip-card");
    const hasLatestTrip = (await page.getByRole("link", { name: "Continue trip" }).count()) > 0;
    if (hasLatestTrip) {
      await expect(firstTripCard).toHaveCount(0);
    } else {
      await expect(firstTripCard).toBeVisible();
      await expect(firstTripCard.getByTestId("launch-first-trip-country-flag")).toHaveText("🇺🇸");
      await expect(firstTripCard.getByTestId("launch-first-trip-country-flag")).toHaveAttribute(
        "data-has-country-flag",
        "true"
      );
      await expect(firstTripCard.getByRole("heading", { name: "Create your first trip" })).toBeVisible();
      await expect(firstTripCard.getByTestId("launch-first-trip-create")).toHaveAttribute(
        "href",
        "/dashboard"
      );
    }
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveCount(0);
  });

  test("/dashboard create trip uses wallet layers without URL navigation", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard");

    const firstTripCard = page.getByTestId("launch-first-trip-card");
    test.skip((await firstTripCard.count()) === 0, "Requires an empty dashboard state.");

    await firstTripCard.getByTestId("launch-first-trip-create").click();
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");

    const form = page.getByTestId("mobile-trip-create-form");
    await expect(form).toBeVisible();
    await form.getByLabel("Trip name").fill("Paris July");

    await form.getByRole("button", { name: "Set Dates" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "datePicker");
    await expect(page.getByTestId("wallet-date-picker-layer")).toBeVisible();
    await page.getByTestId("wallet-date-day").filter({ hasText: /^10$/ }).first().click();
    await page.getByTestId("wallet-date-day").filter({ hasText: /^14$/ }).first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(form.getByLabel("Trip name")).toHaveValue("Paris July");
    await expect(form).toContainText(/Jul 10 - Jul 14|10 Jul - 14 Jul/);

    await form.getByRole("button", { name: "Background" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "backgroundPicker");
    await expect(page.getByTestId("wallet-background-picker-layer")).toBeVisible();
    await page.getByLabel("Use background color #2f4f4f").click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(form.getByLabel("Trip name")).toHaveValue("Paris July");

    await form.getByRole("button", { name: "Set Dates" }).click();
    await page.getByTestId("wallet-date-picker-layer").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(form.getByLabel("Trip name")).toHaveValue("Paris July");

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveCount(0);
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
  });

  test("/dashboard asks for location before requesting browser geolocation", async ({ context, page }) => {
    await context.grantPermissions(["geolocation"], { origin: baseUrl });
    await context.setGeolocation({ latitude: 25.7617, longitude: -80.1918 });
    await page.setViewportSize(mobileViewport);
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installMockMobileLocation(page, { permission: "prompt" });
    await installMockGoogleMaps3D(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
    const permissionPrompt = page.getByTestId("launch-location-permission");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    const firstTripCard = page.getByTestId("launch-first-trip-card");
    if ((await permissionPrompt.count()) > 0) {
      await expect(permissionPrompt).toBeVisible();
      await expect(page.getByRole("heading", { name: 'Allow "Almidy" to use your location?' })).toBeVisible();
      await expect(page.getByRole("button", { name: "Allow Once" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Allow While Using App" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Don't Allow" })).toBeVisible();
      await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-intent", "launch");
      await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-latitude", "35.00000");
      await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-longitude", "-97.00000");
      await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-altitude", "6500000");
    }
    if ((await firstTripCard.count()) > 0 && (await permissionPrompt.count()) > 0) {
      await expect(firstTripCard).toBeVisible();
      await expect(firstTripCard.getByTestId("launch-first-trip-country-flag")).toHaveAttribute(
        "data-has-country-flag",
        "false"
      );
      await expect(firstTripCard.getByTestId("launch-first-trip-create")).toHaveAttribute(
        "href",
        "/dashboard"
      );
    }
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __waylineGeolocationCalls: number }).__waylineGeolocationCalls)
      )
      .toBe(0);

    if ((await permissionPrompt.count()) > 0) {
      await page.getByRole("button", { name: "Allow While Using App" }).click();
    }
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __waylineGeolocationCalls: number }).__waylineGeolocationCalls)
      )
      .toBe(1);
    await expect(permissionPrompt).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-intent", "user-location");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-latitude", "25.76170");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-longitude", "-80.19180");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveAttribute("data-camera-altitude", "15000");
    await expect(page.getByTestId("almidy-google-maps-3d-user-marker")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    if ((await firstTripCard.count()) > 0) {
      await expect(firstTripCard.getByTestId("launch-first-trip-country-flag")).toHaveText("🇺🇸");
      await expect(firstTripCard.getByTestId("launch-first-trip-country-flag")).toHaveAttribute(
        "data-has-country-flag",
        "true"
      );
      await expect(firstTripCard.getByText("After creating a trip, a country flag will appear on the map to mark its location.")).toBeVisible();
    }
    await expectNoNativeGoogleMapsErrorUi(page);
  });

  test("/dashboard/trips renders the canonical My Trips globe sheet", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips`);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
      "data-map-system",
      "almidy-apple-map-system"
    );
    await expect(page.getByTestId("almidy-launch-globe")).toHaveCount(0);
    await expect
      .poll(async () => Number(await page.getByTestId("mobile-trips-country-map-screen").getAttribute("data-globe-trip-pin-count")))
      .toBeGreaterThan(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    await expect(page.getByTestId("mobile-trips-overview-carousel")).toHaveCount(0);
    await expect(page.getByTestId("mobile-trips-overview-card")).toHaveCount(0);
    await expect(page.getByTestId("mobile-country-sheet")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-overview-controls")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-shortcut-rail")).toBeVisible();
    await expect(page.getByRole("link", { name: "New Activity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Flights" })).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveCount(0);
  });

  test("/dashboard/trips?view=list renders the secondary list/create flow", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips?view=list#new-trip");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips?view=list#new-trip`);
    await expect(page.getByTestId("mobile-trips-wallet-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible();
    await expect(page.getByTestId("mobile-create-another-trip").getByTestId("mobile-trip-create-form")).toBeVisible();
  });

  test("/dashboard?view=trips forwards to the canonical My Trips route", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard?view=trips");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips`, { timeout: 20_000 });
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-trips-overview-controls")).toBeVisible();
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
