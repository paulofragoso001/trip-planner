import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const workerSecret =
  process.env.CALENDAR_SYNC_WORKER_SECRET ||
  process.env.FLIGHT_REFRESH_CRON_SECRET ||
  readLocalEnv("CALENDAR_SYNC_WORKER_SECRET") ||
  readLocalEnv("FLIGHT_REFRESH_CRON_SECRET");

test("calendar worker rejects missing or invalid worker secret", async ({ request }) => {
  const missing = await request.post(`${baseUrl}/api/calendar/worker`);
  expect([401, 501]).toContain(missing.status());

  const invalid = await request.post(`${baseUrl}/api/calendar/worker`, {
    headers: {
      "x-calendar-sync-secret": "invalid-secret"
    }
  });
  expect([401, 501]).toContain(invalid.status());
});

function readLocalEnv(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return "";
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));

  if (!line) {
    return "";
  }

  return line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim();
}

test("calendar worker protected integration path responds with canonical payload", async ({
  request
}) => {
  test.skip(!workerSecret, "calendar worker integration requires CALENDAR_SYNC_WORKER_SECRET.");

  const response = await request.post(`${baseUrl}/api/calendar/worker`, {
    headers: {
      "x-calendar-sync-secret": workerSecret!
    }
  });

  expect([200, 501]).toContain(response.status());
  const payload = await response.json();

  if (response.status() === 200) {
    expect(payload).toMatchObject({
      data: {
        worker: {
          status: expect.any(String)
        }
      },
      error: null
    });
  } else {
    expect(payload).toMatchObject({
      data: null,
      error: {
        code: "not_implemented"
      }
    });
  }
});
