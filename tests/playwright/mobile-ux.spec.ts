import { expect, test, type APIRequestContext } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const viewports = [360, 390, 430, 768, 820, 1024, 1280, 1440] as const;
const routes = [
  "/dashboard",
  "/dashboard/search",
  "/dashboard/imports",
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

  test("mobile hides the global topbar outside Home and keeps it on desktop", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    for (const route of [
      "/dashboard/imports",
      "/dashboard/search",
      "/dashboard/trips",
      "/dashboard/trips/demo",
      "/dashboard/trips/demo/timeline",
      "/dashboard/trips/demo/map",
      "/dashboard/trips/demo/ideas",
      "/dashboard/trips/demo/budget",
      "/dashboard/trips/demo/documents",
      "/dashboard/trips/demo/sharing",
      "/dashboard/account"
    ] as const) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "commit" });
      await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("app-shell-topbar")).toBeHidden();
    }

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();

    await page.setViewportSize({ height: 900, width: 1024 });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(page.getByTestId("app-shell-topbar")).toBeVisible();
  });

  test("mobile trips page shows a wallet setup or wallet list", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    const firstTripState = page.getByTestId("mobile-first-trip-state");
    const tripWallet = page.getByTestId("mobile-trips-wallet");
    await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for trips")).toBeVisible();
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });

    if (await firstTripState.isVisible()) {
      await expect(firstTripState.getByRole("heading", { name: "Create your first trip" })).toBeVisible();
      await expect(firstTripState.getByRole("button", { name: "Create trip" })).toBeVisible();
      const createPanel = page.getByTestId("mobile-create-another-trip");
      await expect(createPanel.getByTestId("mobile-trip-create-form")).toBeVisible();
      await expect(createPanel.getByTestId("mobile-trip-create-preview")).toBeVisible();
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

      await page.goto(`${baseUrl}/dashboard/trips?view=map`, { waitUntil: "commit" });
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
        /\/dashboard\/trips$/
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
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });
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

    await expect(form.getByTestId("mobile-trip-create-preview")).toContainText(tripName);
    await expect(form.getByTestId("mobile-trip-create-preview")).toContainText(/May 29 - May 31|29 May - 31 May/);
    await form.getByRole("button", { name: "Create Trip" }).last().click();
    await page.waitForURL(/\/dashboard\/trips\/[^/]+$/, { timeout: 45_000, waitUntil: "commit" });

    const tripId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
    expect(tripId).toBeTruthy();

    try {
      await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
      await expect(page.getByTestId("trip-compact-header")).toBeHidden();
      await expect(page.getByTestId("trip-section-menu")).toBeHidden();
      const mobileHub = page.getByTestId("trip-overview-page");
      await expect(mobileHub).toBeVisible();
      await expect(mobileHub.getByTestId("overview-small-pass")).toBeVisible({ timeout: 20_000 });
      await expect(mobileHub.getByTestId("mobile-real-map-preview")).toBeVisible();
      await expect(mobileHub.getByTestId("mobile-real-map-preview")).toHaveAttribute("data-map-theme", "dark");
      await expect(mobileHub.getByTestId("overview-small-primary-cta")).toBeVisible();
      await expect(mobileHub.getByTestId("overview-small-primary-cta")).toContainText("Add trip item");
      await expect(mobileHub.getByText("Invite Guests")).toHaveCount(0);
      await expect(mobileHub.getByText("Trip guests")).toBeVisible();
      await expect(mobileHub.getByRole("link", { name: "Open map" }).first()).toBeVisible();
      await expect(mobileHub.getByRole("link", { name: "Open Activities" })).toBeVisible();
      await expect(mobileHub.getByTestId("overview-more-tools")).toBeVisible();
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
    await page.goto(`${baseUrl}/dashboard/imports`, { waitUntil: "commit" });
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

  test("home and plan keep mobile guidance compact", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Your travel companion" })).toBeVisible();
    await expect(
      page.getByText("Pick up a trip, start planning, or review ideas waiting for you.")
    ).toBeVisible();
    await expect(page.getByTestId("home-launch-page")).toBeVisible();
    await expect(page.getByTestId("home-smart-start")).toBeVisible();
    await expect(page.getByLabel("Where are you headed?")).toBeVisible();
    await expect(page.getByTestId("home-smart-create-trip")).toBeVisible();
    await expect(page.getByTestId("home-primary-cta")).toHaveCount(1);
    await expect(page.getByText("Start with an idea")).toBeVisible();
    await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
    await expect(page.getByText("First Plan Guide")).toHaveCount(0);
    await expect(page.getByText("Add, review, create.")).toHaveCount(0);
    await expect(page.getByText("Recent passes")).toHaveCount(0);
    await expect(page.getByText(/0 waiting to review/i)).toHaveCount(0);

    await page.goto(`${baseUrl}/dashboard/imports`, { waitUntil: "commit" });
    await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Capture travel ideas" })).toBeVisible();
    await expect(page.getByText("Create a trip from saved ideas.")).toHaveCount(0);
    await expect(page.getByTestId("plan-workflow-stepper")).toHaveCount(1);
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
    await expect(page.getByText("Places / Activities")).toBeVisible();
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
    await teamDinnerRow.getByRole("button", { name: "Details" }).click();
    await expect(page.getByTestId("activity-detail-sheet")).toBeVisible();
    await expect(page.getByTestId("activity-detail-map")).toBeVisible();
    await expect(page.getByTestId("activity-detail-map").locator(".gm-style")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("activity-detail-sheet").getByRole("link", { name: "Directions" })).toBeVisible();
    await expect(page.getByTestId("activity-detail-panel").getByText("Starts")).toBeVisible();
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
      const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 180);
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
      await expect(page.getByTestId("trip-compact-header")).toBeHidden();
      await expect(page.getByTestId("trip-section-menu")).toBeHidden();
      await expect(page.getByTestId("mobile-real-map-preview")).toHaveAttribute("data-map-theme", "dark");
      await expect(page.getByTestId("overview-small-pass")).toContainText(tripPayload.trip.name);
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
    await expect(page.getByTestId("trip-budget-page").getByText("Latest Added")).toBeVisible();
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
