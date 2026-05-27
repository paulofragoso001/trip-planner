import { expect, test } from "@playwright/test";

const healthyQueue = {
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
};

test("aircraft marker updates to the latest Cirium position", async ({ page }) => {
  let ciriumCalls = 0;

  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        queue: healthyQueue,
        service: "flight-refresh-monitor",
        status: "healthy",
        timestamp: "2026-05-07T20:00:00.000Z"
      },
      status: 200
    });
  });

  await page.route("**/api/stream/metrics", async (route) => {
    await route.fulfill({
      body: [
        "event: connected",
        `data: ${JSON.stringify({ ok: true, timestamp: "2026-05-07T20:00:00.000Z" })}`,
        "",
        "event: metrics",
        `data: ${JSON.stringify({
          health: {
            queue: healthyQueue,
            service: "flight-refresh-monitor",
            status: "healthy",
            timestamp: "2026-05-07T20:00:01.000Z"
          },
          timestamp: "2026-05-07T20:00:01.000Z",
          type: "metrics"
        })}`,
        "",
        "event: metrics",
        `data: ${JSON.stringify({
          health: {
            queue: healthyQueue,
            service: "flight-refresh-monitor",
            status: "healthy",
            timestamp: "2026-05-07T20:00:02.000Z"
          },
          timestamp: "2026-05-07T20:00:02.000Z",
          type: "metrics"
        })}`,
        "",
        ""
      ].join("\n"),
      contentType: "text/event-stream",
      status: 200
    });
  });

  await page.route("**/api/cirium/**", async (route) => {
    ciriumCalls += 1;
    const position =
      ciriumCalls === 1
        ? { bearing: 90, lat: 25.7617, lng: -80.1918, speed: 430 }
        : { bearing: 100, lat: 25.774, lng: -80.185, speed: 435 };

    await route.fulfill({
      contentType: "application/json",
      json: { track: { position } },
      status: 200
    });
  });

  await page.goto("/flight-ops?tripId=trip-123&flightId=flight-123");

  await expect(page.getByText("Live aircraft")).toBeVisible();
  await expect(page.getByText("25.77400")).toBeVisible();
  await expect(page.getByText("-80.18500")).toBeVisible();
  await expect(page.getByText("100 degrees")).toBeVisible();
  expect(ciriumCalls).toBeGreaterThanOrEqual(2);
});

test("filters alerts by provider and auto-acks resolved issues", async ({ page }) => {
  let ackPayload: unknown = null;

  await page.route("**/api/alerts", async (route) => {
    if (route.request().method() === "POST") {
      ackPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true },
        status: 200
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        alerts: [
          {
            id: "1",
            summary: "Canary finished and returned to healthy.",
            severity: "info",
            source: "slack",
            status: "resolved",
            title: "Slack rollout update"
          },
          {
            id: "2",
            incidentKey: "flight-ops-canary",
            summary: "Canary error budget breached.",
            severity: "critical",
            source: "pagerduty",
            status: "firing",
            title: "PagerDuty critical canary incident"
          },
          {
            id: "3",
            summary: "Daily validation summary posted.",
            severity: "info",
            source: "teams",
            status: "resolved",
            title: "Teams validation update"
          }
        ]
      },
      status: 200
    });
  });

  await page.goto("/flight-ops/alerts");

  await page.getByRole("button", { name: "PagerDuty" }).click();
  await expect(page.getByText("PagerDuty critical canary incident")).toBeVisible();
  await expect(page.getByText("firing")).toBeVisible();
  await expect(page.getByText("Incident key: flight-ops-canary")).toBeVisible();
  await expect(page.getByText("Slack rollout update")).not.toBeVisible();
  await page.getByRole("button", { name: "Ack" }).click();
  await expect(page.getByText("acked")).toBeVisible();
  expect(ackPayload).toMatchObject({
    action: "ack",
    id: "2",
    severity: "critical",
    source: "pagerduty"
  });

  await page.getByRole("button", { name: "Slack" }).click();
  await expect(page.getByText("Slack rollout update")).toBeVisible();
  await expect(page.getByText("acked")).toBeVisible();
  await expect(page.getByText("Auto-acked after resolution")).toBeVisible();
});
