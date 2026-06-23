import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  compareHeroSegments,
  fallbackGradientForDestination,
  getFallbackHeroImage,
  imageFromProviderMetadata,
  type WalletHeroImage
} from "@/lib/wallet/hero-image";
import {
  mapWalletTripPass,
  summarizeWalletTripSegments,
  type WalletTripPassModel,
  type WalletTripSegmentCounts
} from "@/lib/wallet/trip-view-models";

export type TripListItemView = WalletTripPassModel;

export type TripsData = {
  error: string | null;
  heroImage: WalletHeroImage;
  trips: TripListItemView[];
};

type TripRow = {
  destination: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  end_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string | null;
  travel_style: string | null;
};

type TripSegmentSummary = {
  lat?: number | null;
  latitude?: number | null;
  location_status: string | null;
  lng?: number | null;
  longitude?: number | null;
  trip_id: string;
};

type TripRecommendationSummary = {
  trip_id: string;
};

type TripPassImage = {
  imageAlt: string;
  imageAttribution: string | null;
  imageUrl: string | null;
};

type TripVisualSegment = {
  kind: string | null;
  position: number | null;
  provider_metadata: Record<string, unknown> | null;
  title: string;
  trip_id: string;
};

export async function loadTripsData(): Promise<TripsData> {
  noStore();
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return {
      error: "Sign in to load your trips.",
      heroImage: getFallbackHeroImage("Wayline trips", "Wayline trips background"),
      trips: []
    };
  }

  const { data, error } = await loadTripRows(auth.supabase, auth.userId);

  if (error) {
    console.error(
      JSON.stringify({
        area: "trips",
        event: "trips_load_failed",
        message: error.message,
        userId: auth.userId
      })
    );

    return {
      error: "Could not load trips right now.",
      heroImage: getFallbackHeroImage("Wayline trips", "Wayline trips background"),
      trips: []
    };
  }

  const tripRows = ((data || []) as TripRow[]);
  const summaries = tripRows.length
    ? await loadTripSegmentSummaries(auth.supabase, tripRows.map((trip) => trip.id), auth.userId)
    : new Map<string, SegmentCounts>();
  const recommendationCounts = tripRows.length
    ? await loadTripRecommendationSummaries(auth.supabase, tripRows.map((trip) => trip.id), auth.userId)
    : new Map<string, number>();
  const passImages = tripRows.length
    ? await loadTripPassImages(auth.supabase, tripRows, auth.userId)
    : new Map<string, TripPassImage>();

  return {
    error: null,
    heroImage: buildTripsHeroImage(tripRows[0], passImages.get(tripRows[0]?.id || "")),
    trips: tripRows.map((row) =>
      mapTrip(
        row,
        summaries.get(row.id),
        recommendationCounts.get(row.id) || 0,
        passImages.get(row.id)
      )
    )
  };
}

async function loadTripRows(supabase: any, userId: string) {
  const withDestinationMetadata = await supabase
    .from("trips")
    .select("id,name,destination,destination_lat,destination_lng,start_date,end_date,status,travel_style,destination_provider_metadata")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!withDestinationMetadata.error) {
    return withDestinationMetadata;
  }

  if (isMissingDestinationCoordinateColumn(withDestinationMetadata.error.message)) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trips_load_destination_coordinates_fallback",
        message: withDestinationMetadata.error.message,
        userId
      })
    );

    const withoutDestinationCoordinates = await supabase
      .from("trips")
      .select("id,name,destination,start_date,end_date,status,travel_style,destination_provider_metadata")
      .eq("user_id", userId)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (
      !withoutDestinationCoordinates.error ||
      !isMissingDestinationMetadataColumn(withoutDestinationCoordinates.error.message)
    ) {
      return withoutDestinationCoordinates;
    }
  } else if (!isMissingDestinationMetadataColumn(withDestinationMetadata.error.message)) {
    return withDestinationMetadata;
  }

  console.warn(
    JSON.stringify({
      area: "trips",
      event: "trips_load_destination_metadata_fallback",
      message: withDestinationMetadata.error.message,
      userId
    })
  );

  const withTravelStyle = await supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status,travel_style")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!withTravelStyle.error || !isMissingTravelStyleColumn(withTravelStyle.error.message)) {
    return withTravelStyle;
  }

  console.warn(
    JSON.stringify({
      area: "trips",
      event: "trips_load_schema_fallback",
      message: withTravelStyle.error.message,
      userId
    })
  );

  return supabase
    .from("trips")
    .select("id,name,destination,start_date,end_date,status")
    .eq("user_id", userId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function isMissingDestinationMetadataColumn(message: string) {
  return /destination_provider_metadata/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function isMissingDestinationCoordinateColumn(message: string) {
  return /destination_lat|destination_lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

type SegmentCounts = WalletTripSegmentCounts;

async function loadTripSegmentSummaries(
  supabase: any,
  tripIds: string[],
  userId: string
): Promise<Map<string, SegmentCounts>> {
  const result = await supabase
    .from("trip_segments")
    .select("trip_id,lat,lng,location_status")
    .in("trip_id", tripIds);

  const { data, error } =
    result.error && isMissingLatLngColumns(result.error.message)
      ? await supabase
          .from("trip_segments")
          .select("trip_id,latitude,longitude,location_status")
          .in("trip_id", tripIds)
      : result;

  if (error) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_segment_summary_load_failed",
        message: error.message,
        userId
      })
    );
    return new Map();
  }

  return summarizeWalletTripSegments((data || []) as TripSegmentSummary[]);
}

function isMissingLatLngColumns(message: string) {
  return /lat|lng/i.test(message) && /column|schema cache|could not find/i.test(message);
}

async function loadTripRecommendationSummaries(
  supabase: any,
  tripIds: string[],
  userId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("trip_recommendations")
    .select("trip_id")
    .in("trip_id", tripIds);

  if (error) {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_recommendation_summary_load_failed",
        message: error.message,
        userId
      })
    );
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of (data || []) as TripRecommendationSummary[]) {
    counts.set(row.trip_id, (counts.get(row.trip_id) || 0) + 1);
  }
  return counts;
}

async function loadTripPassImages(
  supabase: any,
  trips: TripRow[],
  userId: string
): Promise<Map<string, TripPassImage>> {
  const images = new Map<string, TripPassImage>();
  const visualTrips = trips.slice(0, 12);
  const tripIds = visualTrips.map((trip) => trip.id);

  for (const trip of visualTrips) {
    const image = imageFromProviderMetadata(
      trip.destination_provider_metadata,
      trip.destination ? `Photo of ${trip.destination}` : `Trip image for ${trip.name}`
    );
    if (image) {
      images.set(trip.id, image);
    }
  }

  if (!tripIds.length || tripIds.every((tripId) => images.has(tripId))) {
    return images;
  }

  const segmentResult = await supabase
    .from("trip_segments")
    .select("trip_id,title,kind,position,provider_metadata")
    .in("trip_id", tripIds)
    .eq("user_id", userId)
    .not("provider_metadata", "is", null)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(Math.max(24, tripIds.length * 4));

  if (!segmentResult.error) {
    const segmentsByTrip = new Map<string, TripVisualSegment[]>();
    for (const row of (segmentResult.data || []) as TripVisualSegment[]) {
      if (images.has(row.trip_id)) continue;
      const current = segmentsByTrip.get(row.trip_id) || [];
      current.push(row);
      segmentsByTrip.set(row.trip_id, current);
    }

    for (const [tripId, segments] of segmentsByTrip) {
      for (const segment of [...segments].sort(compareHeroSegments)) {
        const image = imageFromProviderMetadata(
          segment.provider_metadata,
          segment.title ? `Photo of ${segment.title}` : "Trip place photo",
          segment.title || "Trip place"
        );
        if (image) {
          images.set(tripId, image);
          break;
        }
      }
    }
  } else {
    console.warn(
      JSON.stringify({
        area: "trips",
        event: "trip_pass_segment_image_load_failed",
        message: segmentResult.error.message,
        userId
      })
    );
  }

  return images;
}

function buildTripsHeroImage(
  trip: TripRow | undefined,
  passImage: TripPassImage | undefined
): WalletHeroImage {
  if (!trip) return getFallbackHeroImage("Wayline trips", "Wayline trips background");

  const destination = trip.destination || trip.name || "Wayline trip";
  return {
    fallbackGradient: fallbackGradientForDestination(destination),
    imageAlt: passImage?.imageAlt || `${destination} trip pass background`,
    imageAttribution: passImage?.imageAttribution || null,
    imageSourceLabel: trip.destination || trip.name,
    imageUrl: passImage?.imageUrl || null
  };
}

function mapTrip(
  row: TripRow,
  counts?: SegmentCounts,
  nearbyIdeasCount = 0,
  passImage?: TripPassImage
): TripListItemView {
  return mapWalletTripPass(row, {
    counts,
    nearbyIdeasCount,
    visual: passImage
  });
}
