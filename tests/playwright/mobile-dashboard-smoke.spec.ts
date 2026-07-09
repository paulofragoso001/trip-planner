import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const mobileViewport = { height: 900, width: 390 };

async function openAuthenticatedMobileRoute(page: Page, path: string) {
  await page.setViewportSize(mobileViewport);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installMockMobileLocation(page);
  await installMockAppleMapKit(page);
  await installMockGoogleMaps3D(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "commit" });
  await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
  await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
}

async function deleteTripForTest(request: APIRequestContext, tripId: string | null | undefined) {
  if (!tripId || tripId === "trips") return;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await request.delete(`${baseUrl}/api/trips/${encodeURIComponent(tripId)}`, {
        headers: { "x-cypress-dashboard": "true" }
      });
      if (response.ok() || response.status() === 404) return;
      lastError = new Error(`Delete trip failed with ${response.status()}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error("Delete trip failed");
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

async function installMockAppleMapKit(page: Page) {
  await page.route("**/api/mapkit-token", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ token: "test-mapkit-token" }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.addInitScript(() => {
    type MockMapKitCoordinate = {
      latitude: number;
      longitude: number;
    };

    type MockMapKitAnnotation = {
      addEventListener: (eventName: string, handler: () => void) => void;
      element?: HTMLElement;
      selected?: boolean;
    };

    class MockCoordinate {
      latitude: number;
      longitude: number;

      constructor(latitude: number, longitude: number) {
        this.latitude = Number(latitude);
        this.longitude = Number(longitude);
      }
    }

    class MockCoordinateSpan {
      constructor(
        public latitudeDelta: number,
        public longitudeDelta: number
      ) {}
    }

    class MockCoordinateRegion {
      center: MockMapKitCoordinate;
      span: MockCoordinateSpan;

      constructor(center: MockMapKitCoordinate, span: MockCoordinateSpan) {
        this.center = center;
        this.span = span;
      }
    }

    class MockPadding {
      constructor(
        public top: number,
        public right: number,
        public bottom: number,
        public left: number
      ) {}
    }

    class MockAnnotation {
      coordinate: MockMapKitCoordinate;
      element: HTMLElement;
      selected = false;
      private handlers = new Map<string, () => void>();

      constructor(
        coordinate: MockMapKitCoordinate,
        elementFactory: () => HTMLElement,
        options?: Record<string, unknown>
      ) {
        this.coordinate = coordinate;
        this.element = elementFactory();
        this.selected = Boolean(options?.selected);
      }

      addEventListener(eventName: string, handler: () => void) {
        this.handlers.set(eventName, handler);
      }

      trigger(eventName: string) {
        this.handlers.get(eventName)?.();
      }
    }

    class MockMarkerAnnotation extends MockAnnotation {
      constructor(coordinate: MockMapKitCoordinate, options?: Record<string, unknown>) {
        super(
          coordinate,
          () => {
            const marker = document.createElement("button");
            marker.type = "button";
            marker.textContent = String(options?.title ?? "Map marker");
            return marker;
          },
          options
        );
      }
    }

    class MockMap {
      annotations: MockMapKitAnnotation[] = [];
      center: MockMapKitCoordinate | null = null;
      overlays: unknown[] = [];
      private container: HTMLElement;

      constructor(container: HTMLElement, options?: Record<string, unknown>) {
        this.container = container;
        this.container.dataset.mapkitMock = "ready";
        this.container.dataset.mapkitMapType = String(options?.mapType ?? "");
        this.container.dataset.mapkitHasRegion = options?.region ? "true" : "false";
        this.container.style.position = "relative";
      }

      addAnnotation(annotation: MockMapKitAnnotation) {
        this.addAnnotations([annotation]);
      }

      addAnnotations(annotations: MockMapKitAnnotation[]) {
        this.annotations = [...this.annotations, ...annotations];
        annotations.forEach((annotation) => {
          if (annotation.element && !this.container.contains(annotation.element)) {
            annotation.element.style.position = "relative";
            annotation.element.style.zIndex = annotation.selected ? "50" : "40";
            this.container.appendChild(annotation.element);
          }
        });
      }

      removeAnnotation(annotation: MockMapKitAnnotation) {
        this.removeAnnotations([annotation]);
      }

      removeAnnotations(annotations: MockMapKitAnnotation[]) {
        const removable = new Set(annotations);
        annotations.forEach((annotation) => annotation.element?.remove());
        this.annotations = this.annotations.filter((annotation) => !removable.has(annotation));
      }

      addOverlay(overlay: unknown) {
        this.overlays.push(overlay);
      }

      removeOverlays(overlays: unknown[]) {
        const removable = new Set(overlays);
        this.overlays = this.overlays.filter((overlay) => !removable.has(overlay));
      }

      setCenterAnimated(coordinate: MockMapKitCoordinate) {
        this.center = coordinate;
        this.container.dataset.mapkitPanTo = `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
      }

      showAnnotations(annotations: MockMapKitAnnotation[]) {
        if (annotations[0]) {
          this.center = (annotations[0] as MockAnnotation).coordinate;
        }
      }

      showItems(items: MockMapKitAnnotation[]) {
        this.showAnnotations(items);
      }

      setRegionAnimated() {}
      destroy() {}
    }

    (MockMap as typeof MockMap & { MapTypes?: Record<string, string> }).MapTypes = {
      Hybrid: "hybrid",
      Satellite: "satellite"
    };

    class MockStyle {
      constructor(public options?: Record<string, unknown>) {}
    }

    class MockPolylineOverlay {
      constructor(
        public coordinates: MockMapKitCoordinate[],
        public options?: Record<string, unknown>
      ) {}
    }

    (window as typeof window & { mapkit?: any; __almidyMapKitInitialized?: boolean }).mapkit = {
      Annotation: MockAnnotation,
      ColorScheme: { Dark: "dark" },
      Coordinate: MockCoordinate,
      CoordinateRegion: MockCoordinateRegion,
      CoordinateSpan: MockCoordinateSpan,
      FeatureVisibility: { Hidden: "hidden" },
      init: () => {
        (window as typeof window & { __almidyMapKitInitialized?: boolean }).__almidyMapKitInitialized = true;
      },
      initialized: true,
      Map: MockMap,
      MarkerAnnotation: MockMarkerAnnotation,
      Padding: MockPadding,
      PolylineOverlay: MockPolylineOverlay,
      Style: MockStyle
    };
  });
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

function trackGoogleMapsScriptRequests(page: Page) {
  const urls: string[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("maps.googleapis.com/maps/api/js") || url.includes("maps.gstatic.com")) {
      urls.push(url);
    }
  });

  return urls;
}

test.describe("authenticated mobile dashboard smoke", () => {
  test("/dashboard and /dashboard/trips share the mobile globe shell without Google scripts", async ({ page }) => {
    const googleScriptRequests = trackGoogleMapsScriptRequests(page);

    await openAuthenticatedMobileRoute(page, "/dashboard");
    const launchShell = page.getByTestId("mobile-globe-wallet-shell");
    await expect(launchShell).toHaveAttribute("data-wallet-active-layer", "launch");
    await expect(launchShell).toHaveAttribute("data-wallet-stack", "launch");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-map-system", "almidy-apple-map-system");

    await openAuthenticatedMobileRoute(page, "/dashboard/trips");
    const tripsShell = page.getByTestId("mobile-globe-wallet-shell");
    await expect(tripsShell).toHaveAttribute("data-wallet-active-layer", "myTrips");
    await expect(tripsShell).toHaveAttribute("data-wallet-stack", "myTrips");
    await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
      "data-map-system",
      "almidy-apple-map-system"
    );
    await expect(page.locator('[data-map-renderer="google-maps-3d"]')).toHaveCount(0);
    expect(googleScriptRequests).toEqual([]);
  });

  test("/dashboard renders the launch globe wallet hub", async ({ page }) => {
    const googleScriptRequests = trackGoogleMapsScriptRequests(page);
    await openAuthenticatedMobileRoute(page, "/dashboard");

    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-active-layer",
      "launch"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-stack",
      "launch"
    );
    await expect(page.getByTestId("mobile-home-wallet")).toHaveAttribute(
      "data-mobile-globe-wallet-rollout",
      "enabled"
    );
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet")).toHaveAttribute(
      "data-mobile-wallet-shared-model",
      "true"
    );
    await expect(page.getByTestId("mobile-home-wallet")).toHaveAttribute(
      "data-mobile-wallet-active-layer",
      "launch"
    );
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expectNoNativeGoogleMapsErrorUi(page);
    await expect(page.locator('[data-map-renderer="apple-mapkit"]').first()).toHaveAttribute(
      "data-map-system",
      "almidy-apple-map-system"
    );
    await expect(page.locator('[data-map-renderer="google-maps-3d"]')).toHaveCount(0);
    await expectCollapsedWalletSheet(page);
    const firstTripCard = page.getByTestId("launch-first-trip-card");
    const hasLatestTrip = (await page.getByRole("link", { name: "Continue trip" }).count()) > 0;
    if ((await firstTripCard.count()) > 0) {
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
    } else {
      expect(hasLatestTrip || (await page.getByRole("heading", { name: "My Trips" }).count()) > 0).toBeTruthy();
    }
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveCount(0);
    expect(googleScriptRequests).toEqual([]);
  });

  test("/dashboard create trip uses wallet layers without URL navigation", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard");
    const launchGlobe = page.getByTestId("almidy-launch-globe");
    await expect(launchGlobe).toBeVisible();
    await expect(launchGlobe).toHaveAttribute("data-map-system", "almidy-apple-map-system");

    const firstTripCard = page.getByTestId("launch-first-trip-card");
    const emptyStateCreate = firstTripCard.getByTestId("launch-first-trip-create");
    const launchSheetAdd = page.getByTestId("mobile-launch-add-trip");

    if ((await emptyStateCreate.count()) > 0) {
      await emptyStateCreate.click();
    } else {
      await expect(launchSheetAdd).toBeVisible({ timeout: 20_000 });
      await launchSheetAdd.click();
    }

    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(launchGlobe).toBeVisible();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");

    const form = page.getByTestId("mobile-trip-create-form");
    await expect(form).toBeVisible();
    await form.getByLabel("Trip name").fill("Paris July");

    await form.getByRole("button", { name: "Set Dates" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "datePicker");
    await expect(launchGlobe).toBeVisible();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-stack-interaction", "slide");
    await expect(page.getByTestId("wallet-date-layer-frame-handle")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(form.getByLabel("Trip name")).toHaveValue("Paris July");

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
    await expect(launchGlobe).toBeVisible();
    await expect(page.getByTestId("wallet-background-layer-frame-handle")).toBeVisible();
    await expect(page.getByTestId("wallet-background-picker-layer")).toBeVisible();
    await page.getByTestId("wallet-background-layer-frame-handle").click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(form.getByLabel("Trip name")).toHaveValue("Paris July");

    await form.getByRole("button", { name: "Background" }).click();
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "backgroundPicker");
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

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
    const permissionPrompt = page.getByTestId("launch-location-permission");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-map-system", "almidy-apple-map-system");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    const firstTripCard = page.getByTestId("launch-first-trip-card");
    if ((await permissionPrompt.count()) > 0) {
      await expect(permissionPrompt).toBeVisible();
      await expect(page.getByRole("heading", { name: 'Allow "Almidy" to use your location?' })).toBeVisible();
      await expect(page.getByRole("button", { name: "Allow Once" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Allow While Using App" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Don't Allow" })).toBeVisible();
      await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
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

    const hadPermissionPrompt = (await permissionPrompt.count()) > 0;

    if (hadPermissionPrompt) {
      await page.getByRole("button", { name: "Allow While Using App" }).click();
      await expect
        .poll(() =>
          page.evaluate(() => (window as typeof window & { __waylineGeolocationCalls: number }).__waylineGeolocationCalls)
        )
        .toBe(1);
    }
    await expect(permissionPrompt).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
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
    const googleScriptRequests = trackGoogleMapsScriptRequests(page);
    await openAuthenticatedMobileRoute(page, "/dashboard/trips");

    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips`);
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-active-layer",
      "myTrips"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-stack",
      "myTrips"
    );
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
      "data-mobile-wallet-shared-model",
      "true"
    );
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
      "data-mobile-globe-wallet-rollout",
      "enabled"
    );
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
      "data-mobile-wallet-active-layer",
      "myTrips"
    );
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
    expect(googleScriptRequests).toEqual([]);
  });

  test("/dashboard/trips overview sheet supports collapsed, small, and expanded states", async ({ page }) => {
    await openAuthenticatedMobileRoute(page, "/dashboard/trips");

    const sheet = page.getByTestId("mobile-country-sheet");
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("mobile-trips-small-overview")).toHaveCount(0);

    await sheet.getByRole("button", { name: "Expand trips sheet" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "small");
    await expect(page.getByTestId("mobile-trips-small-overview")).toBeVisible({ timeout: 20_000 });

    await sheet.getByRole("button", { name: "Expand trips sheet" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");
    await expect(page.getByTestId("trip-overview-page")).toBeVisible({ timeout: 20_000 });

    await sheet.getByRole("button", { name: "Collapse trips sheet" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");
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
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-active-layer",
      "tripOverview"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-stack",
      "myTrips>tripOverview"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-selected-trip-id",
      "demo"
    );
    await expect(page.getByTestId("trip-pass-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-pass-shell")).toHaveAttribute(
      "data-mobile-globe-wallet-rollout",
      "enabled"
    );
    await expect(page.getByTestId("trip-pass-shell")).toHaveAttribute(
      "data-mobile-route-hydration",
      "globe-wallet"
    );
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible();
    await expect(page.getByTestId("mobile-country-sheet")).toBeVisible();
    await expect(page.getByTestId("mobile-country-sheet")).toHaveAttribute("data-sheet-state", "expanded");
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("trip-overview-page")).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("overview-small-pass")).toBeVisible();
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("overview-quick-actions")).toBeVisible();
    await expect(page.getByTestId("desktop-trip-overview-host")).toBeHidden();
    const visibleDetachedOverviewCount = await page.locator('[data-testid="trip-overview-page"]').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const element = node as HTMLElement;
        const isVisible = Boolean(element.offsetParent || element.getClientRects().length);
        return isVisible && !element.closest('[data-testid="mobile-country-sheet"]');
      }).length
    );
    expect(visibleDetachedOverviewCount).toBe(0);
  });

  test("shareable mobile deep links hydrate selected wallet layers", async ({ page }) => {
    const googleScriptRequests = trackGoogleMapsScriptRequests(page);

    await openAuthenticatedMobileRoute(page, "/dashboard/trips/demo/timeline?activity=segment-123");
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-active-layer",
      "itinerary"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-stack",
      "myTrips>tripOverview>itinerary"
    );
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-selected-activity-id",
      "segment-123"
    );

    await openAuthenticatedMobileRoute(page, "/dashboard/trips/demo/ideas?place=place-123");
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute("data-wallet-active-layer", "places");
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-selected-place-id",
      "place-123"
    );

    await openAuthenticatedMobileRoute(page, "/dashboard/trips/demo/map?route=route-123");
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute("data-wallet-active-layer", "routes");
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-selected-route-id",
      "route-123"
    );
    expect(googleScriptRequests).toEqual([]);
  });

  test("itinerary layer focuses the first mapped activity on the globe preview", async ({ page, request }) => {
    const googleScriptRequests = trackGoogleMapsScriptRequests(page);
    const suffix = Date.now();
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        destination_lat: 25.7617,
        destination_lng: -80.1918,
        name: `Wallet focus trip ${suffix}`,
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    const tripId = tripPayload?.trip?.id;
    expect(typeof tripId).toBe("string");

    try {
      const segmentResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          kind: "attraction",
          lat: 25.801,
          lng: -80.199,
          location: "2516 NW 2nd Ave, Miami, FL 33127",
          startTime: "2026-07-09T16:00:00.000Z",
          title: `Wynwood focus activity ${suffix}`,
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await openAuthenticatedMobileRoute(page, `/dashboard/trips/${tripId}/timeline`);

      await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
        "data-wallet-active-layer",
        "itinerary"
      );
      const preview = page.getByTestId("mobile-real-map-preview").first();
      await expect(preview).toBeVisible({ timeout: 20_000 });
      const firstMapItemId = await preview.getAttribute("data-first-map-item-id");
      expect(firstMapItemId).toBeTruthy();
      await expect(preview.locator('[data-map-renderer="apple-mapkit"]').first()).toHaveAttribute(
        "data-selected-map-id",
        firstMapItemId!
      );
      expect(googleScriptRequests).toEqual([]);
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("desktop dashboard routes keep conventional layouts with the shared shell wrapper", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard/trips/demo`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "desktop");
    await expect(page.getByTestId("app-shell-nav")).toBeVisible();
    await expect(page.getByTestId("trip-pass-shell")).toHaveAttribute(
      "data-mobile-globe-wallet-rollout",
      "enabled"
    );
    await expect(page.getByTestId("trip-compact-header")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Trip tabs" })).toBeVisible();
    await expect(page.getByTestId("mobile-globe-wallet-shell")).toHaveAttribute(
      "data-wallet-active-layer",
      "tripOverview"
    );
    await expect(page.getByTestId("itinerary-map-aware-mode")).toHaveCount(0);
  });

});
