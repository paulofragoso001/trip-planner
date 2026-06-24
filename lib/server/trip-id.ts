import "server-only";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDemoTripId(tripId: string) {
  return tripId === "demo" && isDemoDataEnabled();
}

export function isDemoDataEnabled() {
  if (process.env.ALLOW_TEST_DASHBOARD_BYPASS === "true") {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return process.env.ALMIDY_ENABLE_DEMO_DATA === "true" && process.env.VERCEL_ENV !== "production";
}

export function isUuid(value: string) {
  return uuidPattern.test(value);
}
