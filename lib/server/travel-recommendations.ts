import "server-only";

import { ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchNearbyActivities } from "@/lib/travel-data";
import { scoreInventoryItem } from "@/lib/travel-data/ranking";
import type { TravelInventoryItem } from "@/lib/travel-data/types";

type SupabaseLike = {
  from: (table: string) => any;
};

type TripSegmentRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  start_time: string | null;
  title: string;
};

const inventorySelect =
  "id,provider,provider_item_id,type,title,description,category,price_from,currency,rating,review_count,address,latitude,longitude,image_url,booking_url,availability,duration_minutes,cancellation_policy,source_url,metadata";

const recommendationSelect =
  "id,trip_id,trip_segment_id,inventory_id,recommendation_type,reason,score,status,created_at,travel_inventory(" +
  inventorySelect +
  ")";

export async function generateTripRecommendations(
  supabase: SupabaseLike,
  userId: string,
  tripId: string
) {
  const trip = await requireOwnedTrip(supabase, userId, tripId);
  const { data: segments, error: segmentError } = await supabase
    .from("trip_segments")
    .select("id,title,location,lat,lng,start_time")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(5);

  if (segmentError) {
    throw new ApiError("internal_error", "Could not load mapped trip places.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const mappedSegments = ((segments || []) as TripSegmentRow[]).filter(
    (segment) => typeof segment.lat === "number" && typeof segment.lng === "number"
  );

  if (!mappedSegments.length) {
    logSuggestionsEvent("suggestions_skipped_no_mapped_stops", {
      mappedStopCount: 0,
      tripId,
      userId
    });
    return {
      created: 0,
      recommendations: [],
      skippedReason: "no_mapped_segments"
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new ApiError("internal_error", "Server inventory client is not configured.", 500);
  }

  const stored = [];
  let providerFailureCount = 0;
  for (const segment of mappedSegments.slice(0, 3)) {
    const suggestions = await searchNearbyActivities({
        limit: 5,
        location: {
          address: segment.location,
          latitude: segment.lat!,
          longitude: segment.lng!,
          title: segment.title
        },
        tripContext: {
          destination: trip.destination,
          endDate: trip.end_date,
          startDate: trip.start_date,
          travelStyle: trip.travel_style,
          tripId
        }
      }).catch((error) => {
        providerFailureCount += 1;
        console.info(
          JSON.stringify({
            area: "travel_recommendations",
            event: "suggestions_provider_failed",
            error: error instanceof Error ? error.message.slice(0, 160) : "Provider failed.",
            mappedStopCount: mappedSegments.length,
            tripId
          })
        );
        return [];
      });

    for (const item of suggestions) {
      const inventory = await upsertInventory(admin, item);
      if (!inventory?.id) continue;

      const score = scoreInventoryItem(item, {
        latitude: segment.lat!,
        longitude: segment.lng!,
        title: segment.title
      });
      const { data: recommendation, error } = await supabase
        .from("trip_recommendations")
        .insert({
          inventory_id: inventory.id,
          reason: reasonForSuggestion(item, segment),
          recommendation_type: item.type === "restaurant" ? "nearby_restaurant" : "nearby_activity",
          score,
          status: "suggested",
          trip_id: tripId,
          trip_segment_id: segment.id
        })
        .select(recommendationSelect)
        .single();

      if (!error && recommendation) {
        stored.push(recommendation);
      }
    }
  }

  return {
    created: stored.length,
    partialFailure: providerFailureCount > 0 && stored.length > 0,
    providerFailureCount,
    recommendations: stored,
    skippedReason: null
  };
}

export async function listTripRecommendations(
  supabase: SupabaseLike,
  userId: string,
  tripId: string
) {
  await requireReadableTrip(supabase, userId, tripId);
  const { data, error } = await supabase
    .from("trip_recommendations")
    .select(recommendationSelect)
    .eq("trip_id", tripId)
    .neq("status", "dismissed")
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error && !isMissingRecommendationSchema(error.message)) {
    throw new ApiError("internal_error", "Could not load smart suggestions.", 500, {
      supabaseMessage: error.message
    });
  }

  return error ? [] : data || [];
}

export async function saveTripRecommendation(
  supabase: SupabaseLike,
  userId: string,
  recommendationId: string
) {
  const recommendation = await getOwnedRecommendation(supabase, userId, recommendationId);
  const inventory = Array.isArray(recommendation.travel_inventory)
    ? recommendation.travel_inventory[0]
    : recommendation.travel_inventory;

  if (!inventory) {
    throw new ApiError("validation_error", "Suggestion inventory is missing.", 400);
  }

  const { data: latestSegment } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", recommendation.trip_id)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    typeof latestSegment?.position === "number" ? latestSegment.position + 1 : 0;

  const { data: segment, error: segmentError } = await supabase
    .from("trip_segments")
    .insert({
      kind: segmentKindForInventory(inventory.type),
      lat: inventory.latitude,
      lng: inventory.longitude,
      location: inventory.address,
      location_status:
        typeof inventory.latitude === "number" && typeof inventory.longitude === "number"
          ? "resolved"
          : "needs_location_confirmation",
      notes: recommendation.reason || inventory.description,
      position: nextPosition,
      provider: inventory.provider,
      provider_metadata: {
        ...(inventory.metadata || {}),
        locationDiagnostics: {
          attemptedAt: new Date().toISOString(),
          destinationContext: null,
          lastErrorCode: null,
          lastErrorMessageSafe: null,
          provider: inventory.provider,
          providerResultCount: 1,
          query: inventory.title,
          rejectionReason: null,
          retryable: false,
          retryCount: 0,
          selectedFormattedAddress: inventory.address,
          selectedProviderPlaceId: inventory.provider_item_id,
          status:
            typeof inventory.latitude === "number" && typeof inventory.longitude === "number"
              ? "resolved"
              : "needs_location_confirmation"
        }
      },
      provider_place_id: inventory.provider_item_id,
      title: inventory.title,
      trip_id: recommendation.trip_id,
      user_id: userId
    })
    .select("id")
    .single();

  if (segmentError) {
    throw new ApiError("internal_error", "Could not save suggestion to trip.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const { data, error } = await supabase
    .from("trip_recommendations")
    .update({ status: "saved", trip_segment_id: segment.id })
    .eq("id", recommendationId)
    .select(recommendationSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not update suggestion.", 500, {
      supabaseMessage: error.message
    });
  }

  return { recommendation: data, segment };
}

export async function dismissTripRecommendation(
  supabase: SupabaseLike,
  userId: string,
  recommendationId: string
) {
  await getOwnedRecommendation(supabase, userId, recommendationId);
  const { data, error } = await supabase
    .from("trip_recommendations")
    .update({ status: "dismissed" })
    .eq("id", recommendationId)
    .select(recommendationSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not dismiss suggestion.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

async function requireOwnedTrip(supabase: SupabaseLike, userId: string, tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("id,destination,start_date,end_date,travel_style")
    .eq("id", tripId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new ApiError("not_found", "Trip not found.", 404);
  }

  return data;
}

async function requireReadableTrip(supabase: SupabaseLike, userId: string, tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data) return data;

  const collaborator = await supabase
    .from("trip_collaborators")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (collaborator.data) return collaborator.data;
  throw new ApiError("not_found", "Trip not found.", 404);
}

async function getOwnedRecommendation(
  supabase: SupabaseLike,
  userId: string,
  recommendationId: string
) {
  const { data, error } = await supabase
    .from("trip_recommendations")
    .select(recommendationSelect)
    .eq("id", recommendationId)
    .single();

  if (error || !data) {
    throw new ApiError("not_found", "Suggestion not found.", 404);
  }

  await requireOwnedTrip(supabase, userId, data.trip_id);
  return data;
}

async function upsertInventory(admin: SupabaseLike, item: TravelInventoryItem) {
  const payload = {
    address: item.address,
    availability: item.availability,
    booking_url: item.bookingUrl,
    cancellation_policy: item.cancellationPolicy,
    category: item.category,
    currency: item.currency,
    description: item.description,
    duration_minutes: item.durationMinutes,
    image_url: item.imageUrl,
    latitude: item.latitude,
    longitude: item.longitude,
    metadata: item.metadata,
    price_from: item.priceFrom,
    provider: item.provider,
    provider_item_id: item.providerItemId,
    rating: item.rating,
    review_count: item.reviewCount,
    source_url: item.sourceUrl,
    title: item.title,
    type: item.type
  };
  if (!item.providerItemId) {
    const existing = await admin
      .from("travel_inventory")
      .select("id")
      .eq("provider", item.provider)
      .eq("title", item.title)
      .eq("address", item.address)
      .maybeSingle();
    if (existing.data?.id) return existing.data;
  }

  const write = item.providerItemId
    ? admin
        .from("travel_inventory")
        .upsert(payload, { onConflict: "provider,provider_item_id" })
    : admin.from("travel_inventory").insert(payload);
  const { data, error } = await write.select("id").single();

  if (error) {
    return null;
  }

  return data;
}

function reasonForSuggestion(item: TravelInventoryItem, segment: TripSegmentRow) {
  if (item.type === "restaurant") return `Popular nearby option close to ${segment.title}.`;
  if (item.rating && item.rating >= 4.5) return `Highly rated stop near ${segment.title}.`;
  return `Near your route around ${segment.title}.`;
}

function segmentKindForInventory(type: string) {
  if (type === "restaurant") return "restaurant";
  if (type === "hotel") return "hotel";
  return "activity";
}

function isMissingRecommendationSchema(message: string) {
  return /trip_recommendations|travel_inventory|schema cache/i.test(message);
}

function logSuggestionsEvent(event: string, details: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      area: "travel_recommendations",
      event,
      ...details
    })
  );
}
