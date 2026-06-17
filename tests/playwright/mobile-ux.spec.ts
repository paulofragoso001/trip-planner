import { expect, test, type APIRequestContext } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const viewports = [360, 390, 430, 768, 820, 1024, 1280, 1440] as const;
const routes = [
  "/dashboard",
  "/dashboard/search",
  "/dashboard/plan",
  "/dashboard/profile/stats",
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

  test("mobile bottom navigation exposes soft-launch destinations", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });

    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: /Trips/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Plan/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Plan/ })).toHaveAttribute("href", "/dashboard/plan");
    await expect(nav.getByRole("link", { name: /Map/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Profile/ })).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("link").nth(0)).toHaveText(/Trips/);
    await expect(nav.getByRole("link").nth(1)).toHaveText(/Plan/);
    await expect(nav.getByRole("link").nth(2)).toHaveText(/Map/);
    await expect(nav.getByRole("link").nth(3)).toHaveText(/Profile/);
    await expect(nav.getByRole("link", { name: /Home/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Saved/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Plan with AI/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /My Trips/ })).toHaveCount(0);
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
    await expect(page.getByTestId("app-shell-topbar")).toBeHidden();
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible({ timeout: 30_000 });

    await page.setViewportSize({ height: 900, width: 1024 });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();
  });

  test("mobile trips page defaults to map-first and supports the wallet list", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-country-map-canvas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show trip cards" })).toHaveAttribute(
      "href",
      "/dashboard/trips?view=list"
    );
    await expect(page.getByRole("link", { name: "Open travel stats" })).toHaveAttribute(
      "href",
      "/dashboard/profile/stats"
    );

    await page.goto(`${baseUrl}/dashboard/trips?view=list`, { waitUntil: "commit" });
    const firstTripState = page.getByTestId("mobile-first-trip-state");
    const tripWallet = page.getByTestId("mobile-trips-wallet");
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(page.getByTestId("mobile-trips-wallet-background").locator("img")).toHaveCount(0);
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });

    if (await firstTripState.isVisible()) {
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
      await expect(page.getByTestId("mobile-create-another-trip").getByText("Create trip")).toBeVisible();
    }
  });

  test("mobile travel stats shows passport overview and detail cards", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/profile/stats`, { waitUntil: "commit" });

    await expect(page.getByTestId("travel-stats-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("travel-stats-overview").getByRole("heading", { name: "Travel Stats" })).toBeVisible();
    await expect(page.getByTestId("travel-stats-year-selector")).toBeVisible();
    await expect(page.getByTestId("travel-stats-countries")).toBeVisible();
    await expect(page.getByTestId("travel-stats-transport")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "mobile travel stats overflow").toBeLessThanOrEqual(1);
  });

  test("mobile trips country map uses saved destination coordinates only", async ({ page, request }) => {
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

      await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
      await expect(page.getByTestId("mobile-trips-country-map-screen")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mobile-country-map-canvas")).toBeVisible();
      await expect(page.getByTestId("mobile-country-map-canvas").locator(".gm-style")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
      await expect(page.getByTestId("mobile-country-sheet-toggle")).toHaveAttribute("aria-expanded", "false");
      const collapsedSheet = await page.getByTestId("mobile-country-sheet").boundingBox();
      expect(collapsedSheet?.height ?? 0, "collapsed country sheet height").toBeLessThanOrEqual(260);
      expect(collapsedSheet?.y ?? 0, "collapsed country sheet top").toBeGreaterThanOrEqual(575);

      await page.getByPlaceholder("Search for trips").fill(`Mobile country map ${suffix}`);
      await expect(
        page.locator(`[data-testid="mobile-country-map-marker"][aria-label="Open ${mappedTripName}"]`)
      ).toHaveCount(1);
      await expect(
        page.locator(`[data-testid="mobile-country-map-marker"][aria-label="Open ${listOnlyTripName}"]`)
      ).toHaveCount(0);

      await page.getByTestId("mobile-country-sheet-toggle").click();
      await expect(page.getByTestId("mobile-country-sheet-toggle")).toHaveAttribute("aria-expanded", "true");
      const countryTripList = page.getByTestId("mobile-country-trip-list");
      const mappedRow = countryTripList.getByRole("link", {
        name: new RegExp(escapeRegExp(mappedTripName))
      });
      const listOnlyRow = countryTripList.getByRole("link", {
        name: new RegExp(escapeRegExp(listOnlyTripName))
      });
      await expect(mappedRow).toBeVisible();
      await expect(listOnlyRow).toBeVisible();
      await expect(mappedRow.getByText("Mapped")).toBeVisible();
      await expect(listOnlyRow.getByText("List only")).toBeVisible();
      await expect(page.getByRole("link", { name: "Show trip cards" })).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Show trip cards" }).first()).toHaveAttribute(
        "href",
        /\/dashboard\/trips\?view=list$/
      );
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

  test("bottom nav does not cover the scrollable content area", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/plan`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-main")).toBeVisible();
    await expect(page.getByTestId("app-shell-mobile-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 15_000 });

    const spacing = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="app-shell-main"]');
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const mainPaddingBottom = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0;
      const navHeight = nav?.getBoundingClientRect().height || 0;
      return { mainPaddingBottom, navHeight };
    });

    expect(spacing.mainPaddingBottom).toBeGreaterThanOrEqual(spacing.navHeight + 20);
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
              carrier: "Wayline Air",
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
      await expect(activityGroup.getByText("Wayline Air")).toBeVisible();
      await expect(activityGroup.getByText(flightNumber)).toBeVisible();
      await expect(page.getByText("Terminal")).toHaveCount(0);
      await expect(page.getByText("Baggage")).toHaveCount(0);
      await expect(page.getByText("Aircraft")).toHaveCount(0);

      await page.getByTestId("search-input").fill(`no-result-${suffix}`);
      await expect(page.getByRole("heading", { name: "No results found" })).toBeVisible();
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

  test("home launch uses photorealistic 3D hero before wallet actions", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
      const testWindow = window as typeof window & {
        __waylineResolveMaps3D?: () => void;
        google?: {
          maps?: {
            importLibrary?: (libraryName: string) => Promise<unknown>;
          };
        };
      };

      testWindow.google = {
        maps: {
          importLibrary: () =>
            new Promise((resolve) => {
              testWindow.__waylineResolveMaps3D = () => resolve({});
            })
        }
      };
    });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("mobile-home-3d-hero")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toBeVisible();
    await expect(page.getByTestId("home-3d-map-stage")).toBeVisible();
    await expect(page.getByTestId("mobile-home-globe")).toHaveCount(0);
    await expect(page.getByTestId("earth-only-visual")).toBeVisible();
    await expect(page.getByTestId("mobile-home-earth-photorealistic")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-image")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Travel wallet" })).toHaveCount(1);
    const home3DHero = page.getByTestId("mobile-home-3d-hero");
    await expect(home3DHero.getByText("Wayline", { exact: true })).toHaveCount(0);
    await expect(home3DHero.getByText("Travel wallet")).toHaveCount(0);
    await expect(home3DHero.getByText("Continue trip")).toHaveCount(0);
    await expect(home3DHero.getByText("Create trip")).toHaveCount(0);
    await expect(home3DHero.getByText("Add idea")).toHaveCount(0);
    await expect(home3DHero.getByText("Search")).toHaveCount(0);
    await expect(home3DHero.getByText("Review places")).toHaveCount(0);
    await expect(home3DHero.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-texture")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-ocean")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-earth-continents")).toHaveCount(0);
    await expect(page.getByText("Scroll", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "loading");
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute(
      "data-home-hero-mode",
      "home-hero-mode: loading"
    );
    await expect(page.getByTestId("home-3d-loading")).toBeVisible();
    await expect(page.getByTestId("earth-static-fallback")).toHaveCount(0);
    await expect(page.getByTestId("home-3d-fallback-image")).toHaveCount(0);
    const loadingHeroVisual = await page.getByTestId("photorealistic-3d-home-hero").evaluate((element) => {
      const mapStage = element.querySelector<HTMLElement>('[data-testid="home-3d-map-stage"]');
      const mapStageStyle = mapStage ? window.getComputedStyle(mapStage) : null;

      return {
        mapStageOpacity: mapStageStyle?.opacity ?? "0",
        mode: element.getAttribute("data-hero-mode") ?? ""
      };
    });
    expect(loadingHeroVisual.mode).toBe("loading");
    expect(Number(loadingHeroVisual.mapStageOpacity), "3D map stays hidden while loading").toBeLessThan(0.1);
    await page.waitForTimeout(2_450);
    const loadingContentBeforeFocus = await page.getByTestId("mobile-home-wallet-content").evaluate((element) => {
      const hero = document.querySelector('[data-testid="photorealistic-3d-home-hero"]');
      const fallback = document.querySelector('[data-testid="home-3d-fallback-image"]');
      const style = window.getComputedStyle(element);

      return {
        fallbackMounted: Boolean(fallback),
        heroMode: hero?.getAttribute("data-hero-mode") ?? "",
        opacity: style.opacity
      };
    });
    expect(loadingContentBeforeFocus.heroMode, "Home content waits while the 3D launch focuses").toBe("loading");
    expect(loadingContentBeforeFocus.fallbackMounted, "clean fallback does not flash before the 3D timeout").toBe(false);
    expect(
      Number(loadingContentBeforeFocus.opacity),
      "Home content stays hidden during the early cinematic launch"
    ).toBeLessThan(0.35);
    await page.waitForTimeout(1_450);
    const loadingContentAfterFocus = await page.getByTestId("mobile-home-wallet-content").evaluate((element) => {
      const hero = document.querySelector('[data-testid="photorealistic-3d-home-hero"]');
      const fallback = document.querySelector('[data-testid="home-3d-fallback-image"]');
      const style = window.getComputedStyle(element);

      return {
        fallbackMounted: Boolean(fallback),
        heroMode: hero?.getAttribute("data-hero-mode") ?? "",
        opacity: style.opacity
      };
    });
    expect(loadingContentAfterFocus.heroMode, "Home content is not blocked by slow 3D loading").toBe("loading");
    expect(loadingContentAfterFocus.fallbackMounted, "fallback still waits for the 3D timeout").toBe(false);
    expect(Number(loadingContentAfterFocus.opacity), "Home content fades in after the focus timing").toBeGreaterThan(
      0.9
    );
    await page.evaluate(() => {
      const testWindow = window as typeof window & { __waylineResolveMaps3D?: () => void };
      testWindow.__waylineResolveMaps3D?.();
    });
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "ready3d", {
      timeout: 5_000
    });
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute(
      "data-home-hero-mode",
      "home-hero-mode: ready3d"
    );
    const cameraStart = await page.getByTestId("home-3d-map").evaluate((element) => ({
      center: element.getAttribute("center") ?? "",
      heading: element.getAttribute("heading") ?? "",
      progress: element.getAttribute("data-camera-progress") ?? "0",
      range: element.getAttribute("range") ?? "",
      tilt: element.getAttribute("tilt") ?? ""
    }));
    expect(cameraStart.center, "3D camera starts with a country-focused center").toContain(",");
    expect(Number(cameraStart.progress), "3D camera intro starts before the settled frame").toBeLessThan(1);
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-launch-phase", /loading|zooming-in/);
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveCount(0);
    await page.waitForTimeout(900);
    const cameraMid = await page.getByTestId("home-3d-map").evaluate((element) => ({
      center: element.getAttribute("center") ?? "",
      heading: element.getAttribute("heading") ?? "",
      progress: element.getAttribute("data-camera-progress") ?? "0",
      range: element.getAttribute("range") ?? "",
      tilt: element.getAttribute("tilt") ?? ""
    }));
    expect(cameraMid.center, "3D camera center changes during launch").not.toBe(cameraStart.center);
    expect(cameraMid.heading, "3D camera heading changes during launch").not.toBe(cameraStart.heading);
    expect(cameraMid.range, "3D camera range changes during launch").not.toBe(cameraStart.range);
    expect(Number(cameraMid.progress), "3D camera intro progresses after launch").toBeGreaterThan(
      Number(cameraStart.progress)
    );
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-launch-phase", /zooming-in|spinning/);
    await page.waitForTimeout(1_850);
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-launch-phase", /settling|pin|content/);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 2_000 });
    await page.waitForTimeout(1_150);
    const cameraSettled = await page.getByTestId("home-3d-map").evaluate((element) => ({
      center: element.getAttribute("center") ?? "",
      heading: element.getAttribute("heading") ?? "",
      progress: element.getAttribute("data-camera-progress") ?? "0",
      range: element.getAttribute("range") ?? "",
      tilt: element.getAttribute("tilt") ?? ""
    }));
    expect(cameraSettled.center, "3D camera settles after launch").not.toBe(cameraMid.center);
    expect(cameraSettled.progress, "3D camera intro marks completion").toBe("1");
    await expect(page.getByTestId("home-3d-loading")).toHaveCount(0);
    await expect(page.getByTestId("earth-static-fallback")).toHaveCount(0);
    await expect(page.getByTestId("home-3d-fallback-image")).toHaveCount(0);
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("mobile-home-country-pin")).toHaveAttribute("data-country-code", "US");
    await expect(page.getByTestId("mobile-home-country-name")).toHaveText("United States");
    await page.waitForFunction(() => {
      const mapStage = document.querySelector<HTMLElement>('[data-testid="home-3d-map-stage"]');
      const mapStageOpacity = mapStage ? Number(window.getComputedStyle(mapStage).opacity) : 0;

      return mapStageOpacity > 0.9;
    });
    const heroVisual = await page.getByTestId("photorealistic-3d-home-hero").evaluate((element) => {
      const style = window.getComputedStyle(element);
      const fallback = element.querySelector<HTMLImageElement>('[data-testid="home-3d-fallback-image"]');
      const fallbackStyle = fallback ? window.getComputedStyle(fallback) : null;
      const fallbackRect = fallback?.getBoundingClientRect();
      const map = element.querySelector<HTMLElement>('[data-testid="home-3d-map"]');
      const mapRect = map?.getBoundingClientRect();
      const mapStage = element.querySelector<HTMLElement>('[data-testid="home-3d-map-stage"]');
      const mapStageStyle = mapStage ? window.getComputedStyle(mapStage) : null;
      return {
        fallbackHeight: fallbackRect?.height ?? 0,
        fallbackNaturalHeight: fallback?.naturalHeight ?? 0,
        fallbackNaturalWidth: fallback?.naturalWidth ?? 0,
        fallbackOpacity: fallbackStyle?.opacity ?? "0",
        fallbackSrc: fallback?.currentSrc || fallback?.src || "",
        mapDefaultUiHidden: map?.hasAttribute("default-ui-hidden") ?? false,
        mapHeight: mapRect?.height ?? 0,
        mapStageOpacity: mapStageStyle?.opacity ?? "0",
        mapWidth: mapRect?.width ?? 0,
        mode: element.getAttribute("data-hero-mode") ?? "",
        opacity: style.opacity,
        width: fallbackRect?.width ?? mapRect?.width ?? 0
      };
    });
    expect(heroVisual.mode).toBe("ready3d");
    expect(Number(heroVisual.opacity), "home 3D hero opacity").toBeGreaterThan(0.9);
    expect(heroVisual.width, "home 3D visual covers viewport width").toBeGreaterThanOrEqual(390);
    expect(Number(heroVisual.mapStageOpacity), "3D map stage is visible when ready").toBeGreaterThan(0.9);
    expect(heroVisual.mapWidth, "3D map covers viewport width").toBeGreaterThanOrEqual(390);
    expect(heroVisual.mapHeight, "3D map covers compact launch height").toBeGreaterThanOrEqual(220);
    expect(heroVisual.mapDefaultUiHidden, "3D map hides built-in navigation controls").toBe(true);
    expect(heroVisual.fallbackSrc, "fallback image is not mounted behind ready 3D").toBe("");
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
        contentBorderTopWidth: contentStyle?.borderTopWidth ?? "",
        contentGap: Math.round((content?.top ?? 0) - (launch?.bottom ?? 0)),
        contentPaddingBottom: contentStyle?.paddingBottom ?? "",
        contentTop: content?.top ?? 0,
        headingGap: Math.round((heading?.top ?? 0) - (launch?.bottom ?? 0)),
        headingTop: heading?.top ?? 0,
        launchBottom: launch?.bottom ?? 0,
        launchHeight: launch?.height ?? 0,
        navTop: nav?.top ?? window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        stagePaddingBottom: stageStyle?.paddingBottom ?? "",
        stageTop: stage?.top ?? 0,
        viewportHeight: window.innerHeight
      };
    });
    expect(homeLaunchLayout.launchHeight, "home Earth hero owns the top of the launch screen").toBeGreaterThanOrEqual(
      250
    );
    expect(homeLaunchLayout.launchHeight, "home Earth hero leaves room for wallet actions").toBeLessThanOrEqual(
      430
    );
    expect(homeLaunchLayout.contentTop, "wallet content starts directly under the Earth fade").toBeGreaterThanOrEqual(
      homeLaunchLayout.launchBottom - 56
    );
    expect(homeLaunchLayout.contentTop, "wallet content overlaps only the lower Earth fade").toBeLessThanOrEqual(
      homeLaunchLayout.launchBottom
    );
    expect(homeLaunchLayout.headingTop, "wallet title sits just below the Earth visual").toBeGreaterThanOrEqual(
      homeLaunchLayout.launchBottom - 56
    );
    expect(homeLaunchLayout.contentBorderTopWidth, "home wallet has no hard divider").toBe("0px");
    expect(homeLaunchLayout.actionsBorderTopWidth, "home action form has no white outline").toBe("0px");
    expect(homeLaunchLayout.contentGap, "wallet content has a controlled overlap with the Earth fade").toBeLessThanOrEqual(0);
    expect(homeLaunchLayout.contentGap, "wallet content avoids a giant upward overlap into the Earth").toBeGreaterThanOrEqual(-56);
    expect(homeLaunchLayout.actionsTop, "wallet form sits below the compact title").toBeGreaterThan(
      homeLaunchLayout.headingTop + 88
    );
    expect(homeLaunchLayout.actionsTop, "wallet form begins before the bottom nav").toBeLessThan(
      homeLaunchLayout.navTop
    );
    expect(
      Number.parseFloat(homeLaunchLayout.stagePaddingBottom),
      "home stage owns compact bottom-nav clearance"
    ).toBeGreaterThanOrEqual(88);
    expect(
      Number.parseFloat(homeLaunchLayout.stagePaddingBottom),
      "home stage avoids a dead footer strip"
    ).toBeLessThanOrEqual(140);
    expect(homeLaunchLayout.scrollHeight, "home page fits the launch screen without document scroll").toBeLessThanOrEqual(
      homeLaunchLayout.viewportHeight + 2
    );
    await expect(page.getByTestId("home-launch-page")).toBeHidden();
    await expect(page.getByTestId("home-smart-start")).toBeHidden();
    await expect(page.getByLabel("Where are you headed?")).toBeHidden();

    await page.getByTestId("mobile-home-wallet-content").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("mobile-home-wallet-content")).toBeVisible();
    await expect(page.getByTestId("mobile-home-actions")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Travel wallet" })).toBeVisible();
    await expect(
      page.getByText("Pick up a trip, start planning, or review saved ideas.")
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue trip|Create trip/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Add idea/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Search/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open map/ })).toBeVisible();
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
    const actionNames = [/Continue trip|Create trip/, /Add idea/, /Search/, /Review places/, /Open map/];
    for (const actionName of actionNames) {
      const action = page.getByRole("link", { name: actionName }).first();
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
    await page.getByRole("link", { name: /Open map/ }).scrollIntoViewIfNeeded();
    const finalActionScrollCushion = await page.getByRole("link", { name: /Open map/ }).evaluate((element) => {
      const nav = document.querySelector('[data-testid="app-shell-mobile-bottom-nav"]');
      const navRect = nav?.getBoundingClientRect();
      const actionRect = element.getBoundingClientRect();

      return {
        clearance: (navRect?.top ?? window.innerHeight) - actionRect.bottom
      };
    });
    expect(
      finalActionScrollCushion.clearance,
      "Open map can scroll clear of the fixed bottom nav"
    ).toBeGreaterThanOrEqual(12);
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
    await expect(page.getByTestId("home-3d-map-stage")).toBeVisible();
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
      "photorealistic-3d-fallback"
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

  test("mobile home 3D hero falls back after simulated 3D failure", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US", "en"] });
      const testWindow = window as typeof window & {
        google?: {
          maps?: {
            importLibrary?: (libraryName: string) => Promise<unknown>;
          };
        };
      };

      testWindow.google = {
        maps: {
          importLibrary: () => Promise.reject(new Error("simulated maps3d failure"))
        }
      };
    });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("mobile-home-wallet")).toBeVisible();
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute("data-hero-mode", "fallback", {
      timeout: 5_000
    });
    await expect(page.getByTestId("photorealistic-3d-home-hero")).toHaveAttribute(
      "data-home-hero-mode",
      "home-hero-mode: fallback"
    );
    await expect(page.getByTestId("home-3d-loading")).toHaveCount(0);
    await expect(page.getByTestId("earth-static-fallback")).toHaveAttribute(
      "data-earth-source",
      "photorealistic-3d-fallback"
    );
    await expect(page.getByTestId("home-3d-fallback-image")).toBeVisible();
    await expect(page.getByTestId("mobile-home-country-pin")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "Travel wallet" })).toHaveCount(1);
  });

  test("demo map exposes ordered route cards on mobile", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
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
            imageAttribution: "Wayline test photo",
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
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Flights" })).toBeVisible();
    await expect(page.getByTestId("mobile-spending-category").filter({ hasText: "Lodging" })).toBeVisible();
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
