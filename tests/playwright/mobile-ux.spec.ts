import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const viewports = [360, 390, 430, 768, 820, 1024, 1280, 1440] as const;
const routes = [
  "/dashboard",
  "/dashboard/search",
  "/dashboard/plan",
  "/dashboard/profile/stats",
  "/dashboard/profile/stats?view=countries&year=all",
  "/dashboard/trips",
  "/dashboard/trips/demo/timeline",
  "/dashboard/trips/demo/map",
  "/dashboard/trips/demo/ideas"
] as const;

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function expectNoHomeGoogleMapsCopy(page: Page) {
  const bodyText = await page.locator("body").innerText();

  expect(bodyText).not.toContain("Oops! Something went wrong.");
  expect(bodyText).not.toContain("This page didn't load Google Maps correctly.");
  expect(bodyText).not.toContain("Google Maps");
}

async function expectNoHomeGoogleMapsScripts(page: Page) {
  const googleMapsScripts = await page.evaluate(() =>
    Array.from(document.scripts)
      .map((script) => script.src)
      .filter((src) => src.includes("maps.googleapis.com") || src.includes("maps.gstatic.com"))
  );

  expect(googleMapsScripts).toEqual([]);
  await expect(page.locator(["gmp", "map", "3d"].join("-"))).toHaveCount(0);
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

    class MockCoordinateRegion {
      center: MockMapKitCoordinate;
      span: MockCoordinateSpan;

      constructor(
        center: MockMapKitCoordinate,
        span: MockCoordinateSpan
      ) {
        this.center = center;
        this.span = span;
      }
    }

    class MockCoordinateSpan {
      constructor(
        public latitudeDelta: number,
        public longitudeDelta: number
      ) {}
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
      overlays: unknown[] = [];
      center: MockMapKitCoordinate | null = null;
      private container: HTMLElement;

      constructor(container: HTMLElement, options?: Record<string, unknown>) {
        this.container = container;
        this.container.dataset.mapkitMock = "ready";
        this.container.dataset.mapkitCameraDistance = String(options?.cameraDistance ?? "");
        this.container.dataset.mapkitMapType = String(options?.mapType ?? "");
        this.container.dataset.mapkitHasRegion = options?.region ? "true" : "false";
        this.container.dataset.mapkitRotationEnabled = String(options?.isRotationEnabled ?? false);
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

      setCameraDistanceAnimated(distance: number) {
        this.container.dataset.mapkitCameraDistance = String(distance);
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

    const mapkitEventHandlers = new Map<string, Set<(event: { status?: string }) => void>>();
    const mapkitRuntime = {
      Annotation: MockAnnotation,
      addEventListener(eventName: string, handler: (event: { status?: string }) => void) {
        const handlers = mapkitEventHandlers.get(eventName) ?? new Set();
        handlers.add(handler);
        mapkitEventHandlers.set(eventName, handlers);
      },
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
      removeEventListener(eventName: string, handler: (event: { status?: string }) => void) {
        mapkitEventHandlers.get(eventName)?.delete(handler);
      },
      __emitConfigurationError(status: string) {
        mapkitEventHandlers.get("error")?.forEach((handler) => handler({ status }));
      },
      __errorHandlerCount() {
        return mapkitEventHandlers.get("error")?.size ?? 0;
      },
      Style: MockStyle
    };
    (window as typeof window & { mapkit?: any; __almidyMapKitInitialized?: boolean }).mapkit = mapkitRuntime;
  });
}

async function installMockGooglePlacesAutocomplete(
  page: Page,
  {
    address = "Barcelona, Catalonia, Spain",
    lat = 41.3851,
    lng = 2.1734,
    name = "Barcelona",
    placeId = "test-barcelona-place"
  }: {
    address?: string;
    lat?: number;
    lng?: number;
    name?: string;
    placeId?: string;
  } = {}
) {
  await page.addInitScript(
    ({ address: mockedAddress, lat: mockedLat, lng: mockedLng, name: mockedName, placeId: mockedPlaceId }) => {
      const currentGoogle = (window as typeof window & { google?: any }).google ?? {};
      const currentMaps = currentGoogle.maps ?? {};
      const currentImportLibrary = currentMaps.importLibrary;
      const places = {
        AutocompleteSessionToken: class {},
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: async () => ({
            suggestions: [
              {
                placePrediction: {
                  mainText: { text: mockedName },
                  placeId: mockedPlaceId,
                  secondaryText: { text: mockedAddress },
                  text: { text: mockedAddress },
                  toPlace: () => ({
                    fetchFields: async () => ({
                      place: {
                        displayName: mockedName,
                        formattedAddress: mockedAddress,
                        googleMapsURI: `https://maps.google.com/?q=${encodeURIComponent(mockedAddress)}`,
                        id: mockedPlaceId,
                        location: {
                          lat: () => mockedLat,
                          lng: () => mockedLng
                        },
                        types: ["locality", "political"]
                      }
                    })
                  })
                }
              }
            ]
          })
        }
      };

      (window as typeof window & { google?: any }).google = {
        ...currentGoogle,
        maps: {
          ...currentMaps,
          importLibrary: async (libraryName: string) => {
            if (libraryName === "places") {
              return places;
            }

            return currentImportLibrary ? currentImportLibrary(libraryName) : {};
          },
          places
        }
      };
    },
    { address, lat, lng, name, placeId }
  );
}

async function installMockGoogleMaps3DNativeError(page: Page) {
  await page.addInitScript(() => {
    class MockBrokenMap3DElement extends HTMLElement {
      constructor(options?: Record<string, unknown>) {
        super();
        Object.assign(this, options);
        window.setTimeout(() => {
          this.textContent =
            "Oops! Something went wrong. This page didn't load Google Maps correctly. See the JavaScript console for technical details.";
        }, 0);
      }
    }

    if (!customElements.get("almidy-test-broken-map-3d")) {
      customElements.define("almidy-test-broken-map-3d", MockBrokenMap3DElement);
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
              Map3DElement: MockBrokenMap3DElement,
              MapMode: { HYBRID: "HYBRID" }
            };
          }

          return {};
        }
      }
    };
  });
}

type MockLocationPermission = "granted" | "denied";

async function installMockMobileLocation(
  page: Page,
  {
    latitude = 25.7617,
    longitude = -80.1918,
    permission = "granted"
  }: {
    latitude?: number;
    longitude?: number;
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
            coordinate: { lat: latitude, lng: longitude },
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

  await page.addInitScript(
    ({ latitude: mockedLatitude, longitude: mockedLongitude, permission: mockedPermission }) => {
      window.localStorage.removeItem("wayline:last-user-location");
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
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
                latitude: mockedLatitude,
                longitude: mockedLongitude,
                speed: null
              },
              timestamp: Date.now()
            } as GeolocationPosition);
          }
        }
      });

    },
    { latitude, longitude, permission }
  );

  await installMockGoogleMaps3D(page);
  await installMockAppleMapKit(page);
}

test.describe("mobile soft-launch UX", () => {
  for (const width of [360, 390, 430] as const) {
    test(`mobile root opens launch globe instead of landing page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.setExtraHTTPHeaders({
        "sec-ch-ua-mobile": "?1",
        "x-cypress-dashboard": "true"
      });
      await page.goto(`${baseUrl}/`, { waitUntil: "commit" });

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
      await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "All your trip details. Finally, in one place." })).toHaveCount(0);

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - window.innerWidth;
      });

      expect(overflow, `public homepage overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }

  test("mobile guests can open launch globe and see welcome get started sheet", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "sec-ch-ua-mobile": "?1" });
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute("data-sheet-state", "expanded");
    await expect(page.getByTestId("mobile-launch-welcome")).toBeVisible();
    await expect(page.getByText("Welcome")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Get Started" })).toBeVisible();
    const createFirstTrip = page.getByRole("button", { name: "Create Your First Trip" });
    await expect(createFirstTrip).toBeVisible();
    await createFirstTrip.click();
    await expect(page).toHaveURL(`${baseUrl}/dashboard`);
    await expect(page.getByTestId("dashboard-wallet-layer-stack")).toHaveAttribute("data-wallet-layer", "createTrip");
    await expect(page.getByRole("link", { name: "Forward Your Reservation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Sample Trip" })).toBeVisible();
  });

  for (const width of viewports) {
    test(`core routes avoid horizontal overflow at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ height: 900, width });
      await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

      for (const route of routes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "commit" });
        await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth - window.innerWidth;
        });

        expect(overflow, `${route} overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("mobile dashboard shell does not render global bottom navigation", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    const routesWithoutGlobalNav = [
      "/dashboard",
      "/dashboard/trips",
      "/dashboard/plan",
      "/dashboard/map",
      "/dashboard/profile/stats"
    ];

    for (const route of routesWithoutGlobalNav) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "commit" });
      await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });
      await expect(nav).toHaveCount(0);
      await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
    }

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });
    await expect(nav).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("ios-launch-sheet-collapsed")).toBeVisible();
  });

  test("dashboard shell renders separate mobile and desktop structures", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.setViewportSize({ height: 900, width: 390 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
    await expect(page.getByTestId("app-shell-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-topbar")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-mobile-drawer")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();

    await page.setViewportSize({ height: 430, width: 932 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "mobile");
    await expect(page.getByTestId("app-shell-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-topbar")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();

    await page.setViewportSize({ height: 900, width: 1024 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "desktop");
    await expect(page.getByTestId("app-shell-sidebar")).toBeVisible();
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();
    await expect(page.getByTestId("app-shell-nav")).toBeVisible();
  });

  test("mobile trip workspace hides global bottom navigation", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard/trips/demo/timeline`, { waitUntil: "commit" });
    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Itinerary quick actions" })).toBeVisible();

    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(nav).toHaveCount(0);
    await expect(page.getByTestId("map-route-panel")).toBeVisible({ timeout: 30_000 });
  });

  test("mobile hides the global topbar and keeps it on desktop", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    for (const route of [
      "/dashboard/plan",
      "/dashboard/search",
      "/dashboard/trips",
      "/dashboard/trips/demo",
      "/dashboard/trips/demo/timeline",
      "/dashboard/trips/demo/map",
      "/dashboard/trips/demo/ideas",
      "/dashboard/trips/demo/budget",
      "/dashboard/trips/demo/documents",
      "/dashboard/trips/demo/share",
      "/dashboard/account"
    ] as const) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "commit" });
      await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("app-shell-topbar")).toBeHidden();
    }

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("app-shell-topbar")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);

    await page.setViewportSize({ height: 900, width: 1024 });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();
  });

  test("Verify account deletion sequence locks destruction button until confirmation matches", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/account`, { waitUntil: "commit" });
    await expect(page.getByTestId("account-settings-page")).toBeVisible({ timeout: 30_000 });

    const initialButton = page.locator('button:has-text("Delete Account...")');
    await expect(initialButton).toBeVisible();
    await initialButton.click();

    const confirmInput = page.locator('input[placeholder="Type required text match"]');
    const actionButton = page.locator('button:has-text("Confirm Destruction")');
    await expect(confirmInput).toBeVisible();
    await expect(actionButton).toBeDisabled();

    await confirmInput.fill("DELETE ACCOUNT");
    await expect(actionButton).toBeDisabled();

    await confirmInput.fill("DELETE MY ACCOUNT");
    await expect(actionButton).toBeEnabled();
  });

  test("mobile trips page is canonical and keeps the My Trips map surface", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/dashboard\/trips$/);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-country-map-canvas")).toBeVisible();
    await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
      "data-map-system",
      "almidy-apple-map-system"
    );
    await expect(page.getByTestId("almidy-launch-globe")).toHaveCount(0);
    await expect(page.getByTestId("mobile-trips-globe-flag-pin").first()).toHaveAttribute("data-active", "false");
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

  test("2D premium map anchors flag pins and routes city label selection", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const vancouverResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Vancouver, Canada",
        destination_lat: 49.2827,
        destination_lng: -123.1207,
        end_date: "2026-09-18",
        name: `Vancouver flat map regression ${Date.now()}`,
        start_date: "2026-09-12",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(vancouverResponse.status()).toBe(201);
    const vancouverPayload = await vancouverResponse.json();
    const vancouverTripId = vancouverPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

      const mapWrapper = page.getByTestId("mobile-country-map-canvas");
      await expect(mapWrapper).toBeVisible({ timeout: 20_000 });
      await expect(mapWrapper).toHaveAttribute("data-map-system", "almidy-apple-map-system");

      const vancouverPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${vancouverTripId}"]`
      );
      await expect(vancouverPin).toBeVisible();
      await expect(vancouverPin).toHaveAttribute("data-country-code", "CA");
      await expect(vancouverPin).toHaveAttribute("data-pin-latitude", "49.28270");
      await expect(vancouverPin).toHaveAttribute("data-pin-longitude", "-123.12070");

      const vancouverLabel = vancouverPin.getByText("Vancouver");
      await expect(vancouverLabel).toBeVisible();
      await vancouverLabel.dispatchEvent("click");

      await expect(vancouverPin).toHaveAttribute("data-active", "true");
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-selected-map-id",
        `trip-${vancouverTripId}`
      );
      await expect(
        page.locator(`[data-testid="mobile-trips-overview-card"][data-trip-id="${vancouverTripId}"]`)
      ).toBeVisible();
    } finally {
      await deleteTripForTest(request, vancouverTripId);
    }
  });

  test("Verify map canvas fills the entire viewport background and doesn't clip info card popups", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const brazilResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Brazil",
        destination_lat: -14.235,
        destination_lng: -51.9253,
        end_date: "2026-06-16",
        name: `Brazil full bleed regression ${Date.now()}`,
        start_date: "2026-06-04",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(brazilResponse.status()).toBe(201);
    const brazilPayload = await brazilResponse.json();
    const brazilTripId = brazilPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

      const mapElement = page.getByTestId("mobile-country-map-canvas");
      await expect(mapElement).toBeVisible({ timeout: 20_000 });
      await expect(mapElement).toHaveAttribute("data-map-system", "almidy-apple-map-system");

      const viewport = page.viewportSize();
      const boundingBox = await mapElement.boundingBox();
      expect(boundingBox).not.toBeNull();
      expect(boundingBox?.width).toBeGreaterThan(300);
      if (viewport && boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(viewport.width);
        expect(boundingBox.height).toBeGreaterThanOrEqual(viewport.height);
      }

      const brazilPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${brazilTripId}"]`
      );
      await expect(brazilPin).toBeVisible();
      await brazilPin.getByText("Brazil").dispatchEvent("click");

      const selectedTripCard = page.locator(
        `[data-testid="mobile-trips-overview-card"][data-trip-id="${brazilTripId}"]`
      );
      await expect(selectedTripCard).toBeVisible();
      await expect(selectedTripCard).toContainText("Brazil");

      const cardBox = await selectedTripCard.boundingBox();
      const sheetBox = await page.getByTestId("mobile-country-sheet").boundingBox();
      expect(cardBox).not.toBeNull();
      expect(sheetBox).not.toBeNull();
      if (cardBox && sheetBox) {
        expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(sheetBox.y + 1);
      }
    } finally {
      await deleteTripForTest(request, brazilTripId);
    }
  });

  test("Verify 2D map viewport layout fills the background completely with zero top clipping bounds", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const barcelonaResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Barcelona, Spain",
        destination_lat: 41.3851,
        destination_lng: 2.1734,
        end_date: "2026-07-30",
        name: `Barcelona viewport coverage ${Date.now()}`,
        start_date: "2026-06-26",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(barcelonaResponse.status()).toBe(201);
    const barcelonaPayload = await barcelonaResponse.json();
    const barcelonaTripId = barcelonaPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

      const mapElement = page.getByTestId("mobile-country-map-canvas");
      await expect(mapElement).toBeVisible({ timeout: 20_000 });
      await expect(mapElement).toHaveAttribute("data-map-system", "almidy-apple-map-system");

      const bounds = await mapElement.boundingBox();
      const viewport = page.viewportSize();
      expect(bounds).not.toBeNull();
      expect(bounds?.height).toBeGreaterThan(600);
      if (bounds && viewport) {
        expect(bounds.y).toBeLessThanOrEqual(0);
        expect(bounds.height).toBeGreaterThanOrEqual(viewport.height);
      }

      const barcelonaPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${barcelonaTripId}"]`
      );
      await expect(barcelonaPin).toBeVisible();
      await expect(barcelonaPin.getByText("Barcelona")).toBeVisible();
    } finally {
      await deleteTripForTest(request, barcelonaTripId);
    }
  });

  test("Verify map camera panning updates position tracking safely after selecting card components", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const vancouverResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Vancouver, Canada",
        destination_lat: 49.2827,
        destination_lng: -123.1207,
        end_date: "2026-10-08",
        name: `Vancouver map card pan regression ${Date.now()}`,
        start_date: "2026-10-01",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(vancouverResponse.status()).toBe(201);
    const vancouverPayload = await vancouverResponse.json();
    const vancouverTripId = vancouverPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

      const mapWrapper = page.getByTestId("mobile-country-map-canvas");
      await expect(mapWrapper).toBeVisible({ timeout: 20_000 });
      await expect(mapWrapper).toHaveAttribute("data-map-system", "almidy-apple-map-system");

      const vancouverPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${vancouverTripId}"]`
      );
      await expect(vancouverPin).toBeVisible();
      await vancouverPin.getByText("Vancouver").dispatchEvent("click");

      const vancouverCard = page.locator(
        `[data-testid="mobile-trips-overview-card"][data-trip-id="${vancouverTripId}"]`
      );
      await expect(vancouverCard).toBeVisible();
      await expect(vancouverPin).toHaveAttribute("data-active", "true");

      await vancouverCard.dispatchEvent("click");

      await expect(vancouverCard).toHaveAttribute("data-active", "true");
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-selected-map-id",
        `trip-${vancouverTripId}`
      );
    } finally {
      await deleteTripForTest(request, vancouverTripId);
    }
  });

  test("mobile trips overview create trigger opens the canonical new-trip form", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });

    const plusButton = page.getByTestId("mobile-trips-wallet-create-trigger");
    await expect(plusButton).toBeVisible();
    await plusButton.click();
    await page.waitForURL("**/dashboard/trips?view=list#new-trip", { timeout: 20_000, waitUntil: "commit" });
    await expect(page.getByTestId("mobile-trips-wallet-screen")).toBeVisible({ timeout: 20_000 });
    const mobileCreateForm = page.getByTestId("mobile-create-another-trip").getByTestId("mobile-trip-create-form");
    await expect(mobileCreateForm).toBeVisible({ timeout: 20_000 });
    await expect(mobileCreateForm).toHaveAttribute("data-hydrated", "true");
  });

  test("mobile wallet trip card opens the canonical trip workspace", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const tripName = `Miami wallet navigation ${Date.now()}`;
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL, United States",
        destination_lat: 25.7617,
        destination_lng: -80.1918,
        end_date: "2026-05-08",
        name: tripName,
        start_date: "2026-05-01",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    const tripId = tripPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeAttached({ timeout: 20_000 });

      const tripCard = page.locator(
        `[data-testid="mobile-trips-wallet-card"][href="/dashboard/trips/${tripId}"]`
      );
      await expect(tripCard).toBeVisible({ timeout: 20_000 });
      await expect(tripCard).toHaveAttribute("href", `/dashboard/trips/${tripId}`);

      await tripCard.click();
      await page.waitForURL(`**/dashboard/trips/${tripId}`, { timeout: 20_000, waitUntil: "commit" });
      await expect(page).toHaveURL(new RegExp(`/dashboard/trips/${escapeRegExp(tripId)}$`));
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile wallet plus action routes to the new trip anchor", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeAttached({ timeout: 20_000 });

    const createButton = page.getByTestId("mobile-trips-wallet-create-trigger");
    await expect(createButton).toBeVisible();
    await expect(createButton).toHaveAttribute("href", "/dashboard/trips?view=list#new-trip");

    await createButton.click();
    await page.waitForURL("**/dashboard/trips?view=list#new-trip", { timeout: 20_000, waitUntil: "commit" });
    await expect(page).toHaveURL(`${baseUrl}/dashboard/trips?view=list#new-trip`);
  });

  test("mobile trips globe pins saved destinations with latitude and longitude aligned", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const tripName = `Barcelona coordinate regression ${Date.now()}`;
    const barcelonaResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Barcelona, Spain",
        destination_lat: 41.3851,
        destination_lng: 2.1734,
        end_date: "2026-07-30",
        name: tripName,
        start_date: "2026-06-26",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(barcelonaResponse.status()).toBe(201);
    const barcelonaPayload = await barcelonaResponse.json();
    const barcelonaTripId = barcelonaPayload?.trip?.id;

    const newYorkResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "New York, USA",
        destination_lat: 40.7128,
        destination_lng: -74.006,
        end_date: "2026-08-08",
        name: `New York coordinate regression ${Date.now()}`,
        start_date: "2026-08-01",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(newYorkResponse.status()).toBe(201);
    const newYorkPayload = await newYorkResponse.json();
    const newYorkTripId = newYorkPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mobile-trips-overview-card")).toHaveCount(0);
      await expect(
        page.locator('[data-testid="mobile-trips-overview-card"]', { hasText: "Barcelona, Spain" })
      ).toHaveCount(0);
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-globe-trip-pin-countries",
        /(^|,)ES(,|$)/
      );
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-globe-trip-pin-ids",
        new RegExp(`(^|,)${escapeRegExp(barcelonaTripId)}(,|$)`)
      );
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-globe-trip-pin-ids",
        new RegExp(`(^|,)${escapeRegExp(newYorkTripId)}(,|$)`)
      );
      await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
        "data-map-instance-key",
        new RegExp(`^trips-globe-\\d+-.*${escapeRegExp(barcelonaTripId)}:ES:41\\.38510:2\\.17340`)
      );
      await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
        "data-map-system",
        "almidy-apple-map-system"
      );
      const overviewMapCanvas = page.getByTestId("mobile-country-map-canvas");
      await overviewMapCanvas.evaluate((element) => {
        (element as HTMLElement & { __almidyStableMountProbe?: string }).__almidyStableMountProbe =
          "selection-survived";
      });

      const barcelonaPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${barcelonaTripId}"]`
      );
      await expect(barcelonaPin).toBeVisible();
      await expect(barcelonaPin).toHaveAttribute("data-trip-id", barcelonaTripId);
      await expect(barcelonaPin).toHaveAttribute("data-country-code", "ES");
      await expect(barcelonaPin).toHaveAttribute("data-pin-latitude", "41.38510");
      await expect(barcelonaPin).toHaveAttribute("data-pin-longitude", "2.17340");
      const barcelonaPinPaint = await barcelonaPin.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return {
          height: rect.height,
          isInViewport:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight,
          overflow: style.overflow,
          pointerEvents: style.pointerEvents,
          width: rect.width,
          zIndex: style.zIndex
        };
      });
      const sheetZIndex = await page.getByTestId("mobile-country-sheet").evaluate((element) =>
        Number(window.getComputedStyle(element).zIndex)
      );
      expect(barcelonaPinPaint.width).toBeGreaterThan(0);
      expect(barcelonaPinPaint.height).toBeGreaterThan(0);
      expect(barcelonaPinPaint.isInViewport).toBe(true);
      expect(barcelonaPinPaint.pointerEvents).toBe("auto");
      expect(barcelonaPinPaint.overflow).toBe("visible");
      expect(Number(barcelonaPinPaint.zIndex)).toBe(40);
      expect(sheetZIndex).toBeGreaterThan(Number(barcelonaPinPaint.zIndex));

      const newYorkPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${newYorkTripId}"]`
      );
      await expect(newYorkPin).toBeVisible();
      await expect(newYorkPin).toHaveAttribute("data-trip-id", newYorkTripId);
      await expect(newYorkPin).toHaveAttribute("data-country-code", "US");
      await expect(newYorkPin).toHaveAttribute("data-pin-latitude", "40.71280");
      await expect(newYorkPin).toHaveAttribute("data-pin-longitude", "-74.00600");

      await barcelonaPin.dispatchEvent("click");
      const mapStayedMounted = await overviewMapCanvas.evaluate((element) => {
        return (element as HTMLElement & { __almidyStableMountProbe?: string }).__almidyStableMountProbe;
      });
      expect(mapStayedMounted).toBe("selection-survived");
      await expect(barcelonaPin).toHaveAttribute("data-active", "true");

      const barcelonaCard = page.locator(
        `[data-testid="mobile-trips-overview-card"][data-trip-id="${barcelonaTripId}"]`
      );
      await expect(barcelonaCard).toBeVisible();
      await expect(barcelonaCard).toContainText("Barcelona");
      await expect(barcelonaCard.getByText("Barcelona, Spain")).toBeVisible();

      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-selected-map-id",
        `trip-${barcelonaTripId}`
      );

      await page.reload({ waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      const reloadedBarcelonaPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${barcelonaTripId}"]`
      );
      await expect(reloadedBarcelonaPin).toBeVisible();
      await expect(reloadedBarcelonaPin).toHaveAttribute("data-country-code", "ES");
      await expect(reloadedBarcelonaPin).toHaveAttribute("data-pin-latitude", "41.38510");
      await expect(reloadedBarcelonaPin).toHaveAttribute("data-pin-longitude", "2.17340");
      await expect(
        page.locator(`[data-testid="mobile-trips-overview-card"][data-trip-id="${barcelonaTripId}"]`)
      ).toHaveCount(0);
    } finally {
      await deleteTripForTest(request, barcelonaTripId);
      await deleteTripForTest(request, newYorkTripId);
    }
  });

  test("mobile trips globe renders empty year state without stalling loader", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGoogleMaps3D(page);

    const unmappedTripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Coordinate pending destination",
        end_date: "2099-07-30",
        name: `Unmapped empty globe regression ${Date.now()}`,
        start_date: "2099-06-26",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(unmappedTripResponse.status()).toBe(201);
    const unmappedTripPayload = await unmappedTripResponse.json();
    const unmappedTripId = unmappedTripPayload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mobile-trips-overview-year-select")).toHaveValue("2099");
      await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
        "data-map-trip-state",
        "empty"
      );
      await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
        "data-map-instance-key",
        "trips-globe-2099-empty"
      );
      await expect(page.getByText("Loading trips...")).toHaveCount(0);
      await expect(page.getByTestId("almidy-launch-globe")).toHaveCount(0);
      await expect(page.getByTestId("mobile-trips-empty-year-map-state")).toContainText("No trips saved for 2099");
      await expect(page.getByTestId("mobile-trips-globe-flag-pin")).toHaveCount(0);
    } finally {
      await deleteTripForTest(request, unmappedTripId);
    }
  });

  test("mobile trips secondary list route remains available", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });
    const firstTripState = page.getByTestId("mobile-first-trip-state");
    const tripWallet = page.getByTestId("mobile-trips-wallet");
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-wallet-background").locator("img")).toHaveCount(0);

    if (await firstTripState.isVisible()) {
      await expect(firstTripState.getByTestId("mobile-premium-first-trip-card")).toBeVisible();
      await expect(firstTripState.getByRole("heading", { name: "Create your first trip" })).toBeVisible();
      await expect(firstTripState.getByRole("button", { name: "Create trip" })).toBeVisible();
      const createPanel = page.getByTestId("mobile-create-another-trip");
      await expect(createPanel.getByTestId("mobile-trip-create-form")).toBeVisible();
      await expect(createPanel.getByTestId("mobile-trip-create-sheet")).toBeVisible();
    } else {
      await expect(tripWallet).toBeVisible();
      await expect(tripWallet.getByTestId("mobile-trip-pass-card").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Open travel stats" })).toHaveAttribute(
        "href",
        "/dashboard/profile/stats"
      );
      await expect(page.getByTestId("mobile-trips-stats-link")).toHaveAttribute(
        "href",
        "/dashboard/profile/stats"
      );
      await expect(page.getByTestId("mobile-create-another-trip").getByText("Create trip")).toBeVisible();
    }
  });

  for (const width of [360, 390, 430] as const) {
    test(`mobile travel stats shows overview and country detail at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
      await page.goto(`${baseUrl}/dashboard/profile/stats`, { waitUntil: "commit" });

      await expect(page.getByTestId("travel-stats-page")).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByTestId("travel-stats-overview").getByRole("heading", { name: "Travel Stats" })
      ).toBeVisible();
      await expect(page.getByTestId("travel-stats-year-selector")).toBeVisible();
      await expect(page.getByTestId("travel-stats-countries")).toBeVisible();
      await expect(page.getByTestId("travel-stats-transport")).toBeVisible();

      const countriesLink = page.getByTestId("travel-stats-countries-link");
      if ((await countriesLink.count()) > 0) {
        await expect(countriesLink).toHaveAttribute("href", /\/dashboard\/profile\/stats\?.*view=countries/);
      } else {
        await expect(page.getByText("No country stats yet")).toBeVisible();
        await expect(page.getByText("Create trips with destinations to build your travel history.")).toBeVisible();
      }

      let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `mobile travel stats overview overflow at ${width}px`).toBeLessThanOrEqual(1);

      const transportCard = page.getByTestId("travel-stats-transport").locator("article").last();
      await transportCard.scrollIntoViewIfNeeded();
      const transportClearance = await transportCard.evaluate((element) => {
        const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
        const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
        return Math.round(navTop - element.getBoundingClientRect().bottom);
      });
      expect(transportClearance, `travel stats transport nav clearance at ${width}px`).toBeGreaterThanOrEqual(8);

      await page.goto(`${baseUrl}/dashboard/profile/stats?view=countries&year=all`, { waitUntil: "commit" });
      await expect(page.getByTestId("travel-stats-countries-detail")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("travel-stats-countries").getByRole("heading", { name: "Countries" })).toBeVisible();
      await expect(page.getByText("World total")).toBeVisible();
      await expect(page.getByText(/Visited/)).toBeVisible();

      if ((await page.getByText("No country stats yet").count()) > 0) {
        await expect(page.getByText("Create trips with destinations to build your travel history.")).toBeVisible();
      } else {
        await expect(page.getByTestId("travel-stats-countries").getByText(/\d+x/).first()).toBeVisible();
      }

      overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `mobile travel stats countries overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }

  test("mobile travel stats is reachable from the secondary trips stats control", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const response = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Mobile stats link trip ${Date.now()}`,
        start_date: "2026-05-29",
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(response.status()).toBe(201);
    const payload = await response.json();
    const tripId = payload?.trip?.id;

    try {
      await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });

      const statsLink = page.getByTestId("mobile-trips-stats-link").first();
      await expect(statsLink).toHaveAttribute("href", "/dashboard/profile/stats");
      await statsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/profile\/stats/);
      await expect(page.getByTestId("travel-stats-page")).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile trips secondary list includes mapped and list-only trips", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const suffix = Date.now();
    const mappedTripName = `Mobile country map Miami ${suffix}`;
    const listOnlyTripName = `Mobile country map Manual ${suffix}`;
    const createdTripIds: string[] = [];

    try {
      const mappedResponse = await request.post(`${baseUrl}/api/trips`, {
        data: {
          destination: "Miami, FL",
          destination_lat: 25.7617,
          destination_lng: -80.1918,
          name: mappedTripName,
          start_date: "2026-05-29",
          status: "Planning",
          travel_style: "balanced"
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(mappedResponse.status()).toBe(201);
      const mappedPayload = await mappedResponse.json();
      createdTripIds.push(mappedPayload?.trip?.id);

      const listOnlyResponse = await request.post(`${baseUrl}/api/trips`, {
        data: {
          destination: "Manual destination",
          name: listOnlyTripName,
          start_date: "2026-05-29",
          status: "Planning",
          travel_style: "balanced"
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(listOnlyResponse.status()).toBe(201);
      const listOnlyPayload = await listOnlyResponse.json();
      createdTripIds.push(listOnlyPayload?.trip?.id);

      await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-wallet-screen")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();

      await page.getByPlaceholder("Search for trips").fill(`Mobile country map ${suffix}`);
      const tripsWallet = page.getByTestId("mobile-trips-wallet");
      const mappedRow = tripsWallet.getByRole("link", {
        name: new RegExp(escapeRegExp(mappedTripName))
      });
      const listOnlyRow = tripsWallet.getByRole("link", {
        name: new RegExp(escapeRegExp(listOnlyTripName))
      });
      await expect(mappedRow).toBeVisible();
      await expect(listOnlyRow).toBeVisible();
    } finally {
      for (const tripId of createdTripIds) {
        await deleteTripForTest(request, tripId);
      }
    }
  });

  test("mobile trip create form posts the v1 payload shape", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockGooglePlacesAutocomplete(page);

    let capturedPayload: unknown = null;
    await page.route("**/api/v1/trips", async (route) => {
      capturedPayload = route.request().postDataJSON();
      await route.fulfill({
        body: JSON.stringify({
          trip: {
            id: "intercepted-v1-trip"
          }
        }),
        contentType: "application/json",
        status: 201
      });
    });

    await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-trips-wallet-screen")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 20_000 }
    );

    const createPanel = page.getByTestId("mobile-create-another-trip").last();
    if ((await createPanel.locator('[data-testid="mobile-trip-create-form"]:visible').count()) === 0) {
      await createPanel.getByRole("button", { name: /Create trip/ }).click();
    }

    const form = page.locator('[data-testid="mobile-trip-create-form"]:visible').last();
    await expect(form).toBeVisible();
    await form.getByLabel("Trip name").fill("Barcelona summer");
    await form.getByLabel("Destination").fill("Barcelona");
    await form.getByRole("button", { name: /Barcelona, Catalonia, Spain/ }).click();
    await form.getByLabel("Start date").fill("2026-07-10");
    await form.getByLabel("End date").fill("2026-07-24");
    await form.getByLabel("Expense budget").fill("1250");
    await form.getByLabel("Travel style").selectOption("relaxed");

    await form.getByRole("button", { name: "Create" }).last().click();
    await page.waitForURL("**/dashboard/trips", { timeout: 20_000, waitUntil: "commit" });

    expect(capturedPayload).toEqual({
      country_code: "ES",
      destination: "Barcelona, Catalonia, Spain",
      destination_formatted_address: "Barcelona, Catalonia, Spain",
      destination_lat: 41.3851,
      destination_lng: 2.1734,
      destination_place_id: "test-barcelona-place",
      end_date: "2026-07-24",
      expense_budget: 1250,
      start_date: "2026-07-10",
      travel_style: "relaxed",
      trip_name: "Barcelona summer"
    });
  });

  test("mobile first-trip create flow returns to globe with coordinate-backed country pin", async ({
    page,
    request
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await installMockGooglePlacesAutocomplete(page);

    const tripName = `Barcelona mobile create ${Date.now()}`;
    let createdTripId: string | null = null;

    try {
      await page.goto(`${baseUrl}/dashboard/trips?view=list#new-trip`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-wallet-screen")).toBeVisible({ timeout: 20_000 });
      const form = page.locator('[data-testid="mobile-trip-create-form"]:visible').last();
      await expect(form).toBeVisible({ timeout: 20_000 });
      await form.getByLabel("Trip name").fill(tripName);
      await form.getByLabel("Destination").fill("Barcelona");
      await form.getByRole("button", { name: /Barcelona, Catalonia, Spain/ }).click();
      await form.getByLabel("Start date").fill("2026-07-10");
      await form.getByLabel("End date").fill("2026-07-24");

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/trips") &&
          response.request().method() === "POST" &&
          response.status() === 201
      );
      await form.getByRole("button", { name: "Create" }).last().click();
      await createResponsePromise;
      await page.waitForURL("**/dashboard/trips", { timeout: 20_000, waitUntil: "commit" });

      const tripsResponse = await request.get(`${baseUrl}/api/trips`, {
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(tripsResponse.status()).toBe(200);
      const tripsPayload = await tripsResponse.json();
      const createdTrip = tripsPayload.trips.find((trip: any) => trip.name === tripName);
      createdTripId = createdTrip?.id ?? null;
      expect(createdTrip).toMatchObject({
        destination: "Barcelona, Catalonia, Spain",
        destination_lat: 41.3851,
        destination_lng: 2.1734,
        destination_status: "resolved"
      });
      expect(createdTripId).toBeTruthy();

      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mobile-country-map-canvas")).toHaveAttribute(
        "data-map-system",
        "almidy-apple-map-system"
      );
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toHaveAttribute(
        "data-globe-trip-pin-countries",
        /(^|,)ES(,|$)/
      );

      const barcelonaPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${createdTripId}"]`
      );
      await expect(barcelonaPin).toBeVisible();
      await expect(barcelonaPin).toHaveAttribute("data-country-code", "ES");
      await expect(barcelonaPin).toHaveAttribute("data-pin-latitude", "41.38510");
      await expect(barcelonaPin).toHaveAttribute("data-pin-longitude", "2.17340");
      await expect(
        page.locator(`[data-testid="mobile-trips-overview-card"][data-trip-id="${createdTripId}"]`)
      ).toHaveCount(0);

      const overviewMapCanvas = page.getByTestId("mobile-country-map-canvas");
      await overviewMapCanvas.evaluate((element) => {
        (element as HTMLElement & { __almidyStableMountProbe?: string }).__almidyStableMountProbe =
          "pin-tap-survived";
      });

      await barcelonaPin.dispatchEvent("click", { bubbles: true, cancelable: true });
      await expect(barcelonaPin).toHaveAttribute("data-active", "true", { timeout: 8_000 });
      const card = page.locator(
        `[data-testid="mobile-trips-overview-card"][data-trip-id="${createdTripId}"]`
      );
      await expect(card).toBeVisible({ timeout: 8_000 });
      await expect(card).toContainText("Barcelona");
      await expect(card.getByText("Barcelona, Catalonia, Spain")).toBeVisible();
      const globeStayedMounted = await overviewMapCanvas.evaluate((element) => {
        return (element as HTMLElement & { __almidyStableMountProbe?: string }).__almidyStableMountProbe;
      });
      expect(globeStayedMounted).toBe("pin-tap-survived");

      await page.reload({ waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      const reloadedPin = page.locator(
        `[data-testid="mobile-trips-globe-flag-pin"][data-trip-id="${createdTripId}"]`
      );
      await expect(reloadedPin).toBeVisible();
      await expect(reloadedPin).toHaveAttribute("data-country-code", "ES");
      await expect(reloadedPin).toHaveAttribute("data-pin-latitude", "41.38510");
      await expect(reloadedPin).toHaveAttribute("data-pin-longitude", "2.17340");
    } finally {
      await deleteTripForTest(request, createdTripId);
    }
  });

  test("v1 trips API stores real destination coordinates and supports year reads", async ({ request }) => {
    test.setTimeout(60_000);

    const tripName = `V1 Barcelona API ${Date.now()}`;
    const createResponse = await request.post(`${baseUrl}/api/v1/trips`, {
      data: {
        country_code: "es",
        destination: "Barcelona, Catalonia, Spain",
        destination_formatted_address: "Barcelona, Catalonia, Spain",
        destination_lat: 41.3851,
        destination_lng: 2.1734,
        end_date: "2026-07-24",
        expense_budget: 1800,
        start_date: "2026-07-10",
        travel_style: "balanced",
        trip_name: tripName
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(createResponse.status()).toBe(201);
    const createPayload = await createResponse.json();
    const createdTripId = createPayload?.trip?.id;

    try {
      expect(createPayload).toMatchObject({
        success: true,
        trip: {
          countryCode: "ES",
          country_code: "ES",
          destination_name: "Barcelona, Catalonia, Spain",
          expense_budget: 1800,
          lat: 41.3851,
          lng: 2.1734,
          travel_style: "balanced",
          trip_name: tripName
        }
      });

      const readResponse = await request.get(`${baseUrl}/api/v1/trips?year=2026`, {
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(readResponse.status()).toBe(200);
      const readPayload = await readResponse.json();
      expect(readPayload.success).toBe(true);
      expect(readPayload.trips).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            countryCode: "ES",
            id: createdTripId,
            lat: 41.3851,
            lng: 2.1734,
            trip_name: tripName
          })
        ])
      );
    } finally {
      await deleteTripForTest(request, createdTripId);
    }
  });

  test("v1 trips API accepts valid Tokyo coordinates and rejects malformed payloads", async ({ request }) => {
    test.setTimeout(60_000);

    const tripName = `Tokyo Spring Escape ${Date.now()}`;
    const response = await request.post(`${baseUrl}/api/v1/trips`, {
      data: {
        countryCode: "jp",
        destination: "Tokyo, Japan",
        destination_formatted_address: "Tokyo, Japan",
        destination_lat: 35.6762,
        destination_lng: 139.6503,
        end_date: "2026-04-26",
        expense_budget: 3200,
        start_date: "2026-04-12",
        travel_style: "relaxed",
        trip_name: tripName
      },
      headers: { "x-cypress-dashboard": "true" }
    });

    expect(response.status()).toBe(201);
    const responseBody = await response.json();
    const createdTripId = responseBody?.trip?.id;

    try {
      expect(responseBody).toMatchObject({
        success: true,
        trip: {
          countryCode: "JP",
          country_code: "JP",
          destination_name: "Tokyo, Japan",
          expense_budget: 3200,
          lat: 35.6762,
          lng: 139.6503,
          travel_style: "relaxed",
          trip_name: tripName
        }
      });

      const badResponse = await request.post(`${baseUrl}/api/v1/trips`, {
        data: {
          start_date: "2026-04-12"
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(badResponse.status()).toBe(400);
      const badBody = await badResponse.json();
      expect(badBody.error).toMatch(/destination|trip_name|invalid input/i);
    } finally {
      await deleteTripForTest(request, createdTripId);
    }
  });

  test("mobile trip creation redirects to the trip wallet hub", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-trips-wallet-screen")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 20_000 }
    );

    const createPanel = page.getByTestId("mobile-create-another-trip").last();
    if ((await createPanel.count()) > 0) {
      const formCount = await createPanel.locator('[data-testid="mobile-trip-create-form"]:visible').count();
      if (!formCount) {
        await createPanel.getByRole("button", { name: /Create trip/ }).click();
      }
    }

    const form = page.locator('[data-testid="mobile-trip-create-form"]:visible').last();
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute("data-hydrated", "true");

    const tripName = `Mobile wallet trip ${Date.now()}`;
    await form.getByLabel("Trip name").fill(tripName);
    await form.getByLabel("Destination").fill("Miami, FL");
    await form.getByLabel("Start date").fill("2026-05-29");
    await form.getByLabel("End date").fill("2026-05-31");

    await expect(form.getByTestId("mobile-trip-create-sheet")).toContainText("Create Trip");
    await expect(form.getByTestId("mobile-trip-create-sheet")).toContainText(/May 29 - May 31|29 May - 31 May/);
    await form.getByRole("button", { name: "Create" }).last().click();
    await page.waitForURL(/\/dashboard\/trips\/[^/]+$/, { timeout: 45_000, waitUntil: "commit" });

    const tripId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
    expect(tripId).toBeTruthy();

    try {
      await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
      await expect(page.getByTestId("trip-pass-desktop-background")).toBeHidden();
      await expect(page.getByTestId("trip-compact-header")).toBeHidden();
      await expect(page.getByTestId("trip-section-menu")).toBeHidden();
      const mobileHub = page.getByTestId("trip-overview-page");
      await expect(mobileHub).toBeVisible();
      await expect(mobileHub.getByTestId("overview-small-pass")).toBeVisible({ timeout: 20_000 });
      await expect(mobileHub.getByTestId("overview-mobile-hero")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-quick-actions")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-itinerary-preview")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-documents-preview")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-spending-summary")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-small-primary-cta")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-small-primary-cta")).toContainText("New Activity");
      await expect(mobileHub.getByText("Invite Guests")).toHaveCount(0);
      await expect(mobileHub.getByText("Trip guests")).toBeHidden();
      await expect(mobileHub.getByRole("link", { name: "Open map" }).first()).toBeVisible();
      await expect(mobileHub.getByRole("link", { name: "Search trip activities" })).toBeVisible();
      await expect(mobileHub.getByTestId("overview-more-tools")).toBeHidden();
      const overviewOwnsLowerViewport = await page.evaluate(() => {
        const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 120);
        return Boolean(target?.closest('[data-testid="overview-small-sheet"]'));
      });
      expect(overviewOwnsLowerViewport, "mobile overview sheet should fill the lower viewport").toBe(true);
      await mobileHub.getByLabel("More trip options").click();
      await expect(mobileHub.getByRole("link", { name: "Expenses" }).first()).toBeVisible();
      await expect(page.getByLabel("Organizer actions")).toBeHidden();
      await expect(page.getByTestId("mobile-trip-overflow-menu")).toHaveCount(0);
      await expect(mobileHub.getByText("Email import coming soon")).toBeHidden();
      await expect(mobileHub.getByText("Currency")).toHaveCount(0);
      await expect(mobileHub.getByText("Notifications")).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "created mobile overview overflow").toBeLessThanOrEqual(1);
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("dashboard child routes do not reserve space for the removed bottom nav", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/plan`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-main")).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
    await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 15_000 });

    const spacing = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="app-shell-main"]');
      const mainPaddingBottom = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0;
      return { mainPaddingBottom };
    });

    expect(spacing.mainPaddingBottom).toBeLessThan(48);
  });

  test("mobile search renders compact dark activity and route results", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const suffix = Date.now();
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "New York City",
        name: `Mobile search trip ${suffix}`,
        status: "Planning",
        travel_style: "balanced"
      },
      headers: { "x-cypress-dashboard": "true" }
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    const tripId = tripPayload?.trip?.id;
    expect(typeof tripId).toBe("string");

    const flightNumber = `WS${String(suffix).slice(-6)}`;

    try {
      const segmentResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          kind: "flight",
          location: "Mobile search route",
          providerMetadata: {
            route: {
              carrier: "Almidy Air",
              departAt: "2026-09-09T11:18:00.000Z",
              destination: {
                label: `Search JFK ${suffix}`,
                lat: 40.6413,
                lng: -73.7781
              },
              flightNumber,
              mode: "flight",
              origin: {
                label: `Search LAX ${suffix}`,
                lat: 33.9416,
                lng: -118.4085
              }
            }
          },
          startTime: "2026-09-09T11:18:00.000Z",
          title: `Fallback flight ${suffix}`,
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/search?q=${encodeURIComponent(flightNumber)}`, {
        waitUntil: "commit"
      });
      await expect(page.getByTestId("search-page")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("app-shell-topbar")).toBeHidden();
      await expect(page.getByTestId("search-input")).toHaveAttribute(
        "placeholder",
        "Search saved activities and documents"
      );
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();

      const searchStyle = await page.getByTestId("search-page").evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color
        };
      });
      expect(searchStyle.backgroundColor).toBe("rgb(31, 31, 31)");
      expect(searchStyle.color).toBe("rgb(255, 255, 255)");

      const activityGroup = page.getByTestId("search-group-activity-results");
      await expect(activityGroup).toBeVisible();
      await expect(
        activityGroup.getByRole("link", {
          name: new RegExp(`Search LAX ${suffix}.*Search JFK ${suffix}`)
        })
      ).toBeVisible();
      await expect(activityGroup.getByText("Almidy Air")).toBeVisible();
      await expect(activityGroup.getByText(flightNumber)).toBeVisible();
      await expect(page.getByText("Terminal")).toHaveCount(0);
      await expect(page.getByText("Baggage")).toHaveCount(0);
      await expect(page.getByText("Aircraft")).toHaveCount(0);

      await page.goto(`${baseUrl}/dashboard/search?q=${encodeURIComponent(`no-result-${suffix}`)}`, {
        waitUntil: "commit"
      });
      await expect(page.getByTestId("search-input")).toHaveValue(`no-result-${suffix}`, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "No results found" })).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText("Try searching a place, activity, document, or trip.")
      ).toBeVisible();
      await expect(page.getByTestId("search-group-documents")).toHaveCount(0);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "mobile search overflow").toBeLessThanOrEqual(1);
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile search page autocompletes through the unified search API", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const searchRequests: string[] = [];
    await page.route("**/api/v1/search**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") || "";
      searchRequests.push(query);

      await route.fulfill({
        body: JSON.stringify({
          meta: {
            processing_time_ms: 9,
            total_results: 1
          },
          query,
          results: [
            {
              href: "/dashboard/trips/demo/documents",
              id: "document-demo",
              subtitle: "American Airlines - MIA",
              title: "Flight Confirmation.pdf",
              type: "document",
              updated_at: "2026-06-20T18:22:00Z"
            }
          ]
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.goto(`${baseUrl}/dashboard/search`, { waitUntil: "commit" });
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();
    await searchInput.fill("m");
    await page.waitForTimeout(420);
    expect(searchRequests, "one-character search page input stays below autocomplete threshold").toEqual([]);

    await searchInput.fill("mia");
    await expect.poll(() => searchRequests.length, { message: "search page autocomplete query fires" }).toBe(1);
    expect(searchRequests).toEqual(["mia"]);
    await expect(page.getByTestId("search-autocomplete-results")).toBeVisible();
    await expect(page.getByRole("option", { name: /Flight Confirmation\.pdf/ })).toBeVisible();
  });

  test("home launch uses the Apple globe before wallet actions", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("mobile-home-launch-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute(
      "data-map-system",
      "almidy-apple-map-system"
    );
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expect(page.getByTestId("earth-only-visual")).toHaveCount(0);
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe-texture")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    await expect(page.getByTestId("mobile-home-globe")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-image")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Trips" })).toHaveCount(1);
    const homeLaunchGlobe = page.getByTestId("mobile-home-launch-globe");
    await expect(homeLaunchGlobe.getByText("Almidy", { exact: true })).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Travel wallet")).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Continue trip")).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Create trip")).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Add idea")).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Search")).toHaveCount(0);
    await expect(homeLaunchGlobe.getByText("Review places")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-globe-controls")).toBeVisible();
    await expect(homeLaunchGlobe.getByRole("link")).toHaveCount(1);
    await expect(homeLaunchGlobe.getByRole("link", { name: "Open map" })).toHaveAttribute("href", "/dashboard/map");
    await expect(homeLaunchGlobe.getByRole("button", { name: "Use current location" })).toBeVisible();
    await expect(page.getByTestId("mobile-home-earth-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-ocean")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-continents")).toHaveCount(0);
    await expect(page.getByText("Scroll", { exact: true })).toHaveCount(0);

    const heroVisual = await page.getByTestId("almidy-launch-globe").evaluate((element) => {
      const style = window.getComputedStyle(element);
      const appleMap = element.querySelector<HTMLElement>('[data-map-renderer="apple-mapkit"]');

      return {
        appleRenderer: appleMap?.getAttribute("data-map-renderer") ?? "",
        mapSystem: element.getAttribute("data-map-system") ?? "",
        mode: element.getAttribute("data-hero-mode") ?? "",
        opacity: style.opacity
      };
    });
    expect(heroVisual.mode).toBe("apple-mapkit");
    expect(heroVisual.mapSystem).toBe("almidy-apple-map-system");
    expect(heroVisual.appleRenderer).toBe("apple-mapkit");
    expect(Number(heroVisual.opacity), "home launch hero opacity").toBeGreaterThan(0.9);
    const homeLaunchLayout = await page.evaluate(() => {
      const launch = document.querySelector('[data-testid="mobile-home-launch-globe"]')?.getBoundingClientRect();
      const content = document.querySelector('[data-testid="mobile-home-wallet-content"]')?.getBoundingClientRect();
      const stage = document.querySelector('[data-testid="mobile-home-wallet-stage"]')?.getBoundingClientRect();
      const heading = document
        .querySelector('[data-testid="mobile-home-wallet-content"] h1')
        ?.getBoundingClientRect();
      const actions = document.querySelector('[data-testid="mobile-home-actions"]')?.getBoundingClientRect();
      const compactActions = document.querySelector('[data-testid="mobile-home-compact-actions"]')?.getBoundingClientRect();
      const iosSheet = document.querySelector('[data-testid="ios-launch-sheet"]')?.getBoundingClientRect();
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]')?.getBoundingClientRect();
      const contentElement = document.querySelector('[data-testid="mobile-home-wallet-content"]');
      const contentStyle = contentElement ? window.getComputedStyle(contentElement) : null;
      const actionsElement = document.querySelector('[data-testid="mobile-home-actions"]');
      const actionsStyle = actionsElement ? window.getComputedStyle(actionsElement) : null;
      const stageElement = document.querySelector('[data-testid="mobile-home-wallet-stage"]');
      const stageStyle = stageElement ? window.getComputedStyle(stageElement) : null;

      return {
        actionsBorderTopWidth: actionsStyle?.borderTopWidth ?? "",
        actionsBottom: actions?.bottom ?? 0,
        actionsTop: actions?.top ?? 0,
        compactActionsBottom: compactActions?.bottom ?? 0,
        contentBorderTopWidth: contentStyle?.borderTopWidth ?? "",
        contentGap: Math.round((content?.top ?? 0) - (launch?.bottom ?? 0)),
        contentPaddingBottom: contentStyle?.paddingBottom ?? "",
        contentTop: content?.top ?? 0,
        headingGap: Math.round((heading?.top ?? 0) - (launch?.bottom ?? 0)),
        headingTop: heading?.top ?? 0,
        iosSheetBottom: iosSheet?.bottom ?? 0,
        iosSheetLeft: iosSheet?.left ?? 0,
        iosSheetRight: iosSheet?.right ?? 0,
        launchBottom: launch?.bottom ?? 0,
        launchHeight: launch?.height ?? 0,
        navTop: nav?.top ?? window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        stagePaddingBottom: stageStyle?.paddingBottom ?? "",
        stageTop: stage?.top ?? 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });
    expect(homeLaunchLayout.launchHeight, "home globe owns the full launch screen").toBeGreaterThanOrEqual(
      homeLaunchLayout.viewportHeight - 2
    );
    expect(homeLaunchLayout.contentTop, "bottom sheet starts over the lower globe").toBeGreaterThan(
      homeLaunchLayout.viewportHeight * 0.56
    );
    expect(homeLaunchLayout.headingTop, "wallet title sits inside the bottom sheet").toBeGreaterThan(
      homeLaunchLayout.contentTop
    );
    expect(homeLaunchLayout.contentBorderTopWidth, "home wallet has no hard divider").toBe("0px");
    expect(homeLaunchLayout.actionsBorderTopWidth, "home action form has no white outline").toBe("0px");
    expect(homeLaunchLayout.actionsTop, "wallet actions sit inside the sheet below the title").toBeGreaterThan(
      homeLaunchLayout.headingTop + 40
    );
    expect(homeLaunchLayout.compactActionsBottom, "compact launch actions are not clipped by the sheet").toBeLessThan(
      homeLaunchLayout.iosSheetBottom - 8
    );
    expect(homeLaunchLayout.iosSheetLeft, "collapsed sheet touches the left viewport edge").toBeLessThanOrEqual(1);
    expect(homeLaunchLayout.iosSheetRight, "collapsed sheet touches the right viewport edge").toBeGreaterThanOrEqual(
      homeLaunchLayout.viewportWidth - 1
    );
    expect(homeLaunchLayout.iosSheetBottom, "collapsed sheet is flush with the viewport bottom").toBeGreaterThanOrEqual(
      homeLaunchLayout.viewportHeight - 1
    );
    expect(homeLaunchLayout.actionsTop, "wallet actions begin before the bottom nav").toBeLessThan(
      homeLaunchLayout.navTop
    );
    expect(
      Number.parseFloat(homeLaunchLayout.stagePaddingBottom),
      "home stage relies on bottom anchoring instead of extra padding"
    ).toBe(0);
    expect(homeLaunchLayout.scrollHeight, "home page fits the launch screen without document scroll").toBeLessThanOrEqual(
      homeLaunchLayout.viewportHeight + 2
    );
    await expect(page.getByTestId("home-launch-page")).toBeHidden();
    await expect(page.getByTestId("home-smart-start")).toBeHidden();
    await expect(page.getByLabel("Where are you headed?")).toBeHidden();

    const launchSheet = page.getByTestId("mobile-home-wallet-content");
    await launchSheet.scrollIntoViewIfNeeded();
    await expect(launchSheet).toBeVisible();
    const contentReveal = await launchSheet.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        animationDelay: style.animationDelay,
        animationName: style.animationName,
        opacity: style.opacity,
        transform: style.transform
      };
    });
    expect(contentReveal.animationDelay, "home wallet sheet has no delayed reveal").toBe("0s");
    expect(contentReveal.animationName, "home wallet sheet has no reveal animation").toBe("none");
    expect(Number(contentReveal.opacity), "home wallet sheet is immediately visible").toBeGreaterThan(0.9);
    expect(contentReveal.transform, "home wallet sheet does not slide in after delay").toBe("none");
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("mobile-home-actions")).toBeVisible();
    await expect(page.getByTestId("mobile-home-compact-actions")).toBeVisible();
    await expect(page.getByTestId("ios-launch-sheet-expanded")).toBeHidden();
    await expect(launchSheet.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: "Open My Trips" })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: "Open settings" })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Continue trip|Create trip|My Almidy Book/ })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: /Search/ })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: /Add/ })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Travel Book/ })).toBeHidden();
    await expect(launchSheet.getByRole("link", { name: /Add idea/ })).toBeHidden();
    await expect(launchSheet.getByRole("link", { name: /Open map/ })).toBeHidden();
    await expect(page.getByTestId("mobile-home-globe-controls").getByRole("link", { name: "Open map" })).toHaveAttribute(
      "href",
      "/dashboard/map"
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    const initialHomeActionClearance = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const continueTrip = document
        .evaluate(
          '//a[contains(., "Continue trip") or contains(., "Create trip")]',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE
        )
        .singleNodeValue as HTMLElement | null;
      const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;

      return {
        continueBottom: continueTrip?.getBoundingClientRect().bottom ?? 0,
        navTop
      };
    });
    expect(
      initialHomeActionClearance.continueBottom,
      "Continue trip is fully visible before scrolling"
    ).toBeLessThan(initialHomeActionClearance.navTop - 8);
    await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
    await expect(page.getByText("First Plan Guide")).toHaveCount(0);
    await expect(page.getByText("Add, review, create.")).toHaveCount(0);
    await expect(page.getByText("Recent passes")).toHaveCount(0);
    await expect(page.getByText(/0 waiting to review/i)).toHaveCount(0);

    await page.getByTestId("ios-launch-sheet-handle").click();
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "expanded");
    await expect(page.getByTestId("ios-launch-sheet-expanded")).toBeVisible();
    await expect.poll(async () => {
      return page.getByTestId("ios-launch-sheet").evaluate((element) => {
        const rect = element.getBoundingClientRect();

        return Math.round(rect.height - window.innerHeight);
      });
    }, { message: "expanded trips sheet fills the viewport" }).toBeGreaterThanOrEqual(-2);
    const expandedSheetFrame = await page.getByTestId("ios-launch-sheet").evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        viewportWidth: window.innerWidth
      };
    });
    expect(expandedSheetFrame.top, "expanded trips sheet starts at the top of the viewport").toBeLessThanOrEqual(1);
    expect(expandedSheetFrame.left, "expanded trips sheet touches the left viewport edge").toBeLessThanOrEqual(1);
    expect(expandedSheetFrame.right, "expanded trips sheet touches the right viewport edge").toBeGreaterThanOrEqual(
      expandedSheetFrame.viewportWidth - 1
    );
    await expect(launchSheet.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(launchSheet.getByText("Upcoming")).toBeVisible();
    await expect(page.getByTestId("mobile-home-featured-trip")).toBeVisible();
    await expect(launchSheet.getByText("Explore all the Pro features")).toBeVisible();
    const acceptTrialButton = launchSheet.getByRole("button", { name: "Accept 15 Days Free" });
    await expect(acceptTrialButton).toBeVisible();
    await acceptTrialButton.click();
    await expect(page.getByRole("dialog").getByText("Trial activation coming soon")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Open account settings" })).toHaveAttribute(
      "href",
      "/dashboard/account"
    );
    await page.getByRole("button", { name: "Close trial availability" }).click();
    await launchSheet.getByRole("button", { name: "Dismiss pro card" }).click();
    await expect(launchSheet.getByText("Explore all the Pro features")).toHaveCount(0);
    await expect(launchSheet.getByText("Add Reservations via Email")).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: "Forward Your Reservation" })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Travel Book/ })).toBeVisible();
    await expect(page.getByTestId("mobile-home-plan-actions")).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Add idea/ })).toHaveAttribute(
      "href",
      "/dashboard/plan#saved-inspiration"
    );
    await expect(launchSheet.getByRole("link", { name: /Review places/ })).toHaveAttribute(
      "href",
      "/dashboard/plan#ai-review"
    );

    const actionNames = [
      /Continue trip|Create trip/,
      /Search/,
      /Travel Book/,
      /Add idea/,
      /Review places/,
      /Forward Your Reservation/,
      /Add/
    ];
    for (const actionName of actionNames) {
      const action = launchSheet.getByRole("link", { name: actionName }).first();
      if ((await action.count()) === 0) {
        continue;
      }
      await action.scrollIntoViewIfNeeded();
      const navClearance = await action.evaluate((element) => {
        const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
        const navRect = nav?.getBoundingClientRect();
        const actionRect = element.getBoundingClientRect();

        if (!navRect) {
          return {
            clearance: Number.POSITIVE_INFINITY,
            isCoveredByNav: false
          };
        }

        return {
          clearance: navRect.top - actionRect.bottom,
          isCoveredByNav: actionRect.bottom > navRect.top - 8 && actionRect.top < navRect.bottom
        };
      });
      expect(
        navClearance.isCoveredByNav,
        `mobile home action ${actionName} is not covered by bottom nav`
      ).toBe(false);
      expect(
        navClearance.clearance,
        `mobile home action ${actionName} keeps tap clearance above bottom nav`
      ).toBeGreaterThanOrEqual(12);
    }
    await launchSheet.getByRole("link", { name: /Forward Your Reservation/ }).scrollIntoViewIfNeeded();
    const finalActionScrollCushion = await launchSheet.getByRole("link", { name: /Forward Your Reservation/ }).evaluate((element) => {
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const navRect = nav?.getBoundingClientRect();
      const actionRect = element.getBoundingClientRect();

      return {
        clearance: (navRect?.top ?? window.innerHeight) - actionRect.bottom
      };
    });
    expect(
      finalActionScrollCushion.clearance,
      "Forward reservation can scroll clear of the fixed bottom nav"
    ).toBeGreaterThanOrEqual(12);
    await launchSheet.getByRole("button", { name: "Dismiss email automation card" }).click();
    await expect(launchSheet.getByTestId("mobile-home-email-card")).toHaveCount(0);
    await launchSheet.getByRole("button", { name: "Open settings" }).click();
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "settings");
    await expect(page.getByTestId("mobile-home-settings")).toBeVisible();
    await expect(launchSheet.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/dashboard/account"
    );
    await expect(launchSheet.getByText("Redeem 15 Days Free")).toBeVisible();
    await launchSheet.getByRole("button", { name: "Redeem 15 Days Free" }).click();
    await expect(page.getByRole("dialog").getByText("Trial activation coming soon")).toBeVisible();
    await page.getByRole("button", { name: "Close trial availability" }).click();
    await expect(launchSheet.getByRole("link", { name: "Add Reservations via Email" })).toHaveAttribute(
      "href",
      "/dashboard/imports#reservation-forwarding"
    );
    await expect(launchSheet.getByText("Currency")).toBeVisible();
    await expect(launchSheet.getByText("Need help?")).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    await expect(launchSheet.getByText("Soon").first()).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: "Force Sync" })).toBeDisabled();
    await expect(launchSheet.getByText("Sync is unavailable until connected services are enabled.")).toBeVisible();
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ height: 900, width });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `mobile home overflow at ${width}px`).toBeLessThanOrEqual(1);
    }

    await page.goto(`${baseUrl}/dashboard/plan`, { waitUntil: "commit" });
    await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Capture travel ideas" })).toBeVisible();
    await expect(page.getByText("Create a trip from saved ideas.")).toHaveCount(0);
    await expect(page.getByTestId("plan-workflow-stepper")).toHaveCount(1);
    const planStepper = page.getByTestId("plan-workflow-stepper");
    await expect(planStepper.getByText("Add", { exact: true })).toBeVisible();
    await expect(planStepper.getByText("Review", { exact: true })).toBeVisible();
    await expect(planStepper.getByText("Trip", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add an idea" })).toHaveCount(0);
    await expect(page.getByTestId("plan-capture-link")).toBeVisible();
    await expect(page.getByTestId("plan-capture-upload")).toBeVisible();
    await expect(page.getByTestId("plan-capture-note")).toBeVisible();
    await expect(page.getByRole("button", { name: /review idea/i })).toBeVisible();
    await expect(page.getByText("Optional trip context")).toBeHidden();
    await expect(page.getByText("Advanced sources")).toBeHidden();
    await expect(page.locator("details > summary", { hasText: "Review queue" })).toBeHidden();
    const planCardStyle = await page.locator("#saved-inspiration").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color
      };
    });
    expect(planCardStyle.backgroundColor).toBe("rgb(5, 5, 5)");
    expect(planCardStyle.color).toBe("rgb(255, 255, 255)");
  });

  test("mobile launch sheet tracks touch dragging and snaps open", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });

    const launchSheet = page.getByTestId("mobile-home-wallet-content");
    await expect(launchSheet).toBeVisible();
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "collapsed");

    const launchSheetHandle = page.getByTestId("ios-launch-sheet-handle");

    await launchSheetHandle.dispatchEvent("touchstart", {
      changedTouches: [{ clientY: 780, identifier: 1 }],
      touches: [{ clientY: 780, identifier: 1 }]
    });
    await launchSheetHandle.dispatchEvent("touchmove", {
      changedTouches: [{ clientY: 360, identifier: 1 }],
      touches: [{ clientY: 360, identifier: 1 }]
    });

    await expect(launchSheet).toHaveAttribute("data-touch-dragging", "true");
    await expect(launchSheet).toHaveClass(/is-dragging/);
    await expect.poll(async () => Number(await launchSheet.getAttribute("data-sheet-transform"))).toBeLessThan(35);

    await launchSheetHandle.dispatchEvent("touchend", {
      changedTouches: [{ clientY: 360, identifier: 1 }],
      touches: []
    });

    await expect(launchSheet).toHaveAttribute("data-sheet-state", "expanded");
    await expect(launchSheet).not.toHaveClass(/is-dragging/);
    await expect(launchSheet).not.toHaveAttribute("data-touch-dragging", "true");
  });

  test("mobile launch sheet content scrolls without dragging the whole sheet", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });

    const launchSheet = page.getByTestId("mobile-home-wallet-content");
    const launchSheetHandle = page.getByTestId("ios-launch-sheet-handle");
    await expect(launchSheet).toBeVisible();
    await launchSheetHandle.click();
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "expanded");

    const expandedContent = page.getByTestId("ios-launch-sheet-expanded");
    await expect(expandedContent).toBeVisible();
    await expandedContent.evaluate((element) => {
      element.scrollTop = 0;
    });

    const touchActions = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="mobile-home-wallet-content"]');
      const handle = document.querySelector('[data-testid="ios-launch-sheet-handle"]');

      return {
        handle: handle ? window.getComputedStyle(handle).touchAction : "",
        sheet: sheet ? window.getComputedStyle(sheet).touchAction : ""
      };
    });
    expect(touchActions.sheet, "expanded sheet content keeps native scrolling gestures").not.toBe("none");
    expect(touchActions.handle, "sheet drag remains scoped to the grab handle").toBe("none");

    const box = await expandedContent.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height - 24, 260));
      await page.mouse.wheel(0, 520);
    }

    await expect.poll(async () => {
      return expandedContent.evaluate((element) => element.scrollTop);
    }, { message: "expanded launch sheet content scrolls internally" }).toBeGreaterThan(0);
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "expanded");
    await expect(launchSheet).not.toHaveAttribute("data-touch-dragging", "true");
  });

  test("mobile launch sheet search opens in place and debounces API queries", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    const searchRequests: string[] = [];
    await page.route("**/api/v1/search**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") || "";
      searchRequests.push(query);

      await route.fulfill({
        body: JSON.stringify({
          meta: {
            processing_time_ms: 12,
            total_results: 1
          },
          query,
          results: [
            {
              href: "/dashboard/trips/demo",
              id: "trip-demo",
              subtitle: "Florida, United States",
              title: "Summer in Miami",
              type: "trip",
              updated_at: "2026-06-25T14:30:00Z"
            }
          ]
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });

    const launchSheet = page.getByTestId("mobile-home-wallet-content");
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "collapsed");
    await launchSheet.getByRole("button", { name: "Search" }).click();

    await expect(launchSheet).toHaveAttribute("data-sheet-state", "search");
    await expect(page.getByTestId("mobile-sheet-search")).toBeVisible();
    const searchInput = page.getByTestId("mobile-sheet-search-input");
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveAttribute("placeholder", "Search saved activities and documents");
    await expect(page.getByTestId("mobile-sheet-search-empty")).toBeVisible();

    await searchInput.fill("m");
    await page.waitForTimeout(420);
    expect(searchRequests, "one-character queries stay below the API threshold").toEqual([]);

    await searchInput.fill("mi");
    await expect.poll(() => searchRequests.length, { message: "debounced search API request fires" }).toBe(1);
    expect(searchRequests).toEqual(["mi"]);
    await expect(page.getByTestId("mobile-sheet-search-results")).toBeVisible();
    await expect(page.getByRole("option", { name: /Summer in Miami/ })).toBeVisible();

    await page.getByTestId("mobile-sheet-search-cancel").click();
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("mobile-sheet-search")).toHaveCount(0);
  });

  test("mobile home launch globe uses granted browser location for pin", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("almidy-launch-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-map-system", "almidy-apple-map-system");
    await expectNoHomeGoogleMapsCopy(page);
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("almidy-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe-texture")).toHaveCount(0);

    const appleGlobe = page.locator('[data-map-renderer="apple-mapkit"]').first();
    await expect(appleGlobe).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expect(page.getByTestId("almidy-google-maps-3d-host")).toHaveCount(0);
    await expect(page.getByTestId("mobile-current-location-pin")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
  });

  test("mobile launch globe is an interactive Apple MapKit surface", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    const launchGlobe = page.getByTestId("almidy-launch-globe");
    await expect(launchGlobe).toHaveAttribute("data-hero-mode", "apple-mapkit");
    const heroMode = await launchGlobe.getAttribute("data-hero-mode");
    expect(heroMode).toBe("apple-mapkit");
    const appleGlobe = page.locator('[data-map-renderer="apple-mapkit"]').first();
    await expect(appleGlobe).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByTestId("mobile-current-location-pin")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
  });

  test("dashboard and trips use the same shared user country pin data", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(tripsMap).toHaveAttribute("data-user-pin-latitude", "25.76170", { timeout: 5_000 });
    await expect(tripsMap).toHaveAttribute("data-user-pin-longitude", "-80.19180");
    await expect(tripsMap).toHaveAttribute("data-user-pin-country-code", "US");

    const tripsPin = await tripsMap.evaluate((element) => ({
      countryCode: element.getAttribute("data-user-pin-country-code"),
      latitude: element.getAttribute("data-user-pin-latitude"),
      longitude: element.getAttribute("data-user-pin-longitude")
    }));

    expect(tripsPin).toEqual({
      countryCode: "US",
      latitude: "25.76170",
      longitude: "-80.19180"
    });
  });

  test("mobile trips locate button updates shared map state", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page, { permission: "denied" });

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(tripsMap).toBeVisible({ timeout: 20_000 });
    await expect(tripsMap).not.toHaveAttribute("data-user-pin-latitude", "25.76170");

    await page.evaluate(() => {
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

    await page.getByRole("button", { name: "Locate trips" }).click();
    await expect(tripsMap).toHaveAttribute("data-user-pin-latitude", "25.76170", { timeout: 5_000 });
    await expect(tripsMap).toHaveAttribute("data-user-pin-longitude", "-80.19180");
    await expect(tripsMap).toHaveAttribute("data-camera-command", "focusUserLocation");
    await expect(tripsMap).toHaveAttribute("data-selected-map-id", "user-location");
  });

  test("mobile trips user pin remains tied to coordinates after zoom and pan gestures", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    const mapCanvas = page.getByTestId("mobile-country-map-canvas");
    await expect(tripsMap).toHaveAttribute("data-user-pin-latitude", "25.76170", { timeout: 5_000 });

    const beforeGesture = await tripsMap.evaluate((element) => ({
      latitude: element.getAttribute("data-user-pin-latitude"),
      longitude: element.getAttribute("data-user-pin-longitude")
    }));
    const canvasBox = await mapCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, -500);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 70, canvasBox.y + canvasBox.height / 2 + 40);
    await page.mouse.up();

    await expect(tripsMap).toHaveAttribute("data-user-pin-latitude", beforeGesture.latitude ?? "");
    await expect(tripsMap).toHaveAttribute("data-user-pin-longitude", beforeGesture.longitude ?? "");
  });

  test("mobile trips map switch preserves selected user location", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(tripsMap).toHaveAttribute("data-user-pin-latitude", "25.76170", { timeout: 5_000 });
    await page.getByRole("button", { name: "Locate trips" }).click();
    await expect(tripsMap).toHaveAttribute("data-selected-map-id", "user-location");

    await page.getByRole("link", { name: "Open trip list" }).click();
    await expect(page).toHaveURL(/\/dashboard\/trips\?view=list/);
    await page.goBack({ waitUntil: "commit" });

    const restoredTripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(restoredTripsMap).toHaveAttribute("data-user-pin-latitude", "25.76170", { timeout: 5_000 });
    await expect(restoredTripsMap).toHaveAttribute("data-user-pin-longitude", "-80.19180");
    await expect(restoredTripsMap).toHaveAttribute("data-user-pin-country-code", "US");
  });

  test("mobile map location keeps launch fallback off when geolocation is denied", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page, { permission: "denied" });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.locator('[data-map-renderer="apple-mapkit"]').first()).toBeVisible();
    await expect(page.getByTestId("earth-only-visual")).toHaveCount(0);
    await expect(page.getByTestId("almidy-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    await expect(page.getByText("Globe runtime unavailable")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(tripsMap).toBeVisible({ timeout: 20_000 });
    await expect(tripsMap).not.toHaveAttribute("data-user-pin-latitude", "25.76170");
    await expect(page.getByTestId("mobile-country-sheet")).toBeVisible();
  });

  test("Verify integration canvas matches premium full-bleed Apple Map specifications", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    const appleCanvas = page.locator('[data-map-system="almidy-apple-map-system"]').first();
    await expect(appleCanvas).toBeVisible();
  });

  test("Verify launch renders the Apple MapKit hybrid globe surface", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });

    await expect(page.getByTestId("apple-canvas-globe")).toHaveCount(0);
    await expect(page.locator("[data-globe-transition-state]")).toHaveCount(0);

    const appleMapContainer = page.locator('[data-map-system="almidy-apple-map-system"]').first();
    await expect(appleMapContainer).toBeVisible({ timeout: 30_000 });
    await expect(appleMapContainer).toHaveAttribute("data-map-renderer", "apple-mapkit");
    await expect(appleMapContainer).toHaveAttribute("data-map-presentation", "apple-globe");
    await expect(appleMapContainer.getByTestId("almidy-apple-globe-sphere")).toBeVisible();
    const mapKitCanvas = appleMapContainer.locator('[data-mapkit-mock="ready"]').first();
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-map-type", "hybrid");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-camera-distance", "10000000");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-has-region", "false");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-rotation-enabled", "true");
  });

  test("Apple globe falls back offline and recovers when connectivity returns", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      let online = false;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => online
      });
      (window as typeof window & { __setAlmidyOnline?: (value: boolean) => void }).__setAlmidyOnline = (value) => {
        online = value;
        window.dispatchEvent(new Event(value ? "online" : "offline"));
      };
    });
    await installMockAppleMapKit(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });

    const fallback = page.getByTestId("almidy-apple-map-fallback").first();
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(fallback).toHaveAttribute("data-map-runtime", "offline");
    await expect(fallback.getByRole("heading", { name: "You are offline" })).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & { __setAlmidyOnline?: (value: boolean) => void }).__setAlmidyOnline?.(true);
    });

    await expect(page.locator('[data-map-runtime="ready"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(fallback).toHaveCount(0);
  });

  test("Apple globe reports authorization errors and retries with a fresh token", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.locator('[data-map-runtime="ready"]').first()).toBeVisible({ timeout: 30_000 });

    const initialLifecycle = await page.evaluate(() => ({
      errorHandlers:
        (window as typeof window & { mapkit?: { __errorHandlerCount?: () => number } })
          .mapkit?.__errorHandlerCount?.() ?? 0,
      scripts: document.querySelectorAll("#almidy-apple-mapkit-js").length
    }));

    for (let retry = 0; retry < 2; retry += 1) {
      await page.evaluate(() => {
        (window as typeof window & { mapkit?: { __emitConfigurationError?: (status: string) => void } })
          .mapkit?.__emitConfigurationError?.("Unauthorized");
      });

      const fallback = page.getByTestId("almidy-apple-map-fallback").first();
      await expect(fallback).toHaveAttribute("data-map-runtime", "runtime-error");
      await expect(fallback).toContainText("authorization expired");
      await fallback.getByRole("button", { name: "Try again" }).click();

      await expect(page.locator('[data-map-runtime="ready"]').first()).toBeVisible({ timeout: 30_000 });
      await expect(fallback).toHaveCount(0);
    }

    await expect.poll(async () => page.evaluate(() => ({
      errorHandlers:
        (window as typeof window & { mapkit?: { __errorHandlerCount?: () => number } })
          .mapkit?.__errorHandlerCount?.() ?? 0,
      scripts: document.querySelectorAll("#almidy-apple-mapkit-js").length
    }))).toEqual(initialLifecycle);
  });

  test("native map sync updates wallet selection and globe camera while rejecting stale revisions", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    const mapKitCanvas = page.locator('[data-mapkit-mock="ready"]').first();
    await expect(mapKitCanvas).toBeVisible({ timeout: 30_000 });

    const dispatchPayload = async (revisionId: number, routeId: string, tripId: string, altitude: number) => {
      await page.evaluate(({ altitude, revisionId, routeId, tripId }) => {
        window.dispatchEvent(new CustomEvent("onNativeStateSync", {
          detail: {
            jsonString: JSON.stringify({
              revisionId,
              routeId,
              status: "active",
              trip: {
                tripId,
                origin: { lat: 37.7749, lng: -122.4194, name: "SF Transit Hub" },
                destination: { lat: 34.0522, lng: -118.2437, name: "LA Terminal" }
              },
              wallet: {
                passId: "pass_wallet_881",
                isPassInstalled: true,
                balance: "42.50",
                currency: "USD"
              },
              camera: {
                center: { lat: 36, lng: -120 },
                altitude,
                pitch: 0,
                heading: 0
              }
            })
          }
        }));
      }, { altitude, revisionId, routeId, tripId });
    };

    await dispatchPayload(1_714_312_800_000, "rte_9f82c4", "trp_alpha_01", 8_000_000);

    const walletShell = page.getByTestId("mobile-globe-wallet-shell");
    await expect(walletShell).toHaveAttribute("data-wallet-selected-route-id", "rte_9f82c4");
    await expect(walletShell).toHaveAttribute("data-wallet-selected-trip-id", "trp_alpha_01");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-pan-to", "36.00000,-120.00000");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-camera-distance", "8000000");

    await dispatchPayload(1_714_312_799_999, "rte_stale", "trp_stale", 2_000_000);
    await expect(walletShell).toHaveAttribute("data-wallet-selected-route-id", "rte_9f82c4");
    await expect(walletShell).toHaveAttribute("data-wallet-selected-trip-id", "trp_alpha_01");
    await expect(mapKitCanvas).toHaveAttribute("data-mapkit-camera-distance", "8000000");
  });

  test("Verify itinerary timeline workspace page fully replaces Google layers with Apple MapKit", async ({
    page,
    request
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "São Paulo, Brazil",
        name: `Timeline Apple MapKit regression ${Date.now()}`,
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
          kind: "activity",
          lat: -23.4356,
          lng: -46.4731,
          location: "São Paulo/Guarulhos-Governor André Franco Montoro International Airport",
          startTime: "2026-06-05T10:05:00.000Z",
          title: "São Paulo airport arrival",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline`, { waitUntil: "commit" });

      await expect(page.locator(".gm-style")).not.toBeAttached();
      const appleItineraryCanvas = page.locator('[data-map-system="almidy-apple-map-system"]').first();
      await expect(appleItineraryCanvas).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile home launch globe supports reduced motion without launch fallback", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ height: 900, width: 390 });
    await installMockAppleMapKit(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "zz" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["zz"] });
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function resolvedOptions() {
        return {
          ...originalResolvedOptions.call(this),
          timeZone: ""
        };
      };
      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: {
          query: () => Promise.resolve({ state: "denied" })
        }
      });
    });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("mobile-home-launch-globe")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toBeVisible();
    await expect(page.getByTestId("mobile-home-globe")).toHaveCount(0);
    await expect(page.getByTestId("earth-only-visual")).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-image")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-continents")).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.locator('[data-map-renderer="apple-mapkit"]').first()).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    await expect(page.getByText("Globe runtime unavailable")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    const reducedMotionContentReveal = await page.getByTestId("mobile-home-wallet-content").evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        opacity: style.opacity,
        transform: style.transform
      };
    });
    expect(Number(reducedMotionContentReveal.opacity), "reduced-motion Home content is immediate").toBeGreaterThan(
      0.9
    );
    expect(reducedMotionContentReveal.transform, "reduced-motion Home content does not animate").toBe("none");
    await page.getByTestId("mobile-home-wallet-content").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-actions")).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue trip|Create trip/ })).toBeVisible();

    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ height: 900, width });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `reduced-motion home overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });

  test("mobile home launch uses Apple MapKit when ready without fallback visible", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-map-system", "almidy-apple-map-system");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe-texture")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByTestId("almidy-launch-globe-diagnostic")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Trips" })).toHaveCount(1);
  });

  test("mobile launch does not mount native Google 3D error UI", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockAppleMapKit(page);
    await installMockMobileLocation(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-hero-mode", "apple-mapkit");
    await expect(page.getByTestId("almidy-launch-globe")).toHaveAttribute("data-launch-globe-state", "ready");
    await expect(page.getByTestId("earth-only-visual")).toHaveCount(0);
    await expect(page.getByTestId("almidy-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-photorealistic-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("almidy-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe")).toHaveCount(0);
    await expect(page.getByTestId("home-custom-globe-texture")).toHaveCount(0);
    await expect(page.getByTestId("almidy-google-maps-3d-globe")).toHaveCount(0);
    await expect(page.getByText("Globe runtime unavailable")).toHaveCount(0);
    await expect(page.getByText("GOOGLE-RUNTIME-FAILED")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
  });

  test("demo map exposes ordered route cards on mobile", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
      (window as typeof window & { __waylineGeoRequests?: number }).__waylineGeoRequests = 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success: (position: GeolocationPosition) => void) {
            const state = window as typeof window & { __waylineGeoRequests?: number };
            state.__waylineGeoRequests = (state.__waylineGeoRequests || 0) + 1;
            success({
              coords: {
                accuracy: 20,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: 41.3874,
                longitude: 2.1686,
                speed: null
              },
              timestamp: Date.now()
            } as GeolocationPosition);
          }
        }
      });
    });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });

    await expect(page.getByTestId("trip-pass-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-section-menu")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Trip tabs" })).toHaveCount(0);
    await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
    await expect(page.getByTestId("trip-map-compact-header")).toHaveCount(0);
    await expect(page.getByText("Trip pass")).toHaveCount(0);
    await expect(page.getByText("Current trip")).toHaveCount(0);
    await expect(page.getByTestId("connected-trip-map")).toBeVisible();
    await expect(page.locator('[data-map-bottom-sheet="true"]')).toBeVisible();
    await expect(page.getByText("1 of 4")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("google-maps-runtime-fallback")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /1 Barcelona-El Prat Airport/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 Fira Barcelona meeting/ })).toBeVisible();
    await expect(page.getByLabel("Map categories")).toHaveCount(0);
    await expect(page.getByText("Nearby Ideas", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Your route places appear here.")).toHaveCount(0);
    await expect(page.getByTestId("compact-route-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("map-route-list")).toBeVisible();

    const ideasLink = page.getByTestId("map-route-panel").getByRole("link", { name: "Open Ideas" });
    await expect(ideasLink).toHaveAttribute("href", "/dashboard/trips/demo/ideas");
    await page.goto(`${baseUrl}/dashboard/trips/demo/ideas`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-activities-view")).toBeVisible();
    const activityMap = page.getByTestId("mobile-activity-map");
    await expect(activityMap).toBeVisible();
    await expect(activityMap.locator(".gm-style")).toBeVisible({ timeout: 30_000 });
    const activityMapHeight = await activityMap.evaluate((node) => Math.round(node.getBoundingClientRect().height));
    expect(activityMapHeight, "mobile activity map height").toBeGreaterThanOrEqual(300);
    await expect(page.getByTestId("mobile-activities-sheet").getByRole("button", { name: /Places/ })).toBeVisible();
    await expect(page.getByTestId("mobile-activity-list")).toBeVisible();
    await expect(page.getByTestId("distance-sort-control")).toContainText("Sort by Distance");
    await expect(page.getByTestId("distance-anchor-selector")).toBeVisible();
    await expect(page.getByTestId("map-distance-ring-label")).toHaveCount(3, { timeout: 30_000 });
    expect(
      await page.evaluate(() => (window as typeof window & { __waylineGeoRequests?: number }).__waylineGeoRequests || 0),
      "current location should not be requested until the user chooses it"
    ).toBe(0);

    const sortedRows = page.getByTestId("mobile-activity-list").locator("article");
    await expect(sortedRows.filter({ hasText: /\d+(?:\.\d+)?\s(?:mi|km)/ }).first()).toBeVisible();

    await page.getByTestId("distance-anchor-selector").click();
    await expect(page.getByTestId("distance-anchor-picker")).toBeVisible();
    await expect(page.getByTestId("distance-anchor-option").first()).toBeVisible();
    await page.getByTestId("distance-current-location").click();
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __waylineGeoRequests?: number }).__waylineGeoRequests || 0))
      .toBe(1);
    await expect(sortedRows.first()).toContainText(/\d+(?:\.\d+)?\s(?:mi|km)/);

    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ height: 900, width });
      await expect(page.getByTestId("mobile-activities-view")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `ideas page horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ height: 900, width: 390 });

    const activityFilters = page.getByTestId("activity-category-filters");
    if ((await activityFilters.count()) > 0) {
      await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
      await activityFilters.getByRole("button", { name: "Food" }).click();
      await expect(activityFilters.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true");
      await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    }
    const teamDinnerRow = page.getByTestId("mobile-activity-list").locator("article", {
      hasText: "Team dinner in El Born"
    });
    await expect(teamDinnerRow).toBeVisible();
    await teamDinnerRow.getByRole("button", { name: /Details for Team dinner in El Born/ }).click();
    await expect(page.getByTestId("activity-detail-sheet")).toBeVisible();
    await expect(page.getByTestId("activity-detail-map")).toBeVisible();
    await expect(page.getByTestId("activity-detail-map").locator(".gm-style")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("activity-detail-sheet").getByRole("link", { name: "Directions" })).toBeVisible();
    await expect(page.getByTestId("activity-detail-panel").getByText("Team dinner in El Born")).toBeVisible();
    await expect(page.getByTestId("activity-detail-panel").getByText("Save this idea to schedule it")).toHaveCount(0);
    await expect(page.getByTestId("activity-detail-panel").getByText("After it is on your trip")).toHaveCount(0);
    await expect(page.getByTestId("activity-detail-panel").getByText("Date / Time")).toHaveCount(0);
    await expect(page.getByTestId("activity-detail-panel").getByRole("button", { name: "More" })).toBeVisible();
    await page.getByTestId("activity-detail-panel").getByRole("button", { name: "More" }).click();
    await expect(page.getByTestId("activity-detail-panel").getByRole("link", { name: "Edit in itinerary" })).toBeVisible();
    await expect(page.getByTestId("activity-detail-panel").getByRole("button", { name: "Display address" })).toBeVisible();
    await page.getByTestId("activity-detail-panel").getByRole("button", { name: "Display address" }).click();
    await expect(page.getByTestId("display-address-sheet")).toBeVisible();
    await expect(page.getByTestId("display-address-title")).toContainText("Team dinner in El Born");
    await expect(page.getByTestId("display-address-text")).toContainText(/El Born|Barcelona/);
    await expect(page.getByTestId("display-address-speak")).toBeVisible();
    await expect(page.getByTestId("display-address-translate")).toBeVisible();
    await expect(page.getByTestId("display-address-map")).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
    await page.getByRole("button", { name: "Close display address" }).click();
    await expect(page.getByTestId("display-address-sheet")).toHaveCount(0);
    const detailPanelOwnsFooterZone = await page.evaluate(() => {
      const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 120);
      return Boolean(target?.closest('[data-testid="activity-detail-panel"]'));
    });
    expect(detailPanelOwnsFooterZone, "activity detail panel should own the lower mobile viewport").toBe(true);
    await page.getByTestId("activity-detail-panel").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(page.getByTestId("activity-detail-panel").getByText(/Open in itinerary|Save to trip/)).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);
    await page.getByRole("button", { name: "Close activity detail" }).click();
    await expect(page.getByTestId("activity-detail-sheet")).toHaveCount(0);
  });

  test("mobile map route uses Almidy fallback when Google Maps auth fails", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(page.getByTestId("connected-trip-map")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("map-route-panel")).toBeVisible();

    if (await page.getByTestId("google-maps-runtime-fallback").count() === 0) {
      await page.waitForFunction(
        () => typeof (window as typeof window & { gm_authFailure?: () => void }).gm_authFailure === "function",
        undefined,
        { timeout: 15_000 }
      );
      await page.evaluate(() => {
        (window as typeof window & { gm_authFailure?: () => void }).gm_authFailure?.();
      });
    }

    await expect(page.getByTestId("google-maps-runtime-fallback")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Maps are temporarily unavailable. Your itinerary is still available below.")).toBeVisible();
    await expect(page.getByText("1 of 4")).toBeVisible();
    const fallbackMessageBottom = await page.getByTestId("google-maps-runtime-message").evaluate((node) => {
      return node.getBoundingClientRect().bottom;
    });
    const routeSheetTop = await page.getByTestId("map-route-panel").evaluate((node) => {
      return node.getBoundingClientRect().top;
    });
    expect(fallbackMessageBottom, "map fallback copy should stay above the route sheet").toBeLessThan(routeSheetTop);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Oops! Something went wrong.");
    expect(bodyText).not.toContain("This page didn't load Google Maps correctly.");
    expect(bodyText).not.toContain("This page didn\u2019t load Google Maps correctly.");
  });

  test("Verify itemized expense rows render contextually within the active segment sheet view", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    let ledgerRequests = 0;
    await page.route(/\/api\/v1\/segments\/[^/]+\/expenses$/, async (route) => {
      ledgerRequests += 1;
      await route.fulfill({
        body: JSON.stringify({
          expenses: [
            {
              amount: "35.00",
              category: "transport",
              id: "expense-baggage-fee",
              title: "Baggage Fee"
            },
            {
              amount: "15.00",
              category: "transport",
              id: "expense-flight-wifi",
              title: "In-flight Wi-Fi"
            }
          ],
          segment_id: route.request().url().split("/segments/")[1]?.split("/expenses")[0] || "segment",
          success: true,
          total_cents: 5000,
          total_formatted: "50.00"
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(page.getByTestId("map-selected-route-card")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("map-selected-route-card").getByRole("button", { name: "Details" }).click();

    const detailPanel = page.getByTestId("activity-detail-panel");
    await expect(page.getByTestId("activity-detail-sheet")).toBeVisible();
    await expect.poll(() => ledgerRequests).toBeGreaterThan(0);
    await expect(detailPanel.getByText("Segment Costs")).toBeVisible();
    await expect(detailPanel.getByText("Baggage Fee")).toBeVisible();
    await expect(detailPanel.getByText("$35.00")).toBeVisible();
  });

  test("mobile map keeps day filters inside the route sheet", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Mobile map filter test ${Date.now()}`,
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
      for (const segment of [
        {
          lat: 25.7959,
          lng: -80.287,
          startTime: "2026-06-10T17:14:00.000Z",
          title: "Airport arrival"
        },
        {
          lat: 25.7617,
          lng: -80.1918,
          startTime: "2026-06-11T11:00:00.000Z",
          title: "Brickell cafe"
        }
      ]) {
        const response = await request.post(`${baseUrl}/api/trip-segments`, {
          data: {
            kind: "activity",
            location: segment.title,
            tripId,
            ...segment
          },
          headers: { "x-cypress-dashboard": "true" }
        });
        expect(response.status()).toBe(201);
      }

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });
      await expect(page.getByTestId("connected-trip-map")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-map-system="almidy-apple-map-system"]').first()).toBeVisible();
      const routePanel = page.getByTestId("map-route-panel");
      await expect(routePanel).toHaveAttribute("data-sheet-state", "collapsed");
      await routePanel.getByRole("button", { name: "Expand route timeline sheet" }).click();
      await expect(routePanel).toHaveAttribute("data-sheet-state", "expanded");
      await expect(page.getByTestId("map-day-filter-overlay")).toBeHidden();
      const mobileFilter = page.getByTestId("map-mobile-day-filter");
      await expect(mobileFilter).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "All" })).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "Jun 10" })).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "Jun 11" })).toBeVisible();
      await expect(routePanel.getByText("1 of 1")).toBeVisible();
      const mapPanelFitsViewport = await routePanel.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= -1 && box.right <= window.innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1;
      });
      expect(mapPanelFitsViewport, "mobile map route panel should fit the viewport").toBe(true);
      const selectedCardFitsPanel = await page.getByTestId("map-selected-route-card").evaluate((node) => {
        const card = node.getBoundingClientRect();
        const panel = node.closest('[data-testid="map-route-panel"]')?.getBoundingClientRect();
        return Boolean(panel && card.left >= panel.left - 1 && card.right <= panel.right + 1);
      });
      expect(selectedCardFitsPanel, "selected route card should not overflow the mobile sheet").toBe(true);
      const mapPanelOwnsLowerViewport = await page.evaluate(() => {
        const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 120);
        return Boolean(target?.closest('[data-testid="map-route-panel"]'));
      });
      expect(mapPanelOwnsLowerViewport, "mobile map route panel should fill the lower viewport").toBe(true);
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("map automatically fits bounds for international long-distance flight segments", async ({
    page,
    request
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "São Paulo, Brazil",
        name: `Long distance map bounds test ${Date.now()}`,
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
      const route = {
        arriveAt: "2026-06-05T10:05:00.000Z",
        carrier: "LATAM",
        confirmation: "MIA-GRU-TEST",
        departAt: "2026-06-05T05:00:00.000Z",
        destination: {
          address: "Rod. Hélio Smidt, s/nº - Cumbica, Guarulhos - SP, Brazil",
          code: "GRU",
          label: "São Paulo/Guarulhos-Governor André Franco Montoro International Airport",
          lat: -23.4356,
          lng: -46.4731
        },
        flightNumber: "LA8195",
        mode: "flight",
        origin: {
          address: "2100 NW 42nd Ave, Miami, FL 33142",
          code: "MIA",
          label: "Miami International Airport",
          lat: 25.7959,
          lng: -80.287
        }
      };

      const segmentResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          endTime: route.arriveAt,
          kind: "flight",
          lat: route.origin.lat,
          lng: route.origin.lng,
          location: "Miami International Airport to São Paulo/Guarulhos-Governor André Franco Montoro International Airport",
          provider: "google_places",
          providerMetadata: {
            route
          },
          startTime: route.departAt,
          title: "Miami to São Paulo",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });

      const mapContainer = page.locator('[data-map-system="almidy-apple-map-system"]').first();
      await expect(mapContainer).toBeVisible({ timeout: 30_000 });
      const selectedRouteCard = page.getByTestId("map-selected-route-card");
      await expect(selectedRouteCard).toContainText(/Miami International Airport to São Paulo/, {
        timeout: 30_000
      });

      const isMapLayerRendered = await mapContainer.evaluate((el) => el.childElementCount > 0);
      expect(isMapLayerRendered).toBeTruthy();
      await expect(selectedRouteCard).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile itinerary panel expands and opens add item form without overlap", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Mobile itinerary form test ${Date.now()}`,
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
          kind: "activity",
          lat: 25.7617,
          lng: -80.1918,
          location: "Wynwood Walls",
          startTime: "2026-06-11T11:00:00.000Z",
          title: "Wynwood Walls",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });
      const routePanel = page.getByTestId("map-route-panel");
      await expect(routePanel).toBeVisible({ timeout: 30_000 });
      await expect(routePanel).toHaveAttribute("data-sheet-state", "collapsed");

      await routePanel.getByRole("button", { name: "Expand route timeline sheet" }).click();
      await expect(routePanel).toHaveAttribute("data-sheet-state", "expanded");

      await routePanel.getByRole("link", { name: "Add trip item" }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/trips/${tripId}/timeline#new-plan`));

      const mobileAddPanel = page.locator("#new-plan");
      await expect(mobileAddPanel).toBeVisible();
      const summary = mobileAddPanel.locator("summary", { hasText: "Add trip item" });
      await expect(summary).toBeVisible();
      await summary.click();

      await expect(summary).not.toBeVisible();
      const addForm = mobileAddPanel.getByTestId("mobile-add-trip-item-form");
      await expect(addForm).toBeVisible();
      await expect(addForm.getByPlaceholder("Wynwood Walls")).toBeVisible();
      await expect(addForm.getByPlaceholder("Search Google Places...")).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("itinerary reservation fields adapt when the item type changes", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Reservation fields test ${Date.now()}`,
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
      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline#new-plan`, { waitUntil: "commit" });

      const mobileAddPanel = page.locator("#new-plan");
      await expect(mobileAddPanel).toBeVisible({ timeout: 30_000 });
      const summary = mobileAddPanel.locator("summary", { hasText: "Add trip item" });
      await expect(summary).toBeVisible();
      await summary.click();

      const addForm = mobileAddPanel.getByTestId("mobile-add-trip-item-form");
      await expect(addForm).toBeVisible();

      const typeDropdown = addForm.getByLabel("Reservation type");
      await expect(typeDropdown).toBeVisible();

      await typeDropdown.selectOption("restaurant");
      await expect(addForm.getByText("dining", { exact: true })).toBeVisible();
      await expect(addForm.getByText("Restaurant name")).toBeVisible();
      await expect(addForm.getByText("Confirmation / booking code")).toBeVisible();
      await expect(addForm.getByText("Flight number")).not.toBeVisible();

      await typeDropdown.selectOption("flight");
      await expect(addForm.getByText("flight", { exact: true })).toBeVisible();
      await expect(addForm.getByText("Airline carrier")).toBeVisible();
      await expect(addForm.getByText("Flight number")).toBeVisible();
      await expect(addForm.getByText("From")).toBeVisible();
      await expect(addForm.getByText("To")).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile map surfaces unresolved segments and deep-links to edit location", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Unresolved segment test ${Date.now()}`,
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
      const mappedResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          kind: "restaurant",
          lat: 25.7617,
          lng: -80.1918,
          location: "Brickell, Miami, FL",
          startTime: "2026-06-12T19:00:00.000Z",
          title: "Brickell dinner",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(mappedResponse.status()).toBe(201);

      const unresolvedResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          kind: "place",
          location: "Needs mapped place",
          locationStatus: "manual_location_required",
          title: "Pending address stop",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(unresolvedResponse.status()).toBe(201);
      const unresolvedPayload = await unresolvedResponse.json();
      const unresolvedSegmentId = unresolvedPayload?.data?.segment?.id;
      expect(typeof unresolvedSegmentId).toBe("string");

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });
      const routePanel = page.getByTestId("map-route-panel");
      await expect(routePanel).toBeVisible({ timeout: 30_000 });
      await expect(routePanel.getByTestId("map-unresolved-location-summary")).toBeVisible();
      await expect(routePanel.getByTestId("map-unresolved-location-card")).toContainText("Pending address stop");
      await expect(routePanel.getByText("They stay off the route until a mapped place is selected.")).toBeVisible();

      await routePanel.getByTestId("map-unresolved-location-card").getByRole("link", { name: "Edit" }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/trips/${tripId}/timeline#${unresolvedSegmentId}`));
      const unresolvedItem = page.locator(`[id="${unresolvedSegmentId}"]`).first();
      const editForm = unresolvedItem.getByTestId("mobile-edit-trip-item-form");
      await expect(editForm).toBeVisible({ timeout: 20_000 });
      const formInputValues = await editForm.locator("input").evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value)
      );
      expect(formInputValues).toContain("Pending address stop");
      await expect(unresolvedItem.getByText("Select a suggested place to map this.")).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("map itinerary action opens the map-aware itinerary sheet", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });

    const mapPanel = page.getByTestId("map-route-panel");
    await expect(mapPanel).toBeVisible({ timeout: 30_000 });
    const itineraryLink = mapPanel.getByRole("link", { exact: true, name: "Itinerary" }).first();
    await expect(itineraryLink).toHaveAttribute("href", /\/timeline\?mode=map#/);

    await itineraryLink.click();
    await expect(page).toHaveURL(/\/dashboard\/trips\/demo\/timeline\?mode=map#/);
    const mapAwareItinerary = page.getByTestId("itinerary-map-aware-mode");
    await expect(mapAwareItinerary).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-compact-header")).toBeHidden();
    await expect(page.getByTestId("trip-section-menu")).toBeHidden();
    await expect(page.getByTestId("trip-pass-desktop-background")).toBeHidden();
    await expect(page.getByLabel(/route preview/i)).toBeVisible();
    await expect(mapAwareItinerary.getByTestId("mobile-real-map-preview")).toBeVisible();
    await expect(mapAwareItinerary.getByTestId("mobile-real-map-preview")).toHaveAttribute("data-map-theme", "dark");
    await expect(mapAwareItinerary.getByTestId("itinerary-date-strip")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Itinerary quick actions" })).toBeVisible();
    await expect(page.locator("details#new-plan")).toBeVisible();
    await mapAwareItinerary.getByLabel("More itinerary options").click();
    await expect(mapAwareItinerary.getByRole("link", { name: "Documents" })).toBeVisible();
    await mapAwareItinerary.getByTestId("map-aware-sheet-scroll").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    const bottomSheetOwnsLowerViewport = await page.evaluate(() => {
      const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 120);
      return Boolean(target?.closest('[data-testid="map-aware-sheet"]'));
    });
    expect(bottomSheetOwnsLowerViewport, "map-aware sheet should cover lower viewport").toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "map-aware itinerary overflow").toBeLessThanOrEqual(1);
  });

  test("mobile itinerary tab uses the same map-backed sheet", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips/demo/timeline`, { waitUntil: "commit" });

    const itinerary = page.getByTestId("itinerary-map-aware-mode");
    await expect(itinerary).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-compact-header")).toBeHidden();
    await expect(page.getByTestId("trip-section-menu")).toBeHidden();
    await expect(page.getByTestId("trip-pass-desktop-background")).toBeHidden();
    await expect(itinerary.getByTestId("mobile-real-map-preview")).toBeVisible();
    await expect(itinerary.getByTestId("mobile-real-map-preview")).toHaveAttribute("data-map-theme", "dark");
    await expect(itinerary.getByTestId("map-aware-sheet")).toBeVisible();
    await expect(itinerary.getByTestId("map-aware-sheet")).toHaveAttribute("data-sheet-state", "collapsed");
    await itinerary.getByRole("button", { name: "Expand itinerary sheet" }).click();
    await expect(itinerary.getByTestId("map-aware-sheet")).toHaveAttribute("data-sheet-state", "expanded");
    await expect(itinerary.getByTestId("itinerary-date-strip")).toBeVisible();
    await expect(page.locator("details#new-plan")).toBeVisible();
    const mobileNewPlan = itinerary.locator("details#new-plan");
    await mobileNewPlan.locator("> summary").click();
    await expect(mobileNewPlan.getByTestId("mobile-add-trip-item-form")).toBeVisible();
    await expect(mobileNewPlan.locator("> div")).not.toHaveClass(/bg-white/);
    await expect(page.getByRole("navigation", { name: "Itinerary quick actions" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "mobile itinerary tab overflow").toBeLessThanOrEqual(1);
  });

  test("mobile overview owns the trip pass without shell chrome", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Hero photo test ${Date.now()}`,
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
          providerMetadata: {
            imageAlt: "Photo of Wynwood Walls",
            imageAttribution: "Almidy test photo",
            primaryPhotoReference: "A".repeat(32)
          },
          title: "Wynwood Walls",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}`, { waitUntil: "commit" });
      await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
      await expect(page.getByTestId("overview-small-pass")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("trip-pass-desktop-background")).toBeHidden();
      await expect(page.getByTestId("trip-compact-header")).toBeHidden();
      await expect(page.getByTestId("trip-section-menu")).toBeHidden();
      await expect(page.getByTestId("overview-mobile-hero")).toBeVisible();
      await expect(page.getByTestId("overview-quick-actions")).toBeVisible();
      await expect(page.getByTestId("overview-itinerary-preview")).toBeVisible();
      await expect(page.getByTestId("overview-documents-preview")).toBeVisible();
      await expect(page.getByTestId("overview-spending-summary")).toBeVisible();
      await expect(page.getByTestId("overview-small-pass")).toContainText(tripPayload.trip.name);
      const overviewOwnsLowerViewport = await page.evaluate(() => {
        const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 120);
        return Boolean(target?.closest('[data-testid="trip-overview-page"]'));
      });
      expect(overviewOwnsLowerViewport, "mobile overview should own the lower viewport").toBe(true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "mobile overview overflow").toBeLessThanOrEqual(1);
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile overview surfaces real flight info and opens route detail", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "New York City",
        name: `Flight info test ${Date.now()}`,
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
      const route = {
        arriveAt: "2026-09-09T15:55:00.000Z",
        carrier: "Virgin Atlantic",
        confirmation: "DL979-TEST",
        departAt: "2026-09-09T07:18:00.000Z",
        destination: {
          address: "Terminal 4 Gate B34",
          code: "JFK",
          label: "JFK",
          lat: 40.6413,
          lng: -73.7781
        },
        flightNumber: "DL979",
        mode: "flight",
        origin: {
          address: "Terminal 3 Gate 34",
          code: "LAX",
          label: "LAX",
          lat: 33.9416,
          lng: -118.4085
        }
      };

      const segmentResponse = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          endTime: route.arriveAt,
          kind: "flight",
          lat: 33.9416,
          lng: -118.4085,
          location: "Los Angeles International Airport to John F Kennedy International Airport",
          provider: "google_places",
          providerMetadata: {
            aircraft: "B764",
            baggageClaim: "T4",
            route,
            timezoneDifference: "+3 hr"
          },
          startTime: route.departAt,
          title: "LAX to JFK",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}`, { waitUntil: "commit" });
      const flightCard = page.getByTestId("overview-flight-card");
      await expect(flightCard).toBeVisible({ timeout: 20_000 });
      await expect(flightCard).toContainText("Flight");
      await expect(flightCard).toContainText("LAX");
      await expect(flightCard).toContainText("JFK");
      await expect(flightCard).toContainText("Virgin Atlantic DL979");
      await expect(flightCard).toContainText("7:18 AM");
      await expect(flightCard).toContainText("3:55 PM");

      await flightCard.click();
      const detail = page.getByTestId("activity-detail-sheet");
      await expect(detail).toBeVisible();
      await expect(detail).toContainText("LAX to JFK");
      await expect(detail).toContainText("LAX");
      await expect(detail).toContainText("JFK");
      await expect(detail).toContainText("Flight Duration");
      await expect(detail).toContainText("8h 37m");
      await expect(detail).toContainText("Timezone Difference");
      await expect(detail).toContainText("+3 hr");
      await expect(detail).toContainText("Distance");
      await expect(detail).toContainText("Virgin Atlantic");
      await expect(detail).toContainText("B764");
      await expect(detail).toContainText("T4");
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("mobile trip component pages use compact dark sheets", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard/trips/demo/documents`, { waitUntil: "commit" });
    await expect(page.getByTestId("trip-documents-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-compact-header")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Trip tabs" })).toBeHidden();
    await expect(page.getByTestId("trip-documents-page").getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByTestId("trip-documents-page")).toContainText("No documents yet");
    await expect(page.getByTestId("trip-documents-page")).toContainText("What belongs here");
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "mobile documents overflow").toBeLessThanOrEqual(1);

    await page.goto(`${baseUrl}/dashboard/trips/demo/budget`, { waitUntil: "commit" });
    await expect(page.getByTestId("trip-budget-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-compact-header")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Trip tabs" })).toBeHidden();
    await expect(page.getByTestId("trip-budget-page").getByRole("heading", { name: "My Spending" })).toBeVisible();
    await expect(page.getByTestId("trip-budget-page").getByText("Total").last()).toBeVisible();
    await expect(page.getByTestId("trip-budget-page")).toContainText("$3,651.00");
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Bar & Party" })).toBeVisible();
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Flight" })).toBeVisible();
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Lodging" })).toBeVisible();
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Restaurant" })).toBeVisible();
    await page.getByTestId("mobile-spending-total").scrollIntoViewIfNeeded();
    const spendingClearance = await page.getByTestId("mobile-spending-total").evaluate((element) => {
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const navRect = nav?.getBoundingClientRect();
      const totalRect = element.getBoundingClientRect();
      return {
        clearance: (navRect?.top ?? window.innerHeight) - totalRect.bottom,
        covered: Boolean(navRect && totalRect.bottom > navRect.top - 8 && totalRect.top < navRect.bottom)
      };
    });
    expect(spendingClearance.covered, "mobile spending total is not covered by bottom nav").toBe(false);
    expect(spendingClearance.clearance, "mobile spending total keeps tap clearance above bottom nav").toBeGreaterThanOrEqual(8);
    await page.getByTestId("trip-budget-page").getByTestId("mobile-add-expense-button").click();
    await expect(page.getByTestId("mobile-expense-amount-sheet")).toBeVisible();
    await expect(page.getByTestId("mobile-expense-amount-sheet").getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(page.getByTestId("mobile-expense-amount-sheet").getByRole("button", { name: "Backspace amount" })).toBeVisible();
    await page.getByTestId("mobile-expense-amount-sheet").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("mobile-expense-amount-sheet")).toHaveCount(0);
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "mobile spending overflow").toBeLessThanOrEqual(1);
  });

  test("itinerary cards use compact action buttons and editable mapped locations", async ({
    page,
    request
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Itinerary action test ${Date.now()}`,
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
          kind: "activity",
          lat: 25.7906,
          lng: -80.13,
          location: "1 Washington Ave, Miami Beach, FL 33139",
          title: "South Pointe Park",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline`, { waitUntil: "commit" });
      const content = page.getByTestId("app-shell-content");
      await expect(content.getByRole("link", { name: /View South Pointe Park on map/ })).toBeVisible({ timeout: 60_000 });
      await expect(content.getByRole("button", { name: /Edit South Pointe Park/ })).toBeVisible({ timeout: 60_000 });
      await expect(content.getByRole("link", { name: "View on map" })).toHaveCount(0);
      await expect(content.getByText("View on map", { exact: true })).toHaveCount(0);

      const card = content.locator("article").filter({
        has: page.getByRole("heading", { name: "South Pointe Park" })
      });
      await expect(card.getByRole("button", { name: /Edit South Pointe Park/ })).toBeEnabled({ timeout: 60_000 });
      await card.getByRole("button", { name: /Edit South Pointe Park/ }).click();
      await expect(card.getByLabel("Stop location")).toBeVisible();
      await expect(card.getByLabel("Date", { exact: true })).toBeVisible();
      await expect(card.getByLabel("Start time")).toBeVisible();
      await expect(content.getByRole("button", { name: "Save changes" })).toBeEnabled();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("timeline geocoded extraction renders place names and external routing choices", async ({
    page,
    request
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Geocoded extraction test ${Date.now()}`,
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
          kind: "activity",
          lat: 25.7599,
          lng: -80.1919,
          location: "1441 Brickell Ave #4, Miami, FL 33131",
          provider: "google_places",
          providerMetadata: {
            address: "1441 Brickell Ave #4, Miami, FL 33131",
            formattedAddress: "1441 Brickell Ave #4, Miami, FL 33131",
            formatted_address: "1441 Brickell Ave #4, Miami, FL 33131",
            name: "Equinox Brickell",
            provider: "google_places",
            providerPlaceId: "test-equinox-brickell"
          },
          title: "Workout",
          tripId
        },
        headers: { "x-cypress-dashboard": "true" }
      });
      expect(segmentResponse.status()).toBe(201);

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline`, { waitUntil: "commit" });
      const content = page.getByTestId("app-shell-content");
      const placeMetadata = content.getByTestId("timeline-place-metadata").first();

      await expect(placeMetadata).toContainText("Equinox Brickell", { timeout: 60_000 });
      await expect(placeMetadata).toContainText("1441 Brickell Ave");
      await expect(content.getByRole("link", { name: /View Equinox Brickell on map/ })).toBeVisible();

      const optionsButton = content.getByTitle("Open in external maps application").first();
      await expect(optionsButton).toBeVisible();
      await optionsButton.click();

      const menu = content.getByTestId("external-map-menu").first();
      await expect(menu.getByRole("link", { name: /Open in Google Maps/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Open in Apple Maps/ })).toBeVisible();
      await expect(menu.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute(
        "href",
        /google\.com\/maps\/search/
      );
      await expect(menu.getByRole("link", { name: /Open in Apple Maps/ })).toHaveAttribute(
        "href",
        /maps\.apple\.com/
      );
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });

  test("demo itinerary uses compact square place photos on mobile", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips/demo/timeline`, { waitUntil: "commit" });

    const photos = page
      .getByTestId("app-shell-content")
      .locator("article")
      .getByTestId("place-photo");
    await expect(photos.first()).toBeVisible({ timeout: 60_000 });

    const boxes = await photos.evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            height: box.height,
            visible: box.width > 0 && box.height > 0,
            width: box.width
          };
        })
        .filter((box) => box.visible)
        .slice(0, 6)
    );
    expect(boxes.length).toBeGreaterThan(0);

    for (const [index, box] of boxes.entries()) {
      expect(box.width, `photo ${index + 1} should stay compact`).toBeLessThanOrEqual(96);
      expect(Math.abs(box.width - box.height), `photo ${index + 1} should be square`).toBeLessThanOrEqual(2);
    }
  });

  test("mobile map defaults crowded routes to the first five places", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `Mobile route test ${Date.now()}`,
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
      for (let index = 0; index < 8; index += 1) {
        const response = await request.post(`${baseUrl}/api/trip-segments`, {
          data: {
            kind: "activity",
            lat: 25.7906 + index * 0.004,
            lng: -80.13 - index * 0.004,
            location: `Route address ${index + 1}`,
            title: `Route place ${index + 1}`,
            tripId
          },
          headers: { "x-cypress-dashboard": "true" }
        });
        expect(response.status()).toBe(201);
      }

      await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });
      await expect(page.getByTestId("connected-trip-map")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-map-system="almidy-apple-map-system"]').first()).toBeVisible();
      await expect(page.getByText("Showing first 5 of 8 places")).toBeVisible();
      await expect(page.getByRole("button", { name: /Route place 6/ })).toHaveCount(0);
      await expect(page.getByText("1 of 5")).toBeVisible();
      await expect(page.getByTestId("map-show-all-places")).toHaveText("Show all places", { timeout: 20_000 });
      await expect(page.getByTestId("map-show-all-places")).toBeEnabled();
      await page.getByTestId("map-show-all-places").click();
      await expect(page.getByText("Showing all 8 places")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("map-route-list").getByRole("button", { name: /Route place 6/ })).toBeVisible();
    } finally {
      await deleteTripForTest(request, tripId);
    }
  });
});
