import { expect, test } from "@playwright/test";
import {
  hydrateMobileGlobeWalletRoute,
  popMobileGlobeWalletLayer,
  pushMobileGlobeWalletLayer,
  replaceMobileGlobeWalletLayer,
  syncUrlFromLayer,
  type MobileGlobeWalletLayer
} from "../../lib/mobile-globe-wallet/route-hydration";

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
      },
      {
        activeLayer: "flights",
        path: "/dashboard/trips/demo/flights",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>flights"
      },
      {
        activeLayer: "stays",
        path: "/dashboard/trips/demo/stays",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>stays"
      },
      {
        activeLayer: "activityDetail",
        path: "/dashboard/trips/demo/timeline/segment-123",
        selectedActivityId: "segment-123",
        selectedTripId: "demo",
        stack: "myTrips>tripOverview>itinerary>activityDetail"
      },
      {
        activeLayer: "settings",
        path: "/dashboard/account",
        selectedTripId: null,
        stack: "settings"
      }
    ];

    for (const routeExpectation of routeExpectations) {
      const hydration = hydrateMobileGlobeWalletRoute(routeExpectation.path);

      expect(hydration.activeLayer.kind).toBe(routeExpectation.activeLayer);
      expect(hydration.selection.activityId).toBe(routeExpectation.selectedActivityId ?? null);
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

  test("supports typed stack push, pop, replace, and URL sync helpers", () => {
    const baseStack = hydrateMobileGlobeWalletRoute("/dashboard/trips/demo").stack;
    const itineraryLayer: MobileGlobeWalletLayer = {
      id: "trip:demo:itinerary",
      kind: "itinerary",
      tripId: "demo"
    };
    const activityLayer: MobileGlobeWalletLayer = {
      id: "trip:demo:activity:segment-123",
      itemId: "segment-123",
      kind: "activityDetail",
      tripId: "demo"
    };

    const itineraryStack = pushMobileGlobeWalletLayer(baseStack, itineraryLayer);
    expect(itineraryStack.map((layer) => layer.kind).join(">")).toBe("myTrips>tripOverview>itinerary");
    expect(syncUrlFromLayer(itineraryLayer, itineraryStack)).toBe("/dashboard/trips/demo/timeline");

    const activityStack = pushMobileGlobeWalletLayer(itineraryStack, activityLayer);
    expect(activityStack.map((layer) => layer.kind).join(">")).toBe(
      "myTrips>tripOverview>itinerary>activityDetail"
    );
    expect(syncUrlFromLayer(activityLayer, activityStack)).toBe(
      "/dashboard/trips/demo/timeline/segment-123"
    );

    const placesStack = replaceMobileGlobeWalletLayer(activityStack, {
      id: "trip:demo:places",
      kind: "places",
      tripId: "demo"
    });
    expect(placesStack.map((layer) => layer.kind).join(">")).toBe("myTrips>tripOverview>itinerary>places");
    expect(syncUrlFromLayer(placesStack[placesStack.length - 1], placesStack)).toBe("/dashboard/trips/demo/ideas");

    const poppedStack = popMobileGlobeWalletLayer(placesStack);
    expect(poppedStack.map((layer) => layer.kind).join(">")).toBe("myTrips>tripOverview>itinerary");
  });
});
