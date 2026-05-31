import "server-only";

import { getGooglePlacePhotoMetadata } from "@/lib/travel-data/providers/google-places";
import { readProviderPhoto } from "@/lib/travel-data/photo-url";

type SupabaseLike = {
  from: (table: string) => any;
};

type SegmentPhotoRow = {
  id: string;
  provider_metadata: Record<string, unknown> | null;
  provider_place_id: string | null;
  title: string | null;
};

export async function enrichTripSegmentPhotos(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  options: { limit?: number } = {}
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select("id,title,provider_place_id,provider_metadata")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .not("provider_place_id", "is", null)
    .limit(options.limit || 6);

  if (error || !Array.isArray(data)) {
    if (error) {
      logPhotoEnrichment("trip_segment_photo_load_failed", {
        error: error.message,
        tripId,
        userId
      });
    }
    return { attempted: 0, enriched: 0 };
  }

  let attempted = 0;
  let enriched = 0;

  for (const row of data as SegmentPhotoRow[]) {
    if (!row.provider_place_id || readProviderPhoto(row.provider_metadata)) continue;

    attempted += 1;
    const photoMetadata = await getGooglePlacePhotoMetadata(row.provider_place_id);
    if (!photoMetadata || !readProviderPhoto(photoMetadata)) {
      logPhotoEnrichment("trip_segment_photo_not_found", {
        segmentId: row.id,
        title: safePreview(row.title),
        tripId,
        userId
      });
      continue;
    }

    const existingMetadata = isRecord(row.provider_metadata) ? row.provider_metadata : {};
    const existingProviderMetadata = isRecord(existingMetadata.providerMetadata)
      ? existingMetadata.providerMetadata
      : {};

    const { error: updateError } = await supabase
      .from("trip_segments")
      .update({
        provider_metadata: {
          ...existingMetadata,
          ...photoMetadata,
          photoEnrichedAt: new Date().toISOString(),
          providerMetadata: {
            ...existingProviderMetadata,
            ...photoMetadata
          }
        }
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    if (updateError) {
      logPhotoEnrichment("trip_segment_photo_update_failed", {
        error: updateError.message,
        segmentId: row.id,
        tripId,
        userId
      });
      continue;
    }

    enriched += 1;
    logPhotoEnrichment("trip_segment_photo_enriched", {
      segmentId: row.id,
      title: safePreview(row.title),
      tripId,
      userId
    });
  }

  return { attempted, enriched };
}

function logPhotoEnrichment(event: string, details: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      area: "trip_segments",
      event,
      ...details
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safePreview(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
}
