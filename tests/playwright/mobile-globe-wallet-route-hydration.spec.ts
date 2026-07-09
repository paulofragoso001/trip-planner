import { expect, test } from "@playwright/test";
import { hydrateMobileGlobeWalletRoute } from "../../lib/mobile-globe-wallet/route-hydration";

test.describe("mobile globe wallet route hydration", () => {
  test("maps mobile URLs to wallet layer stacks", () => {
    const routeExpectations = [
      {
        activeLayer: "launch",
        path: "/dashboard",
        selectedTripId: null,
        stack: "launch"
      },
      {
        activeLayer: "myTrips",
        path: "/dashboard/trips",
        selectedTripId: null,
        stack: "myTrips"
      },
      {
        activeLayer: "tripOverview",
        path: "/dashboard/trips/demo",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview"
      },
      {
        activeLayer: "itinerary",
        path: "/dashboard/trips/demo/timeline",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>itinerary"
      },
      {
        activeLayer: "routes",
        path: "/dashboard/trips/demo/map",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>routes"
      },
      {
        activeLayer: "places",
        path: "/dashboard/trips/demo/ideas",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>places"
      },
      {
        activeLayer: "budget",
        path: "/dashboard/trips/demo/budget",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>budget"
      },
      {
        activeLayer: "documents",
        path: "/dashboard/trips/demo/documents",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>documents"
      }
    ];

    for (const routeExpectation of routeExpectations) {
      const hydration = hydrateMobileGlobeWalletRoute(routeExpectation.path);

      expect(hydration.activeLayer.kind).toBe(routeExpectation.activeLayer);
      expect(hydration.selection.tripId).toBe(routeExpectation.selectedTripId);
      expect(hydration.stack.map((layer) => layer.kind).join(">")).toBe(routeExpectation.stack);
    }
  });

  test("keeps secondary trips list as a My Trips wallet layer", () => {
    const hydration = hydrateMobileGlobeWalletRoute(
      "/dashboard/trips",
      new URLSearchParams("view=list")
    );

    expect(hydration.activeLayer.kind).toBe("myTrips");
    expect(hydration.activeLayer.title).toBe("Trip list");
    expect(hydration.routeHref).toBe("/dashboard/trips?view=list");
    expect(hydration.stack.map((layer) => layer.kind).join(">")).toBe("myTrips>myTrips");
  });
});
