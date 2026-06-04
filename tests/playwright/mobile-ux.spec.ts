import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const viewports = [360, 390, 430, 768, 820, 1024, 1280, 1440] as const;
const routes = [
  "/dashboard",
  "/dashboard/imports",
  "/dashboard/trips",
  "/dashboard/trips/demo/timeline",
  "/dashboard/trips/demo/map",
  "/dashboard/trips/demo/ideas"
] as const;

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

    await page.goto(`${baseUrl}/dashboard/trips/demo/timeline`, { waitUntil: "commit" });
    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /Trips/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Map/ })).not.toHaveAttribute("aria-current", "page");

    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /Map/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Trips/ })).not.toHaveAttribute("aria-current", "page");
  });

  test("mobile trips page shows a wallet setup or wallet list", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips`, { waitUntil: "commit" });

    const firstTripState = page.getByTestId("mobile-first-trip-state");
    const tripWallet = page.getByTestId("mobile-trips-wallet");
    await expect(
      page.locator('[data-testid="mobile-first-trip-state"], [data-testid="mobile-trips-wallet"]').first()
    ).toBeVisible({ timeout: 20_000 });

    if (await firstTripState.isVisible()) {
      await expect(firstTripState.getByRole("heading", { name: "Create your first trip" })).toBeVisible();
      await expect(firstTripState.getByTestId("mobile-trip-create-form")).toBeVisible();
      await expect(firstTripState.getByTestId("mobile-trip-create-preview")).toBeVisible();
    } else {
      await expect(tripWallet).toBeVisible();
      await expect(tripWallet.getByRole("heading", { name: "Trips" })).toBeVisible();
      await expect(tripWallet.getByText("Create another trip pass")).toBeVisible();
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

    const createPanel = page.getByTestId("mobile-create-another-trip");
    if ((await createPanel.count()) > 0) {
      await createPanel.last().locator("summary").click();
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
    await page.waitForURL(/\/dashboard\/trips\/[^/]+$/, { timeout: 30_000 });

    const tripId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
    expect(tripId).toBeTruthy();

    try {
      await expect(page.getByTestId("trip-pass-hero")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mobile-trip-wallet-hub")).toBeVisible();
      await expect(page.getByText("Add Activity")).toBeVisible();
      await expect(page.getByText("Invite Guests")).toBeVisible();
      await expect(page.getByLabel("Organizer actions")).toBeHidden();

      const overflow = page.getByTestId("mobile-trip-overflow-menu");
      await expect(overflow).toBeVisible();
      await overflow.locator("summary").click();
      await expect(overflow.getByText("Email import coming soon")).toBeVisible();
      await expect(overflow.getByText("Currency")).toBeVisible();
      await expect(overflow.getByText("Notifications")).toBeVisible();
    } finally {
      if (tripId && tripId !== "trips") {
        await request.delete(`${baseUrl}/api/trips/${tripId}`, {
          headers: { "x-cypress-dashboard": "true" }
        });
      }
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
    await expect(page.getByRole("heading", { name: "Where do you want to start?" })).toBeVisible();
    await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
    await expect(page.getByText("First Plan Guide")).toHaveCount(0);
    await expect(page.getByText("Add, review, create.")).toHaveCount(0);

    await page.goto(`${baseUrl}/dashboard/imports`, { waitUntil: "commit" });
    await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Create a trip from saved ideas.")).toHaveCount(0);
    await expect(page.locator("ol").filter({ hasText: "Add" })).toHaveCount(1);
  });

  test("demo map exposes ordered route cards on mobile", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto(`${baseUrl}/dashboard/trips/demo/map`, { waitUntil: "commit" });

    await expect(page.getByTestId("trip-pass-hero")).toBeVisible();
    await expect(page.getByText("Trip pass")).toBeVisible();
    await expect(page.getByText("Current trip")).toHaveCount(0);
    const hero = page.getByTestId("trip-pass-hero");
    await expect(hero).toHaveAttribute("data-hero-image", "false");
    await expect(hero.getByTestId("trip-pass-hero-fallback")).toBeVisible();
    await expect(hero.getByRole("link", { exact: true, name: "Itinerary" })).toHaveCount(0);
    await expect(hero.getByRole("link", { exact: true, name: "Map" })).toHaveCount(0);
    await expect(hero.getByRole("link", { exact: true, name: "Ideas" })).toHaveCount(0);
    await expect(hero.getByRole("link", { exact: true, name: "Expenses" })).toHaveCount(0);
    await expect(hero.getByRole("link", { exact: true, name: "Docs" })).toHaveCount(0);
    await expect(page.getByTestId("connected-trip-map")).toBeVisible();
    await expect(page.getByText("1 of 4")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /1 Barcelona-El Prat Airport/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 Fira Barcelona meeting/ })).toBeVisible();
    await expect(page.getByLabel("Map categories")).toHaveCount(0);
    await expect(page.getByText("Nearby Ideas", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Open Ideas to find places near your route.")).toBeVisible();

    await page.goto(`${baseUrl}/dashboard/trips/demo/ideas`, { waitUntil: "commit" });
    await expect(page.getByRole("heading", { exact: true, name: "All trip activities" })).toBeVisible();
    const activityFilters = page.getByTestId("activity-category-filters");
    await expect(activityFilters.getByText("Explore nearby")).toBeVisible();
    await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await activityFilters.getByRole("button", { name: "Food" }).click();
    await expect(activityFilters.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true");
    await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    const savedIdeas = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Saved ideas / AI places" }) });
    await expect(savedIdeas.getByText("Team dinner in El Born")).toBeVisible();
    await expect(savedIdeas.getByText("Barcelona-El Prat Airport")).toHaveCount(0);
  });

  test("trip pass hero uses segment photo metadata when available", async ({ page, request }) => {
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
      const hero = page.getByTestId("trip-pass-hero");
      await expect(hero).toHaveAttribute("data-hero-image", "true", { timeout: 20_000 });
      await expect(hero.getByTestId("trip-pass-hero-image")).toHaveAttribute(
        "src",
        /\/api\/travel-data\/place-photo/
      );
      await expect(hero.getByText("Wayline test photo")).toBeVisible();
    } finally {
      await request.delete(`${baseUrl}/api/trips/${tripId}`, {
        headers: { "x-cypress-dashboard": "true" }
      });
    }
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
      await request.delete(`${baseUrl}/api/trips/${tripId}`, {
        headers: { "x-cypress-dashboard": "true" }
      });
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

    const count = Math.min(await photos.count(), 6);
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await photos.nth(index).boundingBox();
      expect(box, `photo ${index + 1} should be measurable`).not.toBeNull();
      expect(box!.width, `photo ${index + 1} should stay compact`).toBeLessThanOrEqual(96);
      expect(Math.abs(box!.width - box!.height), `photo ${index + 1} should be square`).toBeLessThanOrEqual(2);
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
      await expect(page.getByText("Showing first 5 of 8 places")).toBeVisible();
      await expect(page.getByRole("button", { name: /Route place 6/ })).toHaveCount(0);
      await expect(page.getByText("1 of 5")).toBeVisible();
      await expect(page.getByTestId("map-show-all-places")).toHaveText("Show all places", { timeout: 20_000 });
      await expect(page.getByTestId("map-show-all-places")).toBeEnabled();
      await page.getByTestId("map-show-all-places").click();
      await expect(page.getByText("Showing all 8 places")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("map-route-list").getByRole("button", { name: /Route place 6/ })).toBeVisible();
    } finally {
      await request.delete(`${baseUrl}/api/trips/${tripId}`, {
        headers: { "x-cypress-dashboard": "true" }
      });
    }
  });
});
