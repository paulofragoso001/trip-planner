import type { TripOverviewV1 } from "@/lib/contracts/trip-overview-v1";

export function projectCanonicalTripOverview(overview: TripOverviewV1) {
  const currencies = overview.expenseSummary.currencies;
  const sectionErrors = [
    overview.itinerarySummary.error,
    overview.documentsPreview.error,
    overview.expenseSummary.error,
    overview.recentItems.error
  ].filter((value): value is string => Boolean(value));

  return {
    canonical: overview,
    loadState: sectionErrors.length ? "partial" as const : "loaded" as const,
    actualLabel: currencies.length === 1 ? currencies[0].totalLabel : currencies.length > 1 ? `${currencies.length} currencies` : "No expenses",
    actionSummary: { hasFlight: false, hasLodging: false, hasRestaurantOrPlace: false },
    dateRange: overview.trip.dateRange,
    destination: overview.trip.destination,
    documentsPreview: overview.documentsPreview.items.map((item) => ({ href: item.href, id: item.id, metaLabel: item.date || item.type, title: item.title, typeLabel: item.type })),
    error: sectionErrors[0] || null,
    expenseCategories: currencies.flatMap((currency) => currency.categories.map((category) => ({ amountLabel: category.amountLabel, id: `${currency.currency}:${category.key}`, label: category.label }))),
    flightPreview: null,
    hasExpenses: currencies.length > 0,
    heroImage: { fallbackGradient: "bg-[linear-gradient(145deg,#3a3937,#201f20)]", imageAlt: overview.hero.alt, imageAttribution: overview.hero.attribution, imageSourceLabel: overview.hero.sourceLabel, imageUrl: overview.hero.imageUrl },
    itineraryPreview: [],
    mappedCount: 0,
    mapPreviewItems: [],
    nextUp: null,
    notes: null,
    plannedLabel: `${overview.itinerarySummary.exactCount} activities`,
    recentItems: overview.recentItems.items.map((item) => ({ createdAt: item.createdAt, href: item.href, id: item.id, title: item.title, typeLabel: item.category })),
    remainingLabel: overview.trip.relativeTiming || overview.trip.status,
    routePreview: null,
    segmentCount: overview.itinerarySummary.exactCount,
    status: overview.trip.status,
    statusLabel: overview.trip.relativeTiming,
    suggestionsCount: 0,
    title: overview.trip.title,
    tripId: overview.trip.id
  };
}
