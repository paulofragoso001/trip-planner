export const itineraryTestIds = {
  page: "travel-dashboard-page",
  tripList: "trip-list",
  selectedTripPanel: "selected-trip-panel",
  itineraryTimeline: "itinerary-timeline",
  itinerarySummary: "itinerary-summary",
  itineraryStatus: "itinerary-status",
  itineraryAlert: "itinerary-alert",
  addPlanForm: "add-plan-form",
  item: (id: string) => `itinerary-item-${id}`,
  handle: (id: string) => `itinerary-handle-${id}`,
  dropzone: (index: number) => `itinerary-dropzone-${index}`,
} as const;
