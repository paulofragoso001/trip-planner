import { faker } from "@faker-js/faker";
import type { DirectionLeg, TripPlan, TripPreviewData } from "@/components/trip-preview";
import type {
  TripItActivity,
  TripItAir,
  TripItDayBundle,
  TripItLodging,
  TripItTripBundle,
  TripItWeather
} from "@/api/tripit";

type MockTripOptions = {
  days?: number;
  seed?: number;
};

const barcelonaStops = [
  { city: "Barcelona", location: "Barcelona-El-Prat Airport", lat: 41.2974, lng: 2.0833 },
  { city: "Barcelona", location: "Eixample", lat: 41.3917, lng: 2.1649 },
  { city: "Barcelona", location: "Passeig de Gracia", lat: 41.3925, lng: 2.1649 },
  { city: "Barcelona", location: "El Born", lat: 41.3851, lng: 2.1829 },
  { city: "Barcelona", location: "Sagrada Familia", lat: 41.4036, lng: 2.1744 },
  { city: "Barcelona", location: "Barceloneta", lat: 41.3809, lng: 2.1898 }
];

const weatherConditions = ["Sunny", "Cloudy", "Warm", "Light rain", "Breezy"];

export function createMockTrip(days = 4, options: Omit<MockTripOptions, "days"> = {}) {
  return createMockTripItBundle({ days, ...options });
}

export function createMockTripItBundle(options: MockTripOptions = {}): TripItTripBundle {
  const days = clamp(options.days ?? 4, 1, 7);
  faker.seed(options.seed ?? days * 1009);

  const tripId = faker.string.uuid();
  const startDate = new Date("2026-06-01T08:00:00.000Z");
  const endDate = addDays(startDate, days - 1);

  return {
    id: tripId,
    displayname: "Barcelona work trip",
    startdate: isoDate(startDate),
    enddate: isoDate(endDate),
    primarylocation: "Barcelona",
    objects: Array.from({ length: days }, (_, index) =>
      createDayBundle(tripId, index, addDays(startDate, index))
    )
  };
}

export function tripItBundleToPreviewData(bundle: TripItTripBundle): TripPreviewData {
  const plans: TripPlan[] = [];
  const weather = bundle.objects.flatMap((day) =>
    day.weather
      ? [
          {
            dayLabel: day.dayLabel,
            summary: day.weather.condition || day.weather.displayname,
            high: day.weather.avghightempc,
            low: day.weather.avglowtempc
          }
        ]
      : []
  );

  bundle.objects.forEach((day) => {
    if (day.air) {
      plans.push({
        id: day.air.id,
        type: "flight",
        title: day.air.displayname,
        time: getTime(day.air.startdatetime),
        endTime: getTime(day.air.enddatetime),
        location: [day.air.startcityname, day.air.endcityname].filter(Boolean).join(" to "),
        notes: day.air.flightstatus ? `Flight status: ${day.air.flightstatus}` : undefined,
        lat: day.air.endlat,
        lng: day.air.endlng,
        dayLabel: day.dayLabel
      });
    }

    if (day.lodging) {
      plans.push({
        id: day.lodging.id,
        type: "hotel",
        title: day.lodging.displayname,
        location: day.lodging.location,
        notes: [day.lodging.startdate, day.lodging.enddate].filter(Boolean).join(" to "),
        lat: day.lodging.lat,
        lng: day.lodging.lng,
        dayLabel: day.dayLabel
      });
    }

    if (day.activity) {
      plans.push({
        id: day.activity.id,
        type: "activity",
        title: day.activity.displayname,
        time: getTime(day.activity.startdatetime),
        endTime: getTime(day.activity.enddatetime),
        location: day.activity.location,
        notes: day.activity.notes,
        lat: day.activity.lat,
        lng: day.activity.lng,
        dayLabel: day.dayLabel
      });
    }
  });

  const pinnedPlans = plans.filter(
    (plan) => typeof plan.lat === "number" && typeof plan.lng === "number"
  );
  const directions: DirectionLeg[] = pinnedPlans.slice(0, -1).map((plan, index) => ({
    id: `direction-${index + 1}`,
    fromPlanId: plan.id,
    toPlanId: pinnedPlans[index + 1].id,
    summary: "TripIt-style route between selected plans.",
    distance: `${2 + index} km`,
    duration: `${10 + index * 4} min`,
    mapNote: "Check live traffic before leaving."
  }));

  return {
    title: bundle.displayname,
    destination: bundle.primarylocation,
    dateRange: [bundle.startdate, bundle.enddate].filter(Boolean).join(" to "),
    plans,
    weather,
    directions
  };
}

function createDayBundle(tripId: string, index: number, date: Date): TripItDayBundle {
  const stop = barcelonaStops[index % barcelonaStops.length];
  const hotelStop = barcelonaStops[(index + 1) % barcelonaStops.length];
  const activityStop = barcelonaStops[(index + 2) % barcelonaStops.length];
  const dayLabel = `Day ${index + 1}`;

  const weather: TripItWeather = {
    id: faker.string.uuid(),
    tripid: tripId,
    displayname: `Weather - ${stop.city}`,
    date: isoDate(date),
    location: stop.city,
    condition: weatherConditions[index % weatherConditions.length],
    avghightempc: faker.number.int({ min: 20, max: 31 }),
    avglowtempc: faker.number.int({ min: 11, max: 19 })
  };

  const air: TripItAir = {
    id: faker.string.uuid(),
    tripid: tripId,
    displayname: index === 0 ? "Flight to Barcelona" : "Regional connection",
    flightstatus: faker.helpers.arrayElement(["on time", "delayed", "scheduled"]),
    startcityname: index === 0 ? "New York" : "Barcelona",
    endcityname: stop.city,
    startdatetime: withHour(date, 8).toISOString(),
    enddatetime: withHour(date, 10).toISOString(),
    startlat: index === 0 ? 40.6413 : stop.lat,
    startlng: index === 0 ? -73.7781 : stop.lng,
    endlat: stop.lat,
    endlng: stop.lng
  };

  const lodging: TripItLodging = {
    id: faker.string.uuid(),
    tripid: tripId,
    displayname: `${faker.company.name()} Hotel`,
    location: hotelStop.location,
    startdate: isoDate(date),
    enddate: isoDate(addDays(date, 1)),
    lat: hotelStop.lat,
    lng: hotelStop.lng
  };

  const activity: TripItActivity = {
    id: faker.string.uuid(),
    tripid: tripId,
    displayname: faker.helpers.arrayElement([
      "Client kickoff",
      "Architecture workshop",
      "Dinner with partners",
      "Museum visit",
      "Product review"
    ]),
    location: activityStop.location,
    startdatetime: withHour(date, 14).toISOString(),
    enddatetime: withHour(date, 16).toISOString(),
    notes: faker.helpers.arrayElement([
      "Bring confirmation details.",
      "Leave room for transit.",
      "Save receipts for expense report.",
      "Add photos after the plan."
    ]),
    lat: activityStop.lat,
    lng: activityStop.lng
  };

  return {
    dayLabel,
    weather,
    air,
    lodging,
    activity
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function withHour(date: Date, hour: number) {
  const next = new Date(date);
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTime(value?: string) {
  if (!value) return undefined;
  return value.slice(11, 16);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
