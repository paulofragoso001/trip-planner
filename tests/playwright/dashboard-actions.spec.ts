import { expect, test, type Page } from "@playwright/test";
import { dashboardActionRoutes } from "../../lib/dashboard/action-routes";

const baseUrl = "http://127.0.0.1:3000";

test.describe("Almidy Segment Expenses Transaction API Controllers", () => {
  test("POST /api/v1/segments/[id]/expenses rejects unauthorized client handshakes", async ({
    request
  }) => {
    const fallbackResponse = await request.post("/api/v1/segments/test_segment_id/expenses", {
      data: {
        amount: 8.5,
        category: "dining",
        currency: "USD",
        title: "Airport Coffee"
      },
      headers: {
        Origin: baseUrl,
        "Sec-Fetch-Site": "same-origin"
      }
    });

    expect(fallbackResponse.status()).toBe(401);
  });

  test("POST /api/v1/segments/[id]/expenses intercepts structural parameter typos with 400 Bad Request", async ({
    request
  }) => {
    const brokenResponse = await request.post("/api/v1/segments/test_segment_id/expenses", {
      data: {
        amount: -120
      },
      headers: {
        Authorization: "Bearer mock_test_user_session_token_string",
        Origin: baseUrl,
        "Sec-Fetch-Site": "same-origin"
      }
    });

    expect(brokenResponse.status()).toBe(400);
  });
});

test.describe("dashboard navigation and client-state actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  });

  test("visible dashboard navigation actions route to their wired domains", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    const dashboardContent = page.getByTestId("app-shell-content");
    const startPlanning = dashboardContent.getByRole("link", { exact: true, name: "Start planning" }).first();
    await expect(startPlanning).toHaveAttribute("href", dashboardActionRoutes.plan.addIdea);
    await startPlanning.click();
    await expect(page).toHaveURL(`${baseUrl}${dashboardActionRoutes.plan.addIdea}`);
    await expect(page.getByTestId("imports-route")).toBeVisible();

    await openDashboardRoute(page, "/dashboard/trips");
    const tripsStartPlanning = page.getByRole("link", { exact: true, name: "Start planning" }).first();
    await expect(tripsStartPlanning).toHaveAttribute("href", dashboardActionRoutes.plan.addIdea);
    await tripsStartPlanning.click();
    await expect(page).toHaveURL(`${baseUrl}${dashboardActionRoutes.plan.addIdea}`);
    await expect(page.getByTestId("imports-route")).toBeVisible();

    await openDashboardRoute(page, "/dashboard");
    await expect(dashboardContent.getByTestId("home-primary-cta")).toHaveAttribute(
      "href",
      /\/dashboard\/trips\/[^/]+|\/dashboard\/trips\?view=list#new-trip/
    );
  });

  test("mobile wallet buttons toggle, route, or show explicit unavailable state", async ({ context, page }) => {
    await page.addInitScript(() => {
      window.google = {
        maps: {
          importLibrary: async () => ({})
        }
      };
    });
    await context.grantPermissions(["geolocation"], { origin: baseUrl });
    await context.setGeolocation({ latitude: 25.7617, longitude: -80.1918 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    const sheet = page.getByTestId("mobile-home-wallet-content");
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("button", { name: "Search" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "search");
    await expect(page.getByTestId("mobile-sheet-search-input")).toBeVisible();
    await page.getByTestId("mobile-sheet-search-cancel").click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("button", { name: "Expand trips sheet" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");

    await page.getByRole("button", { name: "Dismiss reservation importer card" }).click();
    await expect(page.getByTestId("mobile-home-reservation-importer-card")).toHaveCount(0);

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "settings");
    await expect(page.getByRole("button", { name: "Pro soon" })).toBeDisabled();
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByTestId("mobile-home-globe-controls")).toBeVisible();
  });

  test("mobile globe map control routes without writing data", async ({ page }) => {
    await page.addInitScript(() => {
      window.google = {
        maps: {
          importLibrary: async () => ({})
        }
      };
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    await page.getByRole("link", { name: "Open map" }).click();
    await expect(page).toHaveURL(/\/dashboard\/(map|trips\/[^/]+\/map)(?:$|\?)/);
  });

  test("plan action buttons are clickable and surface validation feedback", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openDashboardRoute(page, "/dashboard/plan");

    await page.getByTestId("plan-capture-link").click();
    await expect(page.locator('input[name="sourceUrl"]')).toBeVisible();

    await page.getByTestId("plan-capture-note").click();
    await expect(page.locator('textarea[name="rawText"]')).toBeVisible();

    const reviewIdea = page.getByRole("button", { name: "Review idea" });
    await reviewIdea.click();
    await expect(page.getByText("Choose a link, note, or screenshot first.")).toBeVisible();
    await expect(reviewIdea).toBeEnabled();
  });

  test("account settings route presents the Almidy-native settings surface", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openDashboardRoute(page, "/dashboard/account");

    const accountSurface = page.getByTestId("account-settings-page");
    await expect(accountSurface).toBeVisible();
    await expect(accountSurface.getByRole("heading", { name: "Account & settings" })).toBeVisible();
    await expect(accountSurface.getByRole("link", { name: "Preferences" })).toHaveAttribute("href", "#preferences");
    await expect(accountSurface.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    await expect(accountSurface.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    const reservationEmailRow = accountSurface
      .getByText("Add Reservations via Email", { exact: true })
      .locator("xpath=ancestor::*[@aria-disabled='true'][1]");
    await expect(reservationEmailRow).toHaveCount(1);
    await expect(reservationEmailRow).toContainText("Coming soon");
    await expect(accountSurface.getByRole("link", { name: "Add Reservations via Email" })).toHaveCount(0);
    await expect(accountSurface.getByRole("link", { name: "Manual reservation importer" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.imports.manualReservations
    );
    await expect(accountSurface.getByText("Redeem 15 Days Free")).toBeVisible();
    await expect(accountSurface.getByText("Billing", { exact: true })).toBeVisible();
    await expect(accountSurface.getByRole("link", { name: "Need help?" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.settings.help
    );
    await expect(accountSurface.getByRole("link", { name: "Talk to us" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.settings.talkToUs
    );
    await expect(accountSurface.getByRole("link", { name: "About Almidy" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.settings.about
    );
    await expect(accountSurface.getByRole("link", { name: "My Almidy Book" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.trips.stats
    );
    await expect(accountSurface.getByRole("link", { name: "My Trips" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.trips.list
    );
    for (const label of [
      "Add Reservations via Email",
      "Calendar Feed",
      "Storage and Data",
      "Redeem 15 Days Free",
      "Billing"
    ]) {
      await expect(
        accountSurface
          .getByText(label, { exact: true })
          .locator("xpath=ancestor::*[@aria-disabled='true'][1]"),
        `${label} is visibly disabled`
      ).toHaveCount(1);
    }
    await expect(accountSurface.getByRole("heading", { exact: true, name: "Account deletion" })).toBeVisible();
  });

  test("About Almidy has a real public destination", async ({ page }) => {
    await page.goto(`${baseUrl}${dashboardActionRoutes.settings.about}`, { waitUntil: "commit" });

    await expect(page.getByRole("heading", { name: "Plan travel with confidence" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account settings" })).toHaveAttribute(
      "href",
      dashboardActionRoutes.settings.account
    );
  });

  test("visible enabled dashboard button controls have an affordance or explicit contract", async ({ page }) => {
    const routes = ["/dashboard", "/dashboard/plan", "/dashboard/trips", "/dashboard/account"];
    const allowedLabels = new Set([
      "Accept 15 Days Free",
      "Collapse sidebar",
      "Close settings",
      "Close trial availability",
      "Collapse trips sheet",
      "Dismiss reservation importer card",
      "Dismiss pro card",
      "Expand trips sheet",
      "Open navigation",
      "Open settings",
      "Paste link",
      "Paste note",
      "Review idea",
      "Switch to dark mode",
      "Switch to light mode",
      "Use current location"
    ]);
    const failures: string[] = [];

    await page.setViewportSize({ width: 390, height: 900 });
    for (const route of routes) {
      await openDashboardRoute(page, route);
      failures.push(...await findUnsupportedVisibleButtons(page, route, allowedLabels));
    }

    expect(failures).toEqual([]);
  });
});

async function openDashboardRoute(page: Page, path: string) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "commit" });
  await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
  await suppressNextDevToolsPointerLayer(page);
}

async function suppressNextDevToolsPointerLayer(page: Page) {
  await page
    .addStyleTag({
      content: "nextjs-portal { pointer-events: none !important; }"
    })
    .catch(() => undefined);
}

async function findUnsupportedVisibleButtons(page: Page, route: string, allowedLabels: Set<string>) {
  return page.locator('button[type="button"]:visible').evaluateAll((buttons, args) => {
    const allowed = new Set(args.allowedLabels);
    return buttons.flatMap((button) => {
      const typedButton = button as HTMLButtonElement;
      if (typedButton.disabled || button.getAttribute("aria-disabled") === "true") {
        return [];
      }

      const label =
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.textContent?.replace(/\s+/g, " ").trim() ||
        "";
      const hasStateContract =
        button.hasAttribute("aria-controls") ||
        button.hasAttribute("aria-expanded") ||
        button.hasAttribute("data-testid") ||
        Boolean(button.closest("form"));

      if (!label) {
        return [`${args.route}: visible enabled button is missing an accessible label`];
      }

      if (!hasStateContract && !allowed.has(label)) {
        return [`${args.route}: visible enabled button "${label}" is not covered by an action affordance`];
      }

      return [];
    });
  }, { allowedLabels: [...allowedLabels], route });
}
