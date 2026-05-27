import { TripPreviewPage } from "@/components/trip-preview/TripPreviewPage";
import { createMockTripPreview } from "@/lib/mockItinerary";

export default function TripPreviewDemoPage() {
  const preview = createMockTripPreview({ days: 4, minPlansPerDay: 2, maxPlansPerDay: 4 });

  return <TripPreviewPage {...preview} />;
}
