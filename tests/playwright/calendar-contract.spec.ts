import { expect, test, type APIRequestContext } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };
const testOAuthCode = "__wayline_oauth_test_code__";

test("calendar contract routes expose expected provider behavior", async ({ request }) => {
  test.setTimeout(60_000);

  const google = await request.get(
    `${baseUrl}/api/calendar/oauth/google?redirect=%2Fdashboard%2Ftrips%2Fdemo%2Ftimeline`
  );
  const outlook = await request.get(`${baseUrl}/api/calendar/oauth/outlook`);

  const googlePayload = await google.json();
  expect([200, 501]).toContain(google.status());
  expect(googlePayload).toMatchObject({
    data: {
      configured: google.status() === 200,
      provider: "google"
    },
    error: null
  });

  if (google.status() === 200) {
    expect(googlePayload.data.authUrl).toContain("https://accounts.google.com/");
    expect(google.headers()["set-cookie"]).toContain("wayline_calendar_oauth_state=");
    expect(google.headers()["set-cookie"].toLowerCase()).toContain("httponly");

    const authUrl = new URL(googlePayload.data.authUrl);
    const state = authUrl.searchParams.get("state");

    expect(state).toBeTruthy();
    expect(state).not.toBe("/dashboard/trips/demo/timeline");
    expect(decodeURIComponent(googlePayload.data.authUrl)).not.toContain(
      "state=/dashboard/trips/demo/timeline"
    );
  } else {
    expect(googlePayload).toMatchObject({
      data: {
        requiredEnv: [
          "GOOGLE_CALENDAR_CLIENT_ID",
          "GOOGLE_CALENDAR_CLIENT_SECRET",
          "GOOGLE_CALENDAR_REDIRECT_URI"
        ]
      }
    });
  }

  const outlookPayload = await outlook.json();
  expect([200, 501]).toContain(outlook.status());
  expect(outlookPayload).toMatchObject({
    data: {
      configured: outlook.status() === 200,
      provider: "outlook"
    },
    error: null
  });

  if (outlook.status() === 200) {
    expect(outlookPayload.data.authUrl).toContain("https://login.microsoftonline.com/");
  } else {
    expect(outlookPayload).toMatchObject({
      data: {
        requiredEnv: [
          "MICROSOFT_CALENDAR_CLIENT_ID",
          "MICROSOFT_CALENDAR_CLIENT_SECRET",
          "MICROSOFT_CALENDAR_REDIRECT_URI"
        ]
      }
    });
  }

  const unauthenticatedSync = await request.post(`${baseUrl}/api/calendar/sync`, {
    data: {
      calendarId: "primary",
      provider: "google",
      tripId: "demo"
    }
  });

  expect(unauthenticatedSync.status()).toBe(401);
  expect(await unauthenticatedSync.json()).toMatchObject({
    data: null,
    error: { code: "unauthorized" }
  });

  const demoSync = await request.post(`${baseUrl}/api/calendar/sync`, {
    data: {
      calendarId: "primary",
      provider: "google",
      tripId: "demo"
    },
    headers: dashboardHeaders
  });

  expect([200, 409]).toContain(demoSync.status());

  const demoSyncPayload = await demoSync.json();
  if (demoSync.status() === 200) {
    expect(demoSyncPayload).toMatchObject({
      data: {
        calendarSync: {
          provider: "google",
          staged: expect.any(Number)
        }
      },
      error: null
    });
  } else {
    expect(demoSyncPayload).toMatchObject({
      data: null,
      error: {
        code: "not_implemented",
        details: {
          provider: "google"
        }
      }
    });
  }

  const workerWithoutSecret = await request.post(`${baseUrl}/api/calendar/worker`);
  const workerPayload = await workerWithoutSecret.json();

  expect([401, 501]).toContain(workerWithoutSecret.status());

  if (workerWithoutSecret.status() === 401) {
    expect(workerPayload).toMatchObject({
      data: null,
      error: { code: "unauthorized" }
    });
  } else {
    expect(workerPayload).toMatchObject({
      data: null,
      error: {
        code: "not_implemented",
        message: "CALENDAR_SYNC_WORKER_SECRET is not configured."
      }
    });
  }
});

test("calendar callback with valid test state restores the original route", async ({
  request
}) => {
  const start = await startGoogleOAuth(request);
  test.skip(!start, "Google Calendar OAuth env is not configured for callback contract.");

  const callback = await request.get(
    `${baseUrl}/api/calendar/oauth/google/callback?code=${testOAuthCode}&state=${encodeURIComponent(
      start!.state
    )}`,
    {
      headers: {
        ...dashboardHeaders,
        cookie: start!.cookie
      },
      maxRedirects: 0
    }
  );

  expect([302, 303, 307, 308]).toContain(callback.status());

  const location = callback.headers()["location"] || "";
  expect(location).toContain("/dashboard/trips/demo/timeline");
  expect(location).toContain("calendarProvider=google");
  expect(location).toContain("calendarStatus=connected");
});

test("calendar callback rejects missing and mismatched state cookies", async ({ request }) => {
  const first = await startGoogleOAuth(request);
  const second = await startGoogleOAuth(request);
  test.skip(
    !first || !second,
    "Google Calendar OAuth env is not configured for callback contract."
  );

  const missingCookie = await request.get(
    `${baseUrl}/api/calendar/oauth/google/callback?code=${testOAuthCode}&state=${encodeURIComponent(
      first!.state
    )}`,
    {
      headers: {
        ...dashboardHeaders,
        cookie: ""
      },
      maxRedirects: 0
    }
  );

  expect(missingCookie.status()).toBe(400);
  await expectStateFailure(missingCookie, "missing_state_cookie");

  const mismatched = await request.get(
    `${baseUrl}/api/calendar/oauth/google/callback?code=${testOAuthCode}&state=${encodeURIComponent(
      second!.state
    )}`,
    {
      headers: {
        ...dashboardHeaders,
        cookie: first!.cookie
      },
      maxRedirects: 0
    }
  );

  expect(mismatched.status()).toBe(400);
  await expectStateFailure(mismatched, "state_mismatch");
});

test("unsafe calendar redirect target falls back to timeline", async ({ request }) => {
  const start = await startGoogleOAuth(request, "https%3A%2F%2Fevil.example");
  test.skip(!start, "Google Calendar OAuth env is not configured for callback contract.");

  const callback = await request.get(
    `${baseUrl}/api/calendar/oauth/google/callback?code=${testOAuthCode}&state=${encodeURIComponent(
      start!.state
    )}`,
    {
      headers: {
        ...dashboardHeaders,
        cookie: start!.cookie
      },
      maxRedirects: 0
    }
  );

  expect([302, 303, 307, 308]).toContain(callback.status());

  const location = callback.headers()["location"] || "";
  expect(location).toContain("/dashboard/trips/demo/timeline");
  expect(location).not.toContain("evil.example");
});

async function startGoogleOAuth(
  request: APIRequestContext,
  redirect = "%2Fdashboard%2Ftrips%2Fdemo%2Ftimeline"
) {
  const response = await request.get(
    `${baseUrl}/api/calendar/oauth/google?redirect=${redirect}`
  );

  if (response.status() !== 200) {
    return null;
  }

  const payload = await response.json();
  const authUrl = new URL(payload.data.authUrl);
  const state = authUrl.searchParams.get("state");
  const cookie = response.headers()["set-cookie"] || "";

  expect(state).toBeTruthy();
  expect(cookie).toContain("wayline_calendar_oauth_state=");

  return {
    cookie,
    state: state!
  };
}

async function expectStateFailure(response: { json: () => Promise<unknown> }, reason: string) {
  expect(await response.json()).toMatchObject({
    data: null,
    error: {
      code: "validation_error",
      details: {
        provider: "google",
        reason
      },
      message: "Calendar OAuth state validation failed."
    }
  });
}
