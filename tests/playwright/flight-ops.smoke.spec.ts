import { expect, test } from "@playwright/test";

const grafanaRule = {
  annotations: {
    description: "Stalled jobs have exceeded the critical threshold for 5 minutes.",
    summary: "Flight refresh workers are stalled"
  },
  enabled: true,
  execErrState: "Alerting",
  expr: "flight_refresh_worker_stalled_jobs_total > 5",
  folderUid: "flight-ops",
  for: "5m",
  labels: {
    queue: "flight-refresh",
    severity: "critical",
    team: "flight-ops"
  },
  noDataState: "OK",
  ruleGroup: "flight-workers",
  title: "Flight worker stalled jobs",
  uid: "flight-worker-stalled"
};

test.describe("Flight Ops smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          queue: {
            active: 1,
            completed: 14,
            delayed: 0,
            failed: 0,
            healthy: true,
            lastCheckedAt: "2026-05-07T20:00:00.000Z",
            oldestActiveAgeMs: null,
            oldestWaitingAgeMs: null,
            queue: "flight-refresh",
            stalled: 0,
            waiting: 2
          },
          service: "flight-refresh-monitor",
          status: "healthy",
          timestamp: "2026-05-07T20:00:00.000Z"
        },
        status: 200
      });
    });
  });

  test("loads the command center and queue health cards", async ({ page }) => {
    await page.goto("/flight-ops");

    await expect(page.getByText("Flight operations command center")).toBeVisible();
    await expect(page.getByText("Queue health")).toBeVisible();
    await expect(page.getByText("Waiting")).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();
  });

  test("loads Cirium-backed live track data and updates aircraft marker state", async ({ page }) => {
    await page.route("**/api/cirium/flight-track?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          track: {
            position: {
              altitude: 31000,
              bearing: 92,
              lat: 25.7617,
              lng: -80.1918,
              speed: 482,
              timestamp: "2026-05-07T20:00:00.000Z"
            }
          }
        },
        status: 200
      });
    });

    await page.goto("/flight-ops?tripId=trip-123&flightId=flight-123");

    await expect(page.getByText("Position details")).toBeVisible();
    await expect(page.getByText("25.76170")).toBeVisible();
    await expect(page.getByText("-80.19180")).toBeVisible();
    await expect(page.getByText("92 degrees")).toBeVisible();
  });

  test("shows a safe stale-data fallback when live track has no position", async ({ page }) => {
    await page.route("**/api/cirium/flight-track?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { track: null },
        status: 200
      });
    });

    await page.goto("/flight-ops?tripId=trip-123&flightId=flight-404");

    await expect(page.getByText("Position details")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("keeps the dashboard stable when Cirium returns a missing flight", async ({ page }) => {
    await page.route("**/api/cirium/flight-track?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { error: "Flight not found" },
        status: 404
      });
    });

    await page.goto("/flight-ops?tripId=trip-123&flightId=missing-flight");

    await expect(page.getByText("Flight operations command center")).toBeVisible();
    await expect(page.getByText("Position details")).toBeVisible();
  });

  test("supports Cirium-style GraphQL flight box mocks", async ({ page }) => {
    await page.route("**/graphql", async (route) => {
      const body = route.request().postDataJSON() as { operationName?: string };

      if (body.operationName === "FlightBox") {
        await route.fulfill({
          contentType: "application/json",
          json: {
            data: {
              flightBox: {
                bearing: 92,
                id: "fx123",
                lat: 25.7617,
                lng: -80.1918,
                speed: 430
              }
            }
          },
          status: 200
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        json: { data: {} },
        status: 200
      });
    });

    await page.goto("/flight-ops");

    const response = await page.evaluate(async () => {
      const res = await fetch("/graphql", {
        body: JSON.stringify({
          operationName: "FlightBox",
          query: "query FlightBox { flightBox { id lat lng bearing speed } }"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      return res.json();
    });

    expect(response.data.flightBox).toMatchObject({
      bearing: 92,
      id: "fx123",
      lat: 25.7617,
      lng: -80.1918
    });
  });

  test("updates Grafana alert thresholds through the API proxy", async ({ page }) => {
    let savePayload: unknown = null;

    await page.route("**/api/grafana/alert-rules**", async (route) => {
      if (route.request().method() === "POST") {
        savePayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          json: {
            auditRecord: {
              action: "save",
              id: "audit-1",
              timestamp: "2026-05-07T20:00:00.000Z",
              title: grafanaRule.title,
              user: "operator"
            },
            grafana: { ok: true },
            ok: true
          },
          status: 200
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        json: {
          auditTrail: [],
          configured: true,
          rules: [grafanaRule],
          source: "grafana"
        },
        status: 200
      });
    });

    await page.goto("/flight-ops");

    await expect(page.getByTestId("grafana-alert-control-panel")).toBeVisible();
    await page.getByTestId("grafana-save-rule").click();
    await expect(page.getByText("Grafana provisioning API accepted the change.")).toBeVisible();
    expect(savePayload).toMatchObject({
      action: "save",
      rule: {
        title: "Flight worker stalled jobs",
        uid: "flight-worker-stalled"
      }
    });
  });

  test("recovers from an expired Grafana session once", async ({ page }) => {
    let grafanaCalls = 0;
    let refreshCalls = 0;

    await page.route("**/api/grafana/alert-rules**", async (route) => {
      grafanaCalls += 1;
      if (grafanaCalls === 1) {
        await route.fulfill({
          body: "expired",
          status: 401
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        json: {
          auditTrail: [],
          configured: true,
          rules: [{ ...grafanaRule, title: "Recovered Grafana rule" }],
          source: "grafana"
        },
        status: 200
      });
    });

    await page.route("**/api/auth/refresh", async (route) => {
      refreshCalls += 1;
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true },
        status: 200
      });
    });

    await page.goto("/flight-ops");

    await expect(page.getByText("Recovered Grafana rule")).toBeVisible();
    expect(grafanaCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });
});
