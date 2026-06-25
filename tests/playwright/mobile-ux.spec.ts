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
  await expect(page.locator("gmp-map-3d")).toHaveCount(0);
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

      (window as typeof window & {
        google?: {
          maps?: {
            importLibrary?: (libraryName: string) => Promise<unknown>;
          };
        };
      }).google = {
        maps: {
          importLibrary: () => Promise.resolve({})
        }
      };
    },
    { latitude, longitude, permission }
  );
}

test.describe("mobile soft-launch UX", () => {
  for (const width of [360, 390, 430] as const) {
    test(`public homepage avoids horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(`${baseUrl}/`, { waitUntil: "commit" });

      await expect(
        page.getByRole("heading", {
          name: "All your trip details. Finally, in one place."
        })
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Start planning" })).toBeVisible();

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - window.innerWidth;
      });

      expect(overflow, `public homepage overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }

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

    await page.setViewportSize({ height: 900, width: 768 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-shell-variant", "desktop");
    await expect(page.getByTestId("app-shell-sidebar")).toBeVisible();
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();
    await expect(page.getByTestId("app-shell-nav")).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toHaveCount(0);

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

  test("mobile trips page is canonical and keeps the My Trips map surface", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/dashboard\/trips$/);
    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-country-map-canvas")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("mobile-home-wallet-content")).toHaveAttribute("data-sheet-surface", "trips");
    await expect(page.getByTestId("mobile-trips-sheet-content")).toBeVisible();
    await expect(page.getByTestId("ios-launch-sheet-collapsed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open trip list" })).toHaveAttribute(
      "href",
      "/dashboard/trips?view=list"
    );
    await expect(page.getByTestId("mobile-home-wallet")).toHaveCount(0);
    await expect(page.getByTestId("mobile-country-sheet").getByTestId("mobile-home-wallet-content")).toHaveCount(1);
    await page.getByRole("button", { name: "Open My Trips" }).click();
    await expect(page.getByTestId("mobile-trips-sheet-expanded")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-native-actions")).toBeVisible();
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

  test("home launch uses Almidy-owned globe before wallet actions", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    const googleMapsRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("maps.googleapis.com") || url.includes("maps.gstatic.com")) {
        googleMapsRequests.push(url);
      }
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("mobile-home-3d-hero")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-3d-enabled", "false");
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "fallback");
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute(
      "data-home-hero-mode",
      "home-hero-mode: almidy-owned"
    );
    await expect(page.getByTestId("earth-only-visual")).toBeVisible();
    await expect(page.getByTestId("earth-static-fallback")).toHaveAttribute("data-earth-source", "almidy-owned-globe");
    await expect(page.getByTestId("home-3d-fallback-image")).toBeVisible();
    await expect(page.getByTestId("home-3d-loading")).toHaveCount(0);
    await expect(page.getByTestId("home-3d-map")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    await expectNoHomeGoogleMapsScripts(page);
    expect(googleMapsRequests, "home launch must not request Google Maps scripts").toEqual([]);
    await expect(page.getByTestId("mobile-home-globe")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-photorealistic")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-image")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Trips" })).toHaveCount(1);
    const home3DHero = page.getByTestId("mobile-home-3d-hero");
    await expect(home3DHero.getByText("Almidy", { exact: true })).toHaveCount(0);
    await expect(home3DHero.getByText("Travel wallet")).toHaveCount(0);
    await expect(home3DHero.getByText("Continue trip")).toHaveCount(0);
    await expect(home3DHero.getByText("Create trip")).toHaveCount(0);
    await expect(home3DHero.getByText("Add idea")).toHaveCount(0);
    await expect(home3DHero.getByText("Search")).toHaveCount(0);
    await expect(home3DHero.getByText("Review places")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-globe-controls")).toBeVisible();
    await expect(home3DHero.getByRole("link")).toHaveCount(1);
    await expect(home3DHero.getByRole("link", { name: "Open map" })).toHaveAttribute("href", "/dashboard/map");
    await expect(home3DHero.getByRole("button", { name: "Use current location" })).toBeVisible();
    await expect(page.getByTestId("mobile-home-earth-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-ocean")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-continents")).toHaveCount(0);
    await expect(page.getByText("Scroll", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-country-code", "US");
    await expect(page.getByTestId("mobile-home-country-name")).toContainText("United States");

    const heroVisual = await page.getByTestId("photorealistic-3d-home-hero").evaluate((element) => {
      const style = window.getComputedStyle(element);
      const fallback = element.querySelector<HTMLImageElement>('[data-testid="home-3d-fallback-image"]');
      const fallbackStyle = fallback ? window.getComputedStyle(fallback) : null;
      const fallbackRect = fallback?.getBoundingClientRect();
      const map = element.querySelector<HTMLElement>('[data-testid="home-3d-map"]');

      return {
        fallbackHeight: fallbackRect?.height ?? 0,
        fallbackNaturalHeight: fallback?.naturalHeight ?? 0,
        fallbackNaturalWidth: fallback?.naturalWidth ?? 0,
        fallbackOpacity: fallbackStyle?.opacity ?? "0",
        fallbackSrc: fallback?.currentSrc || fallback?.src || "",
        mapMounted: Boolean(map),
        mode: element.getAttribute("data-hero-mode") ?? "",
        opacity: style.opacity,
        width: fallbackRect?.width ?? 0
      };
    });
    expect(heroVisual.mode).toBe("fallback");
    expect(heroVisual.mapMounted, "home launch does not mount Google Maps 3D").toBe(false);
    expect(Number(heroVisual.opacity), "home launch hero opacity").toBeGreaterThan(0.9);
    expect(heroVisual.width, "home launch visual covers viewport width").toBeGreaterThanOrEqual(390);
    expect(heroVisual.fallbackHeight, "owned globe covers the launch area").toBeGreaterThanOrEqual(250);
    expect(heroVisual.fallbackNaturalWidth, "owned globe asset is loaded").toBeGreaterThan(0);
    expect(Number(heroVisual.fallbackOpacity), "owned globe is visible").toBeGreaterThan(0.9);
    expect(decodeURIComponent(heroVisual.fallbackSrc), "old baked home hero asset is not used").not.toContain(
      "/globe/wayline-earth-hero"
    );
    expect(decodeURIComponent(heroVisual.fallbackSrc), "old cropped home earth asset is not used").not.toContain(
      "/globe/wayline-earth-visual"
    );
    const homeLaunchLayout = await page.evaluate(() => {
      const launch = document.querySelector('[data-testid="mobile-home-3d-hero"]')?.getBoundingClientRect();
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
    await expect(launchSheet).toHaveAttribute("data-sheet-state", "collapsed");
    await expect(page.getByTestId("mobile-home-actions")).toBeVisible();
    await expect(page.getByTestId("mobile-home-compact-actions")).toBeVisible();
    await expect(page.getByTestId("ios-launch-sheet-expanded")).toBeHidden();
    await expect(launchSheet.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: "Open My Trips" })).toBeVisible();
    await expect(launchSheet.getByRole("button", { name: "Open settings" })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Continue trip|Create trip/ })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Search/ })).toBeVisible();
    await expect(launchSheet.getByRole("link", { name: /Add/ })).toBeVisible();
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

  test("mobile home Almidy-owned globe uses granted browser location for pin", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-3d-enabled", "false");
    await expect(page.getByTestId("home-3d-map")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-location-source", "user");
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-user-latitude", "25.76170");
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-user-longitude", "-80.19180");
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-pin-coordinate", "25.76170,-80.19180");
    await expect(page.getByTestId("mobile-home-country-name")).toHaveText("United States");
  });

  test("dashboard and trips use the same shared user country pin data", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await installMockMobileLocation(page);

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-location-source", "user", {
      timeout: 5_000
    });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-user-latitude", "25.76170");
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-user-longitude", "-80.19180");
    const dashboardPin = await page.getByTestId("mobile-home-country-pin").evaluate((element) => ({
      countryCode: element.getAttribute("data-country-code"),
      latitude: element.getAttribute("data-user-latitude"),
      longitude: element.getAttribute("data-user-longitude")
    }));
    await expect(page.getByTestId("mobile-home-country-name")).toContainText("United States");

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

    expect(tripsPin).toEqual(dashboardPin);
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

  test("mobile map location falls back cleanly when geolocation is denied", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installMockMobileLocation(page, { permission: "denied" });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-location-source", "country");
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-country-code", "US");
    await expect(page.getByTestId("mobile-home-country-pin")).not.toHaveAttribute("data-user-latitude", "25.76170");

    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
    const tripsMap = page.getByTestId("mobile-trips-country-map-screen");
    await expect(tripsMap).toBeVisible({ timeout: 20_000 });
    await expect(tripsMap).not.toHaveAttribute("data-user-pin-latitude", "25.76170");
    await expect(page.getByTestId("mobile-country-sheet")).toBeVisible();
  });

  test("mobile home 3D hero supports reduced motion and unknown country fallback", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ height: 900, width: 390 });
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
    await expect(page.getByTestId("mobile-home-3d-hero")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toBeVisible();
    await expect(page.getByTestId("home-3d-map-stage")).toBeHidden();
    await expect(page.getByTestId("mobile-home-globe")).toHaveCount(0);
    await expect(page.getByTestId("earth-only-visual")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "fallback");
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute(
      "data-home-hero-mode",
      "home-hero-mode: reduced-motion"
    );
    await expect(page.getByTestId("home-3d-loading")).toHaveCount(0);
    await expect(page.getByTestId("earth-static-fallback")).toHaveAttribute(
      "data-earth-source",
      "almidy-owned-globe"
    );
    await expect(page.getByTestId("home-3d-fallback-image")).toBeVisible();
    await expect(page.getByTestId("mobile-home-earth-image")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-continents")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-country-code", "US");
    await expect(page.getByTestId("mobile-home-country-name")).toHaveText("United States");
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

  test("mobile home launch stays Almidy-owned when Maps 3D is unavailable", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
    });

    await page.goto(baseUrl + "/dashboard", { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-3d-enabled", "false");
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "fallback");
    await expect(page.getByTestId("earth-static-fallback")).toHaveAttribute("data-earth-source", "almidy-owned-globe");
    await expect(page.getByTestId("home-3d-fallback-image")).toBeVisible();
    await expect(page.getByTestId("home-3d-map")).toHaveCount(0);
    await expectNoHomeGoogleMapsCopy(page);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "My Trips" })).toHaveCount(1);
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
      await expect(page.getByTestId("trip-map-canvas")).toHaveAttribute("data-map-theme", "dark");
      await expect(page.getByTestId("map-day-filter-overlay")).toBeHidden();
      const mobileFilter = page.getByTestId("map-mobile-day-filter");
      await expect(mobileFilter).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "All" })).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "Jun 10" })).toBeVisible();
      await expect(mobileFilter.getByRole("button", { name: "Jun 11" })).toBeVisible();
      await expect(page.getByTestId("map-route-panel").getByText("1 of 1")).toBeVisible();
      const mapPanelFitsViewport = await page.getByTestId("map-route-panel").evaluate((node) => {
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
    await expect(itinerary.getByTestId("itinerary-date-strip")).toBeVisible();
    await expect(page.locator("details#new-plan")).toBeVisible();
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
      await expect(page.getByTestId("trip-map-canvas")).toHaveAttribute("data-map-theme", "dark");
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
