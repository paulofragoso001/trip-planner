import { createMockTripItBundle, tripItBundleToPreviewData } from "@/mocks/tripitFactory";

export const barcelonaTripItBundle = createMockTripItBundle({ days: 5, seed: 20260503 });
export const barcelonaTrip = tripItBundleToPreviewData(barcelonaTripItBundle);

export const mobileTrip = tripItBundleToPreviewData(
  createMockTripItBundle({ days: 3, seed: 20260504 })
);

export const printTrip = tripItBundleToPreviewData(
  createMockTripItBundle({ days: 4, seed: 20260505 })
);

export const emptyTrip = {
  ...tripItBundleToPreviewData(createMockTripItBundle({ days: 1, seed: 20260506 })),
  plans: [],
  weather: [],
  directions: []
};
