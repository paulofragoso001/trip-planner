export const dashboardRoutes = {
  home: "/dashboard",
  trips: "/dashboard/trips",
  tripsList: "/dashboard/trips?view=list"
} as const;

export const dashboardCompatibilityViews = {
  trips: "trips"
} as const;

export const dashboardRouteContracts = [
  {
    id: "dashboard-home-launch-hub",
    route: dashboardRoutes.home,
    behavior: "Render the launch/globe hub with the collapsed Travel Wallet sheet."
  },
  {
    id: "dashboard-trips-canonical",
    route: dashboardRoutes.trips,
    behavior: "Render the canonical My Trips surface."
  },
  {
    id: "dashboard-trips-compatibility-view",
    route: `${dashboardRoutes.home}?view=${dashboardCompatibilityViews.trips}`,
    behavior: `Redirect to ${dashboardRoutes.trips}; compatibility only.`
  }
] as const;

export function resolveDashboardCompatibilityRedirect(view: string | null | undefined) {
  if (view === dashboardCompatibilityViews.trips) {
    return dashboardRoutes.trips;
  }

  return null;
}
