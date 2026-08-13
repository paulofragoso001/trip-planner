export const TRIP_OVERVIEW_FIRST_RELEASE_SCOPE = {
  hero: "include",
  itinerarySummary: "include",
  documentsPreview: "include-read-only",
  expenses: "include",
  latestAdded: "include-with-created-at",
  weatherPromotion: "omit",
  customization: "omit"
} as const;

export type TripOverviewActionKey = "newActivity" | "places" | "routes" | "flights" | "stays";

export type TripOverviewSupportedAction = {
  key: TripOverviewActionKey;
  label: string;
  available: boolean;
  href: string | null;
  handoff: "web" | "native-route" | null;
};

export function buildFirstReleaseTripOverviewActions(base: string): TripOverviewSupportedAction[] {
  return [
    { key: "newActivity", label: "New Activity", available: true, href: `${base}/timeline#new-plan`, handoff: "web" },
    { key: "places", label: "Places", available: true, href: `${base}/ideas`, handoff: "native-route" },
    { key: "routes", label: "Routes", available: true, href: `${base}/map`, handoff: "native-route" },
    { key: "flights", label: "Flights", available: false, href: null, handoff: null },
    { key: "stays", label: "Stays", available: false, href: null, handoff: null }
  ];
}

export function visibleTripOverviewActions(base: string) {
  return buildFirstReleaseTripOverviewActions(base).filter(
    (action): action is TripOverviewSupportedAction & { available: true; href: string } =>
      action.available && Boolean(action.href)
  );
}

export const IMPORTED_ITEMS_SECTION_TITLE = "Imported items";
