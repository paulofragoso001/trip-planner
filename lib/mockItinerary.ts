import type {
  DailyWeather,
  DirectionLeg,
  PlanType,
  TripPlan,
  TripPreviewData
} from "@/components/trip-preview";

const planTypes: PlanType[] = ["flight", "hotel", "activity", "transport", "meeting", "note"];
const weatherSummaries = ["Sunny", "Cloudy", "Light rain", "Warm", "Breezy"];
const barcelonaStops = [
  { title: "Arrive at Barcelona-El Prat", location: "Barcelona Airport", lat: 41.2974, lng: 2.0833 },
  { title: "Check in at Eixample hotel", location: "Eixample", lat: 41.3917, lng: 2.1649 },
  { title: "Client kickoff", location: "Passeig de Gracia", lat: 41.3925, lng: 2.1649 },
  { title: "Dinner in El Born", location: "El Born", lat: 41.3851, lng: 2.1829 },
  { title: "Sagrada Familia visit", location: "Sagrada Familia", lat: 41.4036, lng: 2.1744 },
  { title: "Departure prep", location: "Barcelona", lat: 41.3874, lng: 2.1686 }
];

type MockOptions = {
  days?: number;
  minPlansPerDay?: number;
  maxPlansPerDay?: number;
  includeCoordinates?: boolean;
};

export function createMockTripPreview(options: MockOptions = {}): TripPreviewData {
  const days = clamp(options.days ?? 4, 1, 7);
  const minPlans = clamp(options.minPlansPerDay ?? 2, 1, 5);
  const maxPlans = clamp(options.maxPlansPerDay ?? 4, minPlans, 5);
  const includeCoordinates = options.includeCoordinates ?? true;
  const plans: TripPlan[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const plansForDay = minPlans + ((dayIndex + 1) % (maxPlans - minPlans + 1));
    const dayLabel = `Day ${dayIndex + 1}`;

    for (let planIndex = 0; planIndex < plansForDay; planIndex += 1) {
      const stop = barcelonaStops[(dayIndex + planIndex) % barcelonaStops.length];
      const type = planTypes[(dayIndex + planIndex) % planTypes.length];
      const hour = 8 + planIndex * 3;

      plans.push({
        id: `day-${dayIndex + 1}-plan-${planIndex + 1}`,
        type,
        title: type === "flight" ? "Flight to Barcelona" : stop.title,
        time: `${String(hour).padStart(2, "0")}:00`,
        endTime: `${String(hour + 1).padStart(2, "0")}:30`,
        location: stop.location,
        notes: planIndex === 0 ? "Keep confirmation details handy." : undefined,
        lat: includeCoordinates ? stop.lat : undefined,
        lng: includeCoordinates ? stop.lng : undefined,
        dayLabel
      });
    }
  }

  const pinnedPlans = plans.filter(
    (plan) => typeof plan.lat === "number" && typeof plan.lng === "number"
  );
  const directions: DirectionLeg[] = pinnedPlans.slice(0, -1).map((plan, index) => ({
    id: `leg-${index + 1}`,
    fromPlanId: plan.id,
    toPlanId: pinnedPlans[index + 1].id,
    summary: "Suggested route between itinerary stops.",
    distance: `${2 + index} mi`,
    duration: `${12 + index * 3} min`,
    mapNote: "Verify traffic before departure."
  }));
  const weather: DailyWeather[] = Array.from({ length: days }, (_, index) => ({
    dayLabel: `Day ${index + 1}`,
    summary: weatherSummaries[index % weatherSummaries.length],
    high: 72 + index,
    low: 58 + index
  }));

  return {
    title: "Barcelona work trip",
    destination: "Barcelona",
    dateRange: "Jun 1 - Jun 5, 2026",
    plans,
    weather,
    directions
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
