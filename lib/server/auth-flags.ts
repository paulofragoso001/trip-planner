import "server-only";

export function allowsDashboardTestBypass() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_TEST_DASHBOARD_BYPASS === "true"
  );
}

export function allowsLocalDashboardBypass() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_LOCAL_DASHBOARD_BYPASS === "true"
  );
}
