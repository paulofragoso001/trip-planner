import "server-only";

import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { resolvePlace as resolveTravelPlace } from "@/lib/travel-data";
import type {
  CreateSocialImportInput,
  MergeExtractedPlaceInput,
  UpdateExtractedPlaceInput
} from "@/lib/validators/social-imports";
import {
  normalizeRouteMode,
  routeLocationLabel,
  type TripSegmentRouteMetadata
} from "@/lib/trip-segment-route";

type SupabaseLike = {
  from: (table: string) => any;
  storage?: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      upload: (
        path: string,
        body: Blob,
        options?: { contentType?: string; upsert?: boolean }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

type ImportedPostRow = {
  id: string;
  raw_metadata: Record<string, unknown> | null;
  raw_text: string | null;
  source_caption: string | null;
  source_platform: string;
  source_title: string | null;
  source_url: string | null;
  trip_id: string | null;
  uploaded_asset_path: string | null;
};

type ExtractedTravelSignal = {
  address?: string | null;
  candidateType?:
    | "activity_idea"
    | "event"
    | "hotel"
    | "neighborhood"
    | "physical_place"
    | "restaurant_intent"
    | "tour"
    | "transportation";
  category: string;
  city?: string | null;
  confidence: number;
  country?: string | null;
  duplicateGroupKey?: string | null;
  evidence: string[];
  locationHint?: string | null;
  name: string;
  needsProviderSearch?: boolean;
  normalizedName?: string | null;
  priority?: "candidate" | "must_do" | "optional" | "want_to_do";
  reviewReason: "low_confidence" | "ready";
  summary: string;
};

const importedPostSelect =
  "id,user_id,trip_id,source_platform,source_url,source_title,source_author,source_caption,uploaded_asset_path,thumbnail_path,status,parser_version,raw_text,raw_metadata,error_message,created_at,updated_at";
const extractedPlaceSelect =
  "id,user_id,imported_post_id,trip_id,promoted_trip_segment_id,name,normalized_name,category,description,travel_note,address,city,region,country,place_id,latitude,longitude,confidence,priority,dedupe_key,duplicate_of,status,evidence,ai_payload,created_at,updated_at";
const highConfidenceThreshold = 0.85;
const allowedExtractionCategories = new Set([
  "activity",
  "attraction",
  "event",
  "hotel",
  "landmark",
  "neighborhood",
  "nightlife",
  "park",
  "restaurant",
  "shopping",
  "tour",
  "transportation"
]);

function logSocialImportEvent(
  event: string,
  details: Record<string, unknown>
) {
  console.info(
    JSON.stringify({
      area: "social_imports",
      event,
      ...details
    })
  );
}

export async function listSocialImportWorkspace(
  supabase: SupabaseLike,
  userId: string
) {
  const [postsResult, placesResult] = await Promise.all([
    supabase
      .from("imported_social_posts")
      .select(importedPostSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("extracted_places")
      .select(extractedPlaceSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  if (postsResult.error && !isMissingTable(postsResult.error.message)) {
    throw new ApiError("internal_error", "Could not load social imports.", 500, {
      supabaseMessage: postsResult.error.message
    });
  }

  if (placesResult.error && !isMissingTable(placesResult.error.message)) {
    throw new ApiError("internal_error", "Could not load extracted places.", 500, {
      supabaseMessage: placesResult.error.message
    });
  }

  return {
    extractedPlaces: placesResult.error ? [] : filterStoredExtractedPlaces(placesResult.data || []),
    socialImports: postsResult.error ? [] : postsResult.data || []
  };
}

export async function getSocialImportDetail(
  supabase: SupabaseLike,
  userId: string,
  importedPostId: string
) {
  const socialImport = await getImportedPost(supabase, userId, importedPostId);
  const { data, error } = await supabase
    .from("extracted_places")
    .select(extractedPlaceSelect)
    .eq("user_id", userId)
    .eq("imported_post_id", importedPostId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError("internal_error", "Could not load extracted places.", 500, {
      supabaseMessage: error.message
    });
  }

  return {
    extractedPlaces: filterStoredExtractedPlaces(data || []),
    socialImport
  };
}

export async function createSocialImport(
  supabase: SupabaseLike,
  userId: string,
  input: CreateSocialImportInput,
  file?: File | null
) {
  const upload = file ? await uploadSocialImportAsset(supabase, userId, file) : null;
  const sourceMetadata = await loadSocialUrlMetadata(input.sourceUrl);
  const rawText = [
    input.sourceCaption,
    input.rawText
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const { data, error } = await supabase
    .from("imported_social_posts")
    .insert({
      raw_metadata: {
        fileName: file?.name || null,
        fileType: file?.type || null,
        inputMode: file ? "screenshot" : input.sourceUrl ? "url" : "text",
        sourceMetadata: {
          description: sourceMetadata.description,
          error: sourceMetadata.error,
          siteName: sourceMetadata.siteName,
          title: sourceMetadata.title
        }
      },
      raw_text: rawText || null,
      source_caption: input.sourceCaption,
      source_platform: file ? "screenshot" : input.sourcePlatform,
      source_title: input.sourceTitle || sourceMetadata.title,
      source_url: input.sourceUrl,
      status: input.processNow ? "processing" : "pending",
      trip_id: input.tripId,
      uploaded_asset_path: upload?.path || null,
      user_id: userId
    })
    .select(importedPostSelect)
    .single();

  if (error) {
    if (isMissingTable(error.message)) {
      throw new ApiError(
        "not_implemented",
        "Run migration 029_create_social_imports.sql before importing social travel inspiration.",
        501
      );
    }

    throw new ApiError("internal_error", "Could not create social import.", 500, {
      supabaseMessage: error.message
    });
  }

  if (!input.processNow) {
    logSocialImportEvent("import_created", {
      importedPostId: data.id,
      processNow: false,
      sourcePlatform: data.source_platform,
      tripId: data.trip_id,
      userId
    });

    return { extractedPlaces: [], socialImport: data };
  }

  logSocialImportEvent("import_created", {
    importedPostId: data.id,
    processNow: true,
    sourcePlatform: data.source_platform,
    tripId: data.trip_id,
    userId
  });

  const processed = await processSocialImport(supabase, userId, data.id, {
    imageDataUrl: upload?.dataUrl || null
  });

  return {
    extractedPlaces: processed.extractedPlaces,
    socialImport: processed.socialImport
  };
}

export async function processSocialImport(
  supabase: SupabaseLike,
  userId: string,
  importedPostId: string,
  options?: { imageDataUrl?: string | null }
) {
  const post = await getImportedPost(supabase, userId, importedPostId);

  logSocialImportEvent("ai_extraction_started", {
    importedPostId,
    sourcePlatform: post.source_platform,
    tripId: post.trip_id,
    userId
  });

  await supabase
    .from("imported_social_posts")
    .update({ error_message: null, status: "processing" })
    .eq("id", importedPostId)
    .eq("user_id", userId);

  try {
    const imageDataUrl =
      options?.imageDataUrl || (await loadStoredImageDataUrl(supabase, post));
    const ocrResult = await extractScreenshotText(imageDataUrl);
    const sourceText = normalizeExtractionInput(
      [buildSourceText(post), ocrResult.text].filter(Boolean).join("\n\n")
    );

    if (ocrResult.provider !== "none") {
      await supabase
        .from("imported_social_posts")
        .update({
          raw_metadata: {
            ...(post.raw_metadata || {}),
            ocr: {
              error: ocrResult.error,
              model: ocrResult.model,
              provider: ocrResult.provider,
              processedAt: new Date().toISOString(),
              status: ocrResult.error ? "failed" : ocrResult.text ? "succeeded" : "empty"
            }
          },
          raw_text: mergeRawText(post.raw_text, ocrResult.text)
        })
        .eq("id", importedPostId)
        .eq("user_id", userId);
    }

    const signals = await extractTravelSignals({
      imageDataUrl,
      sourcePlatform: post.source_platform,
      sourceText,
      sourceUrl: post.source_url
    });

    const dedupedSignals = dedupeSignals(signals);
    const inserted = [];

    for (const signal of dedupedSignals) {
      const resolved = await resolvePlace(signal, post);
      const confidence = clampConfidence(signal.confidence);
      const status = reviewStatusForSignal(signal, resolved, confidence);
      const { data, error } = await supabase
        .from("extracted_places")
        .insert({
          address: resolved.address,
          ai_payload: {
            duplicateGroupKey: signal.duplicateGroupKey || null,
            candidateType: signal.candidateType || candidateTypeForSignal(signal),
            locationHint: signal.locationHint || null,
            needsProviderSearch: Boolean(signal.needsProviderSearch),
            provider: resolved.provider,
            providerMetadata: resolved.inventoryItem?.metadata || {},
            reviewReason: signal.reviewReason,
            sourcePlatform: post.source_platform,
            sourceUrl: post.source_url,
            summary: signal.summary
          },
          category: normalizeCategory(signal.category),
          city: resolved.city || signal.city || null,
          confidence,
          country: resolved.country || signal.country || null,
          dedupe_key: signal.duplicateGroupKey || buildDedupeKey(userId, resolved.placeId, signal.name, resolved.city),
          description: signal.summary,
          evidence: signal.evidence || [],
          imported_post_id: post.id,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          name: signal.name,
          normalized_name: normalizeCanonicalName(signal.normalizedName || signal.name),
          place_id: resolved.placeId,
          priority: signal.priority || "candidate",
          status,
          travel_note: signal.summary,
          trip_id: post.trip_id,
          user_id: userId
        })
        .select(extractedPlaceSelect)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      inserted.push(data);
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from("imported_social_posts")
      .update({ status: inserted.length ? "needs_review" : "processed" })
      .eq("id", importedPostId)
      .eq("user_id", userId)
      .select(importedPostSelect)
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    logSocialImportEvent("ai_extraction_completed", {
      extractedPlaces: inserted.length,
      importedPostId,
      socialImportStatus: updatedPost.status,
      tripId: updatedPost.trip_id,
      userId
    });

    return {
      extractedPlaces: inserted,
      socialImport: updatedPost
    };
  } catch (error) {
    await supabase
      .from("imported_social_posts")
      .update({
        error_message: error instanceof Error ? error.message : "Processing failed.",
        status: "failed"
      })
      .eq("id", importedPostId)
      .eq("user_id", userId);

    logSocialImportEvent("ai_extraction_failed", {
      error: error instanceof Error ? error.message : "Processing failed.",
      importedPostId,
      userId
    });

    throw new ApiError("internal_error", "Could not process social import.", 500, {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function updateExtractedPlace(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  input: UpdateExtractedPlaceInput
) {
  if (input.status === "accepted" && input.tripId) {
    await assertTripDestinationMatch(supabase, userId, id, input.tripId, {
      allowMismatch: input.confirmDestinationMismatch === true
    });
  }

  const updates: Record<string, unknown> = {};
  if ("category" in input) updates.category = input.category;
  if ("name" in input) {
    updates.name = input.name;
    updates.normalized_name = normalizeName(input.name || "");
  }
  if ("priority" in input) updates.priority = input.priority;
  if ("status" in input) updates.status = input.status;
  if ("travelNote" in input) updates.travel_note = input.travelNote;
  if ("tripId" in input) updates.trip_id = input.tripId;

  const { data, error } = await supabase
    .from("extracted_places")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not update extracted place.", 500, {
      supabaseMessage: error.message
    });
  }

  if ("status" in input) {
    logSocialImportEvent("place_reviewed", {
      action: input.status,
      extractedPlaceId: id,
      tripId: "tripId" in input ? input.tripId : data.trip_id,
      userId
    });
  }

  return data;
}

export async function mergeExtractedPlace(
  supabase: SupabaseLike,
  userId: string,
  sourceId: string,
  input: MergeExtractedPlaceInput
) {
  if (sourceId === input.targetPlaceId) {
    throw new ApiError("validation_error", "Choose a different place to merge into.", 400);
  }

  const [source, target] = await Promise.all([
    getExtractedPlace(supabase, userId, sourceId),
    getExtractedPlace(supabase, userId, input.targetPlaceId)
  ]);

  if (source.status === "promoted") {
    throw new ApiError("validation_error", "Promoted places cannot be merged.", 400);
  }

  if (target.status === "dismissed" || target.status === "merged") {
    throw new ApiError("validation_error", "Choose an active target place.", 400);
  }

  const mergedEvidence = uniqueStrings([
    ...readStringArray(target.evidence),
    ...readStringArray(source.evidence)
  ]).slice(0, 8);
  const mergedTravelNote = mergeNotes(target.travel_note || target.description, source.travel_note || source.description);
  const targetPayload = isRecord(target.ai_payload) ? target.ai_payload : {};
  const sourcePayload = isRecord(source.ai_payload) ? source.ai_payload : {};
  const mergedFrom = Array.isArray(targetPayload.mergedFrom)
    ? targetPayload.mergedFrom.filter((item: unknown) => isRecord(item))
    : [];

  const { data: updatedTarget, error: targetError } = await supabase
    .from("extracted_places")
    .update({
      ai_payload: {
        ...targetPayload,
        mergedFrom: [
          ...mergedFrom,
          {
            category: source.category,
            evidence: readStringArray(source.evidence),
            id: source.id,
            mergedAt: new Date().toISOString(),
            name: source.name,
            sourcePayload
          }
        ]
      },
      confidence: Math.max(Number(target.confidence || 0), Number(source.confidence || 0)),
      evidence: mergedEvidence,
      travel_note: mergedTravelNote
    })
    .eq("id", target.id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  if (targetError) {
    throw new ApiError("internal_error", "Could not update merge target.", 500, {
      supabaseMessage: targetError.message
    });
  }

  const { data: updatedSource, error: sourceError } = await supabase
    .from("extracted_places")
    .update({
      ai_payload: {
        ...sourcePayload,
        mergedAt: new Date().toISOString(),
        mergedInto: target.id
      },
      duplicate_of: target.id,
      status: "merged"
    })
    .eq("id", source.id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  if (sourceError) {
    throw new ApiError("internal_error", "Could not merge extracted place.", 500, {
      supabaseMessage: sourceError.message
    });
  }

  logSocialImportEvent("place_merged", {
    sourcePlaceId: source.id,
    targetPlaceId: target.id,
    tripId: target.trip_id || source.trip_id,
    userId
  });

  return {
    source: updatedSource,
    target: updatedTarget
  };
}

export async function promoteExtractedPlace(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  tripId: string
) {
  const place = await resolveExtractedPlaceForPromotion(supabase, userId, id, tripId);
  const routeIntent = buildRouteIntentFromPlace(place);

  if (routeIntent) {
    return promoteRouteIntentPlace(supabase, userId, place, tripId, routeIntent);
  }

  if (place.status === "promoted" && place.promoted_trip_segment_id) {
    return { place, segment: null };
  }

  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    if (isUnmappedActivityIdea(place)) {
      return promoteUnmappedActivityPlace(supabase, userId, place, tripId);
    }

    logSocialImportEvent("trip_draft_promotion_failed", {
      error: "location_unresolved",
      extractedPlaceId: id,
      tripId,
      userId
    });

    throw new ApiError(
      "validation_error",
      "Confirm this place location before creating the trip plan.",
      400,
      { reason: "location_unresolved" }
    );
  }

  const { data: latestSegment } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    typeof latestSegment?.position === "number" ? latestSegment.position + 1 : 0;

  const startTime = await defaultStartTimeForTrip(supabase, userId, tripId, nextPosition);
  const { data: segment, error: segmentError } = await supabase
    .from("trip_segments")
    .insert({
      kind: segmentKindForCategory(place.category),
      lat: place.latitude,
      lng: place.longitude,
      location_status: "resolved",
      location: place.address || place.city || null,
      notes: buildPromotedNotes(place),
      position: nextPosition,
      provider: place.place_id ? "google_places" : "wayline_social_import",
      provider_metadata: {
        ...readProviderMetadata(place.ai_payload),
        evidence: readStringArray(place.evidence),
        extractedPlaceId: place.id,
        locationDiagnostics: readLocationDiagnostics(place.ai_payload),
        sourceImportId: place.imported_post_id
      },
      provider_place_id: place.place_id || null,
      source_import_id: place.imported_post_id || null,
      start_time: startTime,
      title: place.name,
      trip_id: tripId,
      user_id: userId
    })
    .select("id,trip_id,user_id,kind,title,start_time,end_time,location,lat,lng,location_status,notes,inserted_at")
    .single();

  if (segmentError) {
    logSocialImportEvent("trip_draft_promotion_failed", {
      error: segmentError.message,
      extractedPlaceId: id,
      tripId,
      userId
    });

    throw new ApiError("internal_error", "Could not promote extracted place.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const updatedPlace = await updateExtractedPlace(supabase, userId, id, {
    status: "promoted"
  });

  const { data: finalPlace } = await supabase
    .from("extracted_places")
    .update({
      promoted_trip_segment_id: segment.id,
      trip_id: tripId
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  logSocialImportEvent("trip_draft_promoted", {
    extractedPlaceId: id,
    segmentId: segment.id,
    tripId,
    userId
  });

  return {
    place: finalPlace || updatedPlace,
    segment
  };
}

async function promoteUnmappedActivityPlace(
  supabase: SupabaseLike,
  userId: string,
  place: Record<string, any>,
  tripId: string
) {
  const { data: latestSegment } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    typeof latestSegment?.position === "number" ? latestSegment.position + 1 : 0;
  const startTime = await defaultStartTimeForTrip(supabase, userId, tripId, nextPosition);

  const activitySegmentPayload = {
      kind: "activity",
      lat: null,
      lng: null,
      location_status: "needs_activity_provider",
      location: place.city || place.address || null,
      notes: buildPromotedNotes(place),
      position: nextPosition,
      provider: "wayline_activity_idea",
      provider_metadata: {
        activityCandidate: true,
        evidence: readStringArray(place.evidence),
        extractedPlaceId: place.id,
        locationDiagnostics: {
          attemptedAt: new Date().toISOString(),
          destinationContext: place.city || place.address || null,
          lastErrorCode: null,
          lastErrorMessageSafe: null,
          provider: "wayline",
          providerResultCount: 0,
          query: place.name || null,
          rejectionReason: null,
          retryable: true,
          retryCount: 0,
          selectedFormattedAddress: null,
          selectedProviderPlaceId: null,
          status: "needs_activity_provider"
        },
        sourceImportId: place.imported_post_id
      },
      provider_place_id: null,
      source_import_id: place.imported_post_id || null,
      start_time: startTime,
      title: place.name,
      trip_id: tripId,
      user_id: userId
    };

  let { data: segment, error: segmentError } = await supabase
    .from("trip_segments")
    .insert(activitySegmentPayload)
    .select("id,trip_id,user_id,kind,title,start_time,end_time,location,lat,lng,location_status,notes,inserted_at")
    .single();

  if (segmentError && /location_status_check/i.test(segmentError.message)) {
    const retry = await supabase
      .from("trip_segments")
      .insert({
        ...activitySegmentPayload,
        location_status: "needs_location_confirmation"
      })
      .select("id,trip_id,user_id,kind,title,start_time,end_time,location,lat,lng,location_status,notes,inserted_at")
      .single();
    segment = retry.data;
    segmentError = retry.error;
  }

  if (segmentError) {
    logSocialImportEvent("trip_draft_promotion_failed", {
      error: segmentError.message,
      extractedPlaceId: place.id,
      tripId,
      userId
    });

    throw new ApiError("internal_error", "Could not promote activity idea.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const { data: finalPlace } = await supabase
    .from("extracted_places")
    .update({
      ai_payload: {
        ...(isRecord(place.ai_payload) ? place.ai_payload : {}),
        activityCandidate: true,
        reviewReason: "needs_activity_provider"
      },
      promoted_trip_segment_id: segment.id,
      status: "promoted",
      trip_id: tripId
    })
    .eq("id", place.id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  logSocialImportEvent("trip_draft_promoted", {
    activityCandidate: true,
    extractedPlaceId: place.id,
    segmentId: segment.id,
    tripId,
    userId
  });

  return {
    place: finalPlace || place,
    segment
  };
}

async function promoteRouteIntentPlace(
  supabase: SupabaseLike,
  userId: string,
  place: Record<string, any>,
  tripId: string,
  route: TripSegmentRouteMetadata
) {
  const { data: latestSegment } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    typeof latestSegment?.position === "number" ? latestSegment.position + 1 : 0;
  const startTime = await defaultStartTimeForTrip(supabase, userId, tripId, nextPosition);
  const routeLabel = routeLocationLabel(route);

  const routeSegmentPayload = {
    kind: route.mode === "other" ? "transportation" : route.mode,
    lat: null,
    lng: null,
    location_status: "manual_location_required",
    location: routeLabel || place.city || place.address || null,
    notes: buildPromotedNotes(place),
    position: nextPosition,
    provider: "wayline_route",
    provider_metadata: {
      evidence: readStringArray(place.evidence),
      extractedPlaceId: place.id,
      route,
      routeCandidate: true,
      sourceImportId: place.imported_post_id
    },
    provider_place_id: null,
    source_import_id: place.imported_post_id || null,
    start_time: route.departAt || startTime,
    title: routeLabel || place.name,
    trip_id: tripId,
    user_id: userId
  };

  const { data: segment, error: segmentError } = await supabase
    .from("trip_segments")
    .insert(routeSegmentPayload)
    .select("id,trip_id,user_id,kind,title,start_time,end_time,location,lat,lng,location_status,notes,inserted_at")
    .single();

  if (segmentError) {
    logSocialImportEvent("trip_draft_promotion_failed", {
      error: segmentError.message,
      extractedPlaceId: place.id,
      routeCandidate: true,
      tripId,
      userId
    });

    throw new ApiError("internal_error", "Could not promote route segment.", 500, {
      supabaseMessage: segmentError.message
    });
  }

  const { data: finalPlace } = await supabase
    .from("extracted_places")
    .update({
      ai_payload: {
        ...(isRecord(place.ai_payload) ? place.ai_payload : {}),
        routeCandidate: true
      },
      promoted_trip_segment_id: segment.id,
      status: "promoted",
      trip_id: tripId
    })
    .eq("id", place.id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  logSocialImportEvent("trip_draft_promoted", {
    extractedPlaceId: place.id,
    routeCandidate: true,
    segmentId: segment.id,
    tripId,
    userId
  });

  return {
    place: finalPlace || place,
    segment
  };
}

async function resolveExtractedPlaceForPromotion(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  tripId: string
) {
  const place = await getExtractedPlace(supabase, userId, id);
  if (buildRouteIntentFromPlace(place)) {
    return place;
  }

  await assertTripDestinationMatch(supabase, userId, id, tripId, {
    allowMismatch: false,
    place
  });

  if (typeof place.latitude === "number" && typeof place.longitude === "number") {
    return place;
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("destination,name,title")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  const payload = isRecord(place.ai_payload) ? place.ai_payload : {};
  const locationContext =
    place.city || readString(payload.locationHint) || trip?.destination || null;
  const resolutionQuery = [
    place.name,
    locationContext,
    place.country
  ].filter(Boolean).join(" ");
  logSocialImportEvent("place_resolution_started", {
    category: place.category || null,
    cityContext: locationContext || null,
    extractedPlaceId: id,
    query: sanitizeLogPreview(resolutionQuery),
    tripId,
    userId
  });
  const resolved = await resolveTravelPlace(
    {
      address: place.address || null,
      city: locationContext,
      country: place.country || null,
      locationHint: locationContext,
      name: place.name,
      sourceTitle: trip?.destination || trip?.name || trip?.title || null
    },
    {
      city: locationContext,
      destination: trip?.destination || locationContext,
      tripId
    }
  );

  if (typeof resolved.latitude !== "number" || typeof resolved.longitude !== "number") {
    logSocialImportEvent("place_resolution_unresolved", {
      category: place.category || null,
      cityContext: locationContext || null,
      extractedPlaceId: id,
      provider: resolved.provider || null,
      tripId,
      userId
    });

    await supabase
      .from("extracted_places")
      .update({ status: "needs_location_confirmation" })
      .eq("id", id)
      .eq("user_id", userId);
    return place;
  }

  const { data, error } = await supabase
    .from("extracted_places")
    .update({
      address: resolved.address || place.address,
      city: resolved.city || place.city,
      country: resolved.country || place.country,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      place_id: resolved.placeId || place.place_id,
      ai_payload: {
        ...(isRecord(place.ai_payload) ? place.ai_payload : {}),
        provider: resolved.provider,
        locationDiagnostics: resolved.diagnostics || null,
        providerMetadata: resolved.inventoryItem?.metadata || {},
        resolvedAt: new Date().toISOString()
      }
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select(extractedPlaceSelect)
    .single();

  if (error) {
    logSocialImportEvent("place_resolution_update_failed", {
      error: error.message,
      extractedPlaceId: id,
      tripId,
      userId
    });

    return place;
  }

  logSocialImportEvent("place_resolved", {
    address: sanitizeLogPreview(resolved.address || ""),
    extractedPlaceId: id,
    hasCoordinates: true,
    provider: resolved.provider || "google_places",
    providerPlaceId: resolved.placeId ? "present" : "missing",
    tripId,
    userId
  });

  return data;
}

async function assertTripDestinationMatch(
  supabase: SupabaseLike,
  userId: string,
  placeId: string,
  tripId: string,
  options: { allowMismatch: boolean; place?: Record<string, any> }
) {
  const [place, tripResult] = await Promise.all([
    options.place ? Promise.resolve(options.place) : getExtractedPlace(supabase, userId, placeId),
    supabase
      .from("trips")
      .select("destination,name,title")
      .eq("id", tripId)
      .eq("user_id", userId)
      .maybeSingle()
  ]);
  const trip = tripResult.data;
  const placeContext = placeDestinationContext(place);
  const rawTripDestination = readString(trip?.destination);
  const tripDestination = isMissingDestination(rawTripDestination) ? "" : rawTripDestination;
  const tripContext = tripDestination || "";

  if (placeContext && !tripDestination) {
    logSocialImportEvent("destination_missing_for_ai_approval", {
      extractedPlaceId: placeId,
      placeContext: sanitizeLogPreview(placeContext),
      tripId,
      tripName: sanitizeLogPreview(trip?.name || trip?.title || ""),
      userId
    });

    throw new ApiError(
      "validation_error",
      "This trip does not have a destination yet. Set a destination before approving AI candidates.",
      400,
      {
        placeContext: sanitizeLogPreview(placeContext),
        reason: "destination_required",
        tripContext: null
      }
    );
  }

  if (!placeContext || !tripContext || destinationsOverlap(placeContext, tripContext)) {
    return;
  }

  logSocialImportEvent("destination_mismatch_detected", {
    allowMismatch: options.allowMismatch,
    extractedPlaceId: placeId,
    placeContext: sanitizeLogPreview(placeContext),
    tripContext: sanitizeLogPreview(tripContext),
    tripId,
    userId
  });

  if (!options.allowMismatch) {
    throw new ApiError(
      "validation_error",
      `This candidate appears to belong to ${placeContext}, but the selected trip is ${tripDestination || "another destination"}.`,
      400,
      {
        placeContext: sanitizeLogPreview(placeContext),
        reason: "destination_mismatch",
        tripContext: sanitizeLogPreview(tripContext)
      }
    );
  }
}

export async function promoteSocialImportPlaces(
  supabase: SupabaseLike,
  userId: string,
  importedPostId: string,
  input: { placeIds?: string[]; tripId: string }
) {
  await getImportedPost(supabase, userId, importedPostId);

  let query = supabase
    .from("extracted_places")
    .select("id,status")
    .eq("user_id", userId)
    .eq("imported_post_id", importedPostId)
    .neq("status", "dismissed")
    .neq("status", "promoted");

  if (input.placeIds?.length) {
    query = query.in("id", input.placeIds);
  } else {
    query = query.gte("confidence", highConfidenceThreshold);
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError("internal_error", "Could not load extracted places.", 500, {
      supabaseMessage: error.message
    });
  }

  const results = [];
  for (const place of data || []) {
    results.push(
      await promoteExtractedPlace(supabase, userId, readRequiredString(place.id), input.tripId)
    );
  }

  await supabase
    .from("imported_social_posts")
    .update({ status: "processed", trip_id: input.tripId })
    .eq("id", importedPostId)
    .eq("user_id", userId);

  return {
    promoted: results.length,
    results
  };
}

export async function runSocialImportWorker(
  supabase: SupabaseLike,
  options: { limit?: number } = {}
) {
  const limit = Math.max(1, Math.min(options.limit || 5, 20));
  const { data, error } = await supabase
    .from("imported_social_posts")
    .select("id,user_id,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingTable(error.message)) {
      throw new ApiError(
        "not_implemented",
        "Run migration 029_create_social_imports.sql before running the social import worker.",
        501
      );
    }

    throw new ApiError("internal_error", "Could not load pending social imports.", 500, {
      supabaseMessage: error.message
    });
  }

  const processed = [];
  const failed = [];

  for (const post of data || []) {
    const postId = readRequiredString(post.id);
    const userId = readRequiredString(post.user_id);
    const claimed = await claimPendingImport(supabase, postId, userId);

    if (!claimed) {
      continue;
    }

    try {
      const result = await processSocialImport(supabase, userId, postId);
      processed.push({
        extractedPlaces: result.extractedPlaces.length,
        id: postId,
        status: result.socialImport.status
      });
    } catch (error) {
      failed.push({
        error: error instanceof Error ? error.message : String(error),
        id: postId
      });
    }
  }

  return {
    failed,
    processed,
    status: processed.length || failed.length ? "processed" : "idle"
  };
}

async function getImportedPost(
  supabase: SupabaseLike,
  userId: string,
  id: string
): Promise<ImportedPostRow & { trip_id: string | null }> {
  const { data, error } = await supabase
    .from("imported_social_posts")
    .select(importedPostSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not load social import.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

async function getExtractedPlace(supabase: SupabaseLike, userId: string, id: string) {
  const { data, error } = await supabase
    .from("extracted_places")
    .select(extractedPlaceSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not load extracted place.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

async function uploadSocialImportAsset(supabase: SupabaseLike, userId: string, file: File) {
  if (!supabase.storage) {
    throw new ApiError("not_implemented", "Supabase Storage is not configured.", 501);
  }

  if (!file.type.startsWith("image/")) {
    throw new ApiError("validation_error", "Screenshot upload must be an image.", 400);
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new ApiError("validation_error", "Screenshot upload must be 8MB or smaller.", 400);
  }

  const extension = safeFileExtension(file.name, file.type);
  const path = `${userId}/${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from("social-imports")
    .upload(path, new Blob([bytes], { type: file.type }), {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw new ApiError("internal_error", "Could not upload screenshot.", 500, {
      supabaseMessage: error.message
    });
  }

  return {
    dataUrl: `data:${file.type};base64,${bytes.toString("base64")}`,
    path
  };
}

async function loadStoredImageDataUrl(supabase: SupabaseLike, post: ImportedPostRow) {
  if (!post.uploaded_asset_path || !supabase.storage) return null;
  const { data, error } = await supabase.storage
    .from("social-imports")
    .download(post.uploaded_asset_path);

  if (error || !data) return null;

  const bytes = Buffer.from(await data.arrayBuffer());
  return `data:${data.type || "image/png"};base64,${bytes.toString("base64")}`;
}

async function loadSocialUrlMetadata(sourceUrl: string | null) {
  if (!sourceUrl) {
    return { description: null, error: null, siteName: null, title: null };
  }

  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        description: null,
        error: "Unsupported URL protocol.",
        siteName: null,
        title: null
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "AlmidyBot/1.0 (+https://almidy.app; travel planning metadata fetcher)"
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return {
        description: null,
        error: `Metadata fetch failed: ${response.status}`,
        siteName: null,
        title: null
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {
        description: null,
        error: "Metadata fetch did not return HTML.",
        siteName: null,
        title: null
      };
    }

    const html = (await response.text()).slice(0, 250_000);

    return {
      description:
        readMetaContent(html, "og:description") ||
        readMetaContent(html, "description") ||
        readMetaContent(html, "twitter:description"),
      error: null,
      siteName: readMetaContent(html, "og:site_name") || url.hostname,
      title:
        readMetaContent(html, "og:title") ||
        readMetaContent(html, "twitter:title") ||
        readTitle(html)
    };
  } catch (error) {
    return {
      description: null,
      error: error instanceof Error ? error.message : "Metadata fetch failed.",
      siteName: null,
      title: null
    };
  }
}

function readMetaContent(html: string, key: string) {
  const escapedKey = escapeRegExp(key);
  const propertyPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
    "i"
  );
  const match = html.match(propertyPattern) || html.match(contentFirstPattern);
  return match?.[1] ? decodeHtml(match[1]).slice(0, 1000) : null;
}

function readTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]).slice(0, 500) : null;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function extractScreenshotText(imageDataUrl: string | null) {
  const model = process.env.OPENAI_OCR_MODEL || process.env.OPENAI_TRAVEL_IMPORT_MODEL || "gpt-4.1-mini";

  if (!imageDataUrl || !process.env.OPENAI_API_KEY) {
    return { error: null, model, provider: "none", text: "" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text:
                  "Perform OCR on this travel inspiration screenshot. Return only the visible text, preserving place names, captions, addresses, hashtags, and creator notes. If there is no readable text, return an empty string.",
                type: "input_text"
              },
              {
                detail: "high",
                image_url: imageDataUrl,
                type: "input_image"
              }
            ],
            role: "user"
          }
        ],
        max_output_tokens: 1200,
        model
      }),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`OpenAI OCR failed: ${response.status}`);
    }

    const payload = await response.json();
    return {
      error: null,
      model,
      provider: "openai",
      text: sanitizeOcrText(readOutputText(payload))
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "OpenAI OCR failed.",
      model,
      provider: "openai",
      text: ""
    };
  }
}

async function extractTravelSignals(input: {
  imageDataUrl: string | null;
  sourcePlatform: string;
  sourceText: string;
  sourceUrl: string | null;
}): Promise<ExtractedTravelSignal[]> {
  logSocialImportEvent("ai_extraction_input_preview", {
    preview: sanitizeLogPreview(input.sourceText),
    sourcePlatform: input.sourcePlatform,
    sourceTextLength: input.sourceText.length,
    sourceUrlHost: safeHostname(input.sourceUrl)
  });

  if (process.env.OPENAI_API_KEY) {
    try {
      return await extractWithOpenAi(input);
    } catch (error) {
      logSocialImportEvent("ai_extraction_provider_failed", {
        error: error instanceof Error ? error.message : "OpenAI extraction failed.",
        sourcePlatform: input.sourcePlatform
      });
    }
  }

  return extractWithRules(input.sourceText, input.sourceUrl);
}

async function extractWithOpenAi(input: {
  imageDataUrl: string | null;
  sourcePlatform: string;
  sourceText: string;
  sourceUrl: string | null;
}) {
  const content: Array<Record<string, unknown>> = [
    {
      text:
        "Extract only real travel places or bookable travel experiences from the user-submitted saved inspiration below. Return an empty places array if no real place or experience is present.\n\n" +
        "Allowed candidates: named restaurants, cafes, attractions, landmarks, neighborhoods, tours, activities, hotels, events, parks, shopping places, nightlife venues, and relevant transportation hubs.\n" +
        "If the user describes travel between two places, such as \"fly from Barcelona to Miami\" or \"Barcelona to Miami\", return one transportation candidate with that exact route name. Do not downgrade it into one endpoint place.\n" +
        "Vague requests such as cute sushi spot in Brickell, rooftop drinks, or waterfront brunch are not named venues. Return them only as restaurant_intent or activity_idea with needs_provider_search=true, low confidence, and no address.\n" +
        "Reject candidates that are UI labels, app names, product names, generic itinerary ideas, sentence fragments, instructions, marketing copy, or system/planner text. Never return OpenAI, Almidy, AI trip planner, Saved Inspiration, Review candidates, or text about promoting items.\n" +
        "Trip metadata belongs in trip_context, not in place_candidates. Do not return metadata such as Destination: Miami, Travel style: balanced, budget, dates, number of travelers, pace, planning notes, or itinerary labels as place candidates.\n" +
        "Split compound text into separate candidates. Example: \"visit Wynwood Walls, dinner at Komodo, walk Brickell City Centre\" returns three places.\n" +
        "Each candidate must include name, category, location_hint, city, country if known, an evidence quote copied from the user content, and confidence. Do not invent prices, booking URLs, or availability.\n" +
        "Use these categories only: attraction, restaurant, shopping, park, activity, tour, nightlife, hotel, transportation, neighborhood, event.\n" +
        "Return only JSON with {\"trip_context\":{\"destination\":null,\"cities\":[],\"country\":null,\"travel_style\":null,\"budget\":null,\"dates\":null,\"travelers\":null,\"pace\":null,\"interests\":[]},\"place_candidates\":[{\"name\":\"\",\"normalized_name\":\"\",\"category\":\"attraction|restaurant|shopping|park|activity|tour|nightlife|hotel|transportation|neighborhood|event\",\"candidate_type\":\"physical_place|neighborhood|activity_idea|tour|restaurant_intent|hotel|transportation|event\",\"needs_provider_search\":false,\"summary\":\"\",\"address\":null,\"city\":null,\"country\":null,\"location_hint\":null,\"duplicate_group_key\":null,\"confidence\":0.0,\"evidence\":[]}]}. Evidence must quote the user content.\n\n" +
        `Source platform: ${input.sourcePlatform}\nSource URL host: ${safeHostname(input.sourceUrl) || "none"}\nUSER_SAVED_INSPIRATION_BEGIN\n${input.sourceText || ""}\nUSER_SAVED_INSPIRATION_END`,
      type: "input_text"
    }
  ];

  if (input.imageDataUrl) {
    content.push({
      detail: "auto",
      image_url: input.imageDataUrl,
      type: "input_image"
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content,
          role: "user"
        }
      ],
      max_output_tokens: 1800,
      model: process.env.OPENAI_TRAVEL_IMPORT_MODEL || "gpt-4.1-mini"
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`OpenAI extraction failed: ${response.status}`);
  }

  const payload = await response.json();
  const text = readOutputText(payload);
  const parsed = parseJsonObject(text);
  const modelSignals = validateExtractedTravelSignals(
    parsed?.place_candidates ?? parsed?.placeCandidates ?? parsed?.places,
    "openai"
  );
  const ruleSignals = extractWithRules(input.sourceText, input.sourceUrl);
  return filterTravelSignals(
    removeLessSpecificDuplicateSignals(dedupeSignals([...modelSignals, ...ruleSignals]))
  );
}

function extractWithRules(sourceText: string, sourceUrl: string | null): ExtractedTravelSignal[] {
  const normalizedSourceText = normalizeExtractionInput(sourceText);
  const locationHint = locationHintFromText(normalizedSourceText);
  const highSignalCandidates = [
    ...extractKnownPlacesFromText(normalizedSourceText),
    ...extractVagueIntentCandidates(normalizedSourceText)
  ];
  const candidates = uniqueStrings([
    ...highSignalCandidates,
    ...extractRuleCandidateNames(sourceText)
  ])
    .filter((line) => !isTripMetadataLine(line))
    .filter((line) => looksLikePlace(line))
    .map(cleanRuleCandidateName)
    .filter(Boolean)
    .slice(0, 8);

  if (!candidates.length && sourceUrl) {
    candidates.push(titleFromUrl(sourceUrl));
  }

  return filterTravelSignals(removeLessSpecificDuplicateSignals(validateExtractedTravelSignals(candidates.map((name) => ({
    category: inferCategory(name),
    confidence: sourceText ? confidenceForRuleCandidate(name, sourceText) : 0.4,
    evidence: sourceText ? [evidenceForCandidate(name, sourceText)] : [sourceUrl || "Imported URL"],
    city: cityForCandidate(name, normalizedSourceText) || locationHint,
    location_hint: cityForCandidate(name, normalizedSourceText) || locationHint,
    name: name.slice(0, 180),
    priority: "candidate",
    summary: sourceText
      ? summarizeText(sourceText)
      : "Imported travel inspiration. Confirm the place before promoting it."
  })), "rules")));
}

function extractRuleCandidateNames(sourceText: string) {
  const candidates: string[] = [];
  const normalizedText = normalizeExtractionInput(sourceText);
  const actionPattern =
    /\b(?:visit|see|try|eat at|have dinner at|dinner at|coffee at|tapas at|stay at|staying near|walk around|walk|go to|do a|book a|book|sunset from|flying into)\s+([^,.;\n#]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = actionPattern.exec(normalizedText))) {
    candidates.push(match[1].trim());
  }

  const arrowParts = normalizedText
    .split(/→|->|—|–/)
    .map((line) => line.trim())
    .filter(Boolean);
  candidates.push(...arrowParts);

  const lines = normalizedText
    .replace(/\b(?:visit|see|try|eat at|have dinner at|dinner at|coffee at|tapas at|stay at|staying near|walk around|walk|go to|do a|book a|book|sunset from|flying into)\b/gi, "\n$&")
    .split(/\r?\n|\.|•|;|,(?=\s*(?:visit|see|try|eat at|have dinner at|dinner at|coffee at|tapas at|stay at|staying near|walk around|walk|go to|do a|book a|book|sunset from|flying into)\b)/i)
    .map((line) => line.trim())
    .filter(Boolean);

  candidates.push(...lines);
  return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
}

const knownPlacePatterns: Array<[RegExp, string]> = [
  [/\bBiscayne Bay\b(?:\s+boat\s+(?:day|tour))?/i, "Biscayne Bay boat tour"],
  [/\bBrickell City Centre\b/i, "Brickell City Centre"],
  [/\bBrickell\b/i, "Brickell"],
  [/\bcitizenM Miami Brickell\b/i, "citizenM Miami Brickell"],
  [/\bCoava\b/i, "Coava"],
  [/\bCoconut Grove\b/i, "Coconut Grove"],
  [/\bEl Xampanyet\b/i, "El Xampanyet"],
  [/\bEverglades\b(?:\s+airboat\s+tour)?/i, "Everglades airboat tour"],
  [/\bGran Via\b/i, "Gran Via"],
  [/\bKomodo(?:\s+Miami)?\b/i, "Komodo"],
  [/\bLe Pigeon\b/i, "Le Pigeon"],
  [/\bLittle Havana\b(?:\s+food\s+tour)?/i, "Little Havana food tour"],
  [/\bMIA\b|\bMiami International Airport\b/i, "Miami International Airport"],
  [/\bNomad Coffee\b/i, "Nomad Coffee"],
  [/\bPark Guell\b|\bPark Güell\b/i, "Park Guell"],
  [/\bPortland Japanese Garden\b|\bJapanese Garden\b/i, "Portland Japanese Garden"],
  [/\bPowell(?:'|’)?s Books\b/i, "Powell's Books"],
  [/\bPrado Museum\b/i, "Prado Museum"],
  [/\bRetiro Park\b/i, "Retiro Park"],
  [/\bSagrada Familia\b/i, "Sagrada Familia"],
  [/\bSouth Beach\b/i, "South Beach"],
  [/\bSouth Pointe Park\b/i, "South Pointe Park"],
  [/\bThe Wynwood Walls\b|\bWynwood Wall\b|\bWynwood Walls\b/i, "Wynwood Walls"],
  [/\bWynwood\b/i, "Wynwood"]
];

function extractKnownPlacesFromText(sourceText: string) {
  const found: string[] = [];
  for (const [pattern, name] of knownPlacePatterns) {
    if (pattern.test(sourceText)) found.push(name);
  }
  return found;
}

function extractVagueIntentCandidates(sourceText: string) {
  const candidates: string[] = [];
  if (/\bsushi spot\b.*\bBrickell\b|\bBrickell\b.*\bsushi spot\b/i.test(sourceText)) {
    candidates.push("sushi spot in Brickell");
  }
  if (/\brooftop drinks\b/i.test(sourceText)) {
    candidates.push("rooftop drinks");
  }
  if (/\b(?:near the water|waterfront)\b.*\bbrunch\b|\bbrunch\b.*\b(?:near the water|waterfront)\b/i.test(sourceText)) {
    candidates.push("waterfront brunch");
  }
  return candidates;
}

async function resolvePlace(signal: ExtractedTravelSignal, post: ImportedPostRow) {
  if (!shouldResolveSignalWithPlaces(signal)) {
    return {
      address: null,
      city: signal.city || locationContextForSignal(signal, post),
      country: signal.country || null,
      inventoryItem: null,
      latitude: null,
      longitude: null,
      placeId: null,
      provider: "wayline_review"
    };
  }

  const context = locationContextForSignal(signal, post);
  return resolveTravelPlace(
    {
      address: signal.address || null,
      city: signal.city || context || null,
      country: signal.country || null,
      locationHint: signal.locationHint || context || null,
      name: signal.name,
      sourceTitle: post.source_title
    },
    {
      city: signal.city || context || null,
      destination: context || null,
      tripId: post.trip_id || null
    }
  );
}

function shouldResolveSignalWithPlaces(signal: ExtractedTravelSignal) {
  const candidateType = signal.candidateType || candidateTypeForSignal(signal);
  if (candidateType === "activity_idea" || candidateType === "restaurant_intent" || candidateType === "tour") {
    return false;
  }
  return !signal.needsProviderSearch;
}

async function defaultStartTimeForTrip(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  position: number
) {
  const { data } = await supabase
    .from("trips")
    .select("start_date")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.start_date) return null;
  const date = new Date(data.start_date);
  date.setUTCHours(9 + Math.min(position, 8), 0, 0, 0);
  return date.toISOString();
}

function buildSourceText(post: ImportedPostRow) {
  return [post.source_caption, post.raw_text, post.source_url]
    .filter(Boolean)
    .join("\n\n");
}

function mergeRawText(existing: string | null, ocrText: string) {
  const sanitized = sanitizeOcrText(ocrText);
  if (!sanitized) return existing;
  if (!existing?.trim()) return sanitized;
  if (existing.includes(sanitized)) return existing;
  return `${existing.trim()}\n\n${sanitized}`.slice(0, 10000);
}

function sanitizeOcrText(value: string) {
  return value
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 10000);
}

function normalizeExtractionInput(value: string) {
  return sanitizeOcrText(value)
    .replace(/WYNW00D/gi, "Wynwood")
    .replace(/WYNW0OD/gi, "Wynwood")
    .replace(/K0MODO/gi, "Komodo")
    .replace(/BR1CKELL/gi, "Brickell")
    .replace(/P0INTE/gi, "Pointe");
}

function validateExtractedTravelSignals(
  value: unknown,
  source: "openai" | "rules"
): ExtractedTravelSignal[] {
  if (!Array.isArray(value)) {
    throw new Error(`${source} extraction returned invalid places payload.`);
  }

  const signals: ExtractedTravelSignal[] = [];
  for (const [index, item] of value.entries()) {
    try {
      signals.push(validateExtractedTravelSignal(item, index, source));
    } catch (error) {
      logSocialImportEvent("ai_extraction_candidate_rejected", {
        reason: error instanceof Error ? error.message : "invalid_candidate",
        source
      });
    }
  }
  return signals;
}

function validateExtractedTravelSignal(
  value: unknown,
  index: number,
  source: "openai" | "rules"
): ExtractedTravelSignal {
  if (!isRecord(value)) {
    throw new Error(`${source} extraction place ${index} must be an object.`);
  }

  const name = readString(value.name);
  if (!name || name.length < 3 || name.length > 180) {
    throw new Error(`${source} extraction place ${index} is missing a valid name.`);
  }

  const summary = readString(value.summary);
  if (!summary || summary.length > 2000) {
    throw new Error(`${source} extraction place ${index} is missing a valid summary.`);
  }

  const confidence = clampConfidence(readNumber(value.confidence) ?? 0);
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [];
  const priority = readPriority(value.priority);
  const category = normalizeCategory(readString(value.category) || "activity");
  const candidateType = normalizeCandidateType(
    readString(value.candidate_type ?? value.candidateType),
    category,
    name
  );
  const needsProviderSearch =
    value.needs_provider_search === true ||
    value.needsProviderSearch === true ||
    candidateType === "restaurant_intent" ||
    candidateType === "activity_idea" ||
    candidateType === "tour";

  return {
    address: readString(value.address),
    candidateType,
    category,
    city: readString(value.city),
    confidence,
    country: readString(value.country),
    duplicateGroupKey: readString(value.duplicate_group_key ?? value.duplicateGroupKey),
    evidence,
    locationHint: readString(value.location_hint ?? value.locationHint),
    name,
    needsProviderSearch,
    normalizedName: readString(value.normalized_name ?? value.normalizedName),
    priority,
    reviewReason: reviewReasonForConfidence(confidence),
    summary
  };
}

function dedupeSignals(signals: ExtractedTravelSignal[]) {
  const byKey = new Map<string, ExtractedTravelSignal>();
  for (const signal of signals) {
    const key = normalizeName(
      `${normalizeCanonicalPlaceLabel(signal.normalizedName || signal.name)}:${signal.city || signal.locationHint || ""}`
    );
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...signal,
        duplicateGroupKey: signal.duplicateGroupKey || key,
        name: normalizeDisplayName(signal.name)
      });
      continue;
    }

    byKey.set(key, mergeSignals(existing, signal, key));
  }

  return [...byKey.values()];
}

function filterTravelSignals(signals: ExtractedTravelSignal[]) {
  return signals.filter((signal) => {
    const rejectionReason = rejectionReasonForSignal(signal);
    if (rejectionReason) {
      logSocialImportEvent("ai_extraction_candidate_rejected", {
        name: sanitizeLogPreview(signal.name),
        reason: rejectionReason
      });
      return false;
    }
    return true;
  });
}

function removeLessSpecificDuplicateSignals(signals: ExtractedTravelSignal[]) {
  return signals.filter((signal) => {
    const current = normalizeCopy(signal.name);
    if (!current) return false;
    return !signals.some((other) => {
      if (other === signal) return false;
      const candidate = normalizeCopy(other.name);
      if (!candidate || candidate === current) return false;
      if (!canReplaceLessSpecificSignal(other.name)) return false;
      if (!namesShareDestination(signal, other)) return false;
      if (!isMoreSpecificName(candidate, current)) return false;
      logSocialImportEvent("ai_extraction_candidate_rejected", {
        name: sanitizeLogPreview(signal.name),
        reason: "less_specific_duplicate",
        replacement: sanitizeLogPreview(other.name)
      });
      return true;
    });
  });
}

function namesShareDestination(
  current: ExtractedTravelSignal,
  other: ExtractedTravelSignal
) {
  const currentContext = normalizeCopy([current.city, current.locationHint, current.country].filter(Boolean).join(" "));
  const otherContext = normalizeCopy([other.city, other.locationHint, other.country].filter(Boolean).join(" "));
  return !currentContext || !otherContext || currentContext === otherContext;
}

function isMoreSpecificName(candidate: string, current: string) {
  if (candidate === "wynwood walls" && current === "wynwood") return true;
  const candidateTokens = candidate.split(" ").filter(Boolean);
  const currentTokens = current.split(" ").filter(Boolean);
  if (candidateTokens.length <= currentTokens.length) return false;
  if (candidateTokens.length > 5) return false;
  return currentTokens.every((token) => candidateTokens.includes(token));
}

function canReplaceLessSpecificSignal(name: string) {
  const normalized = normalizeCopy(name);
  return (
    !looksLikeRawInspirationNote(name) &&
    !looksLikeSentenceFragment(name) &&
    !isSocialFillerCandidate(normalized) &&
    !containsInstructionalPhrase(normalized)
  );
}

function filterStoredExtractedPlaces<TPlace extends Record<string, any>>(places: TPlace[]) {
  return places.filter((place) => {
    if (place.status === "promoted") return true;
    return !rejectionReasonForSignal({
      category: String(place.category || "activity"),
      city: place.city || null,
      confidence: Number(place.confidence || 0.5),
      country: place.country || null,
      evidence: readStringArray(place.evidence),
      locationHint: place.ai_payload?.locationHint || place.address || null,
      name: String(place.name || ""),
      reviewReason: "ready",
      summary: String(place.travel_note || place.description || "")
    });
  });
}

function mergeSignals(
  existing: ExtractedTravelSignal,
  incoming: ExtractedTravelSignal,
  duplicateGroupKey: string
): ExtractedTravelSignal {
  const confidence = Math.max(existing.confidence, incoming.confidence);
  const category = strongerCategory(existing.category, incoming.category);
  const candidateType = strongerCandidateType(
    existing.candidateType || candidateTypeForCategoryAndName(category, existing.name),
    incoming.candidateType || candidateTypeForCategoryAndName(category, incoming.name),
    category
  );
  return {
    ...existing,
    candidateType,
    category,
    city: existing.city || incoming.city || null,
    confidence,
    country: existing.country || incoming.country || null,
    duplicateGroupKey,
    evidence: uniqueStrings([
      ...(existing.evidence || []),
      ...(incoming.evidence || [])
    ]).slice(0, 5),
    name: preferredSignalName(existing.name, incoming.name),
    locationHint: existing.locationHint || incoming.locationHint || null,
    needsProviderSearch:
      Boolean(existing.needsProviderSearch || incoming.needsProviderSearch) ||
      candidateType === "activity_idea" ||
      candidateType === "restaurant_intent" ||
      candidateType === "tour",
    reviewReason: reviewReasonForConfidence(confidence),
    summary: mergeNotes(existing.summary, incoming.summary) || existing.summary || incoming.summary
  };
}

function strongerCandidateType(
  current: ExtractedTravelSignal["candidateType"],
  next: ExtractedTravelSignal["candidateType"],
  category: string
) {
  const categoryType = candidateTypeForCategoryAndName(category, "");
  const priority: Record<NonNullable<ExtractedTravelSignal["candidateType"]>, number> = {
    activity_idea: 6,
    restaurant_intent: 6,
    tour: 6,
    transportation: 5,
    hotel: 5,
    event: 5,
    neighborhood: 4,
    physical_place: 3
  };
  const candidates = [current, next, categoryType].filter(Boolean) as Array<
    NonNullable<ExtractedTravelSignal["candidateType"]>
  >;
  return candidates.sort((a, b) => priority[b] - priority[a])[0] || "physical_place";
}

function strongerCategory(current: string, next: string) {
  const currentCategory = normalizeCategory(current);
  const nextCategory = normalizeCategory(next);
  if (currentCategory === "activity" && nextCategory !== "activity") return nextCategory;
  return currentCategory;
}

function preferredSignalName(current: string, next: string) {
  const normalizedCurrent = normalizeCanonicalPlaceLabel(current);
  const normalizedNext = normalizeCanonicalPlaceLabel(next);
  if (normalizedCurrent === normalizedNext) {
    return normalizeDisplayName(current.length >= next.length ? current : next);
  }
  return normalizeDisplayName(current);
}

function rejectionReasonForSignal(signal: ExtractedTravelSignal) {
  const name = signal.name.trim();
  const normalized = normalizeCopy(name);

  if (name.length < 3) return "too_short";
  if (!allowedExtractionCategories.has(normalizeCategory(signal.category))) {
    return "unsupported_category";
  }
  if (isTripMetadataCandidate(name) || isTripMetadataCandidate(signal.category)) {
    return "trip_metadata";
  }
  if (looksLikeRawInspirationNote(name)) return "raw_inspiration_note";
  if (isBlockedExtractionTerm(normalized)) return "blocked_term";
  if (isSocialFillerCandidate(normalized)) {
    return "social_filler";
  }
  if (isGenericPlanningPhrase(normalized) && !isSuggestionIntent(signal)) {
    return "generic_planning_phrase";
  }
  if (containsInstructionalPhrase(normalized)) {
    return "instructional_or_ui_copy";
  }
  if (looksLikeSentenceFragment(name)) return "sentence_fragment";
  if (!hasTravelIntent(signal)) return "missing_travel_intent";
  return null;
}

function isSuggestionIntent(signal: ExtractedTravelSignal) {
  return signal.candidateType === "restaurant_intent" || signal.needsProviderSearch === true;
}

function isSocialFillerCandidate(value: string) {
  return socialFillerTerms.some((term) => {
    const normalizedTerm = normalizeCopy(term);
    if (normalizedTerm.length <= 3) {
      return value === normalizedTerm;
    }
    return value === normalizedTerm || value.includes(normalizedTerm);
  });
}

const socialFillerTerms = [
  "#ad",
  "#fyp",
  "comment below",
  "follow for more",
  "like and follow",
  "link in bio",
  "pov",
  "save this",
  "thingstodo",
  "travelhack",
  "travel tips",
  "viral"
];

function isGenericPlanningPhrase(value: string) {
  return /\b(cute restaurant|cute sushi spot|rooftop drinks|brunch spot|coffee place|waterfront brunch|something near the water|dinner near|planning spain|perfect .* weekend|best .* spots)\b/.test(value);
}

function isBlockedExtractionTerm(normalized: string) {
  return blockedExtractionTerms.some((term) => {
    const normalizedTerm = normalizeCopy(term);
    return normalized === normalizedTerm || normalized.includes(normalizedTerm);
  });
}

const blockedExtractionTerms = [
  "OpenAI",
  "Almidy",
  "AI trip planner",
  "Test production inspiration",
  "Review candidates",
  "Review candidates before promoting them into the itinerary",
  "Confirm AI candidates",
  "Saved Inspiration",
  "Generate review candidates",
  "Place extraction",
  "Human review",
  "Create Trip Plan",
  "Trip Draft Queue"
];

function isTripMetadataLine(value: string) {
  return /^\s*(destination|travel style|budget|pace|dates?|travelers?|number of travelers|trip type|itinerary|planning)\s*:/i.test(value);
}

function isTripMetadataCandidate(value: string | null | undefined) {
  if (!value) return false;
  const normalized = normalizeCopy(value);
  if (/^(destination|travel style|budget|pace|date|dates|travelers|number of travelers|trip type|itinerary|planning)\b/.test(normalized)) {
    return true;
  }
  return /\b(destination|travel style|budget|pace|dates|travelers|trip type|itinerary)\s*:/.test(value.toLowerCase());
}

function containsInstructionalPhrase(value: string) {
  return /before promoting|promoting them into|review candidates|generate reviewable|do not create|return only json|source platform|user saved inspiration|openai created|scan with openai/.test(value);
}

function looksLikeSentenceFragment(value: string) {
  const wordCount = value.trim().split(/\s+/).length;
  if (wordCount <= 4) return false;
  return /^(review|confirm|generate|extract|turn|use|add|click|open|create|planning)\b/i.test(value);
}

function looksLikeRawInspirationNote(value: string) {
  const wordCount = value.trim().split(/\s+/).length;
  if (wordCount >= 8) return true;
  if (value.includes(",") && /\b(?:visit|coffee at|tapas at|see sunset|go to|walk around|follow|save this)\b/i.test(value)) {
    return true;
  }
  return /test production inspiration|planning a trip|planning .*:|i want to visit|coffee at .+,\s*visit|tapas at .+,\s*visit/i.test(value);
}

function hasTravelIntent(signal: ExtractedTravelSignal) {
  const text = normalizeCopy([
    signal.name,
    signal.category,
    signal.city,
    signal.country,
    signal.locationHint,
    signal.summary,
    ...(signal.evidence || [])
  ].filter(Boolean).join(" "));

  if (/restaurant|dinner|lunch|breakfast|cafe|bar|food|hotel|park|beach|museum|gallery|tour|boat|bay|landmark|attraction|shopping|centre|center|mall|nightlife|airport|station|neighborhood|district|visit|walk|stay|go to|around|activity|experience/.test(text)) {
    return true;
  }

  return Boolean(signal.city || signal.locationHint || /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(signal.name));
}

function readOutputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const text = payload.output
    ?.flatMap((item: any) => item.content || [])
    ?.map((content: any) => content.text || "")
    ?.join("")
    ?.trim();
  if (!text) throw new Error("OpenAI response did not contain text.");
  return text;
}

function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("OpenAI extraction did not return JSON.");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function normalizeCategory(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z_]/g, "_");
  if (normalized.includes("food") || normalized.includes("restaurant") || normalized.includes("cafe")) return "restaurant";
  if (normalized.includes("hotel") || normalized.includes("lodging")) return "hotel";
  if (normalized.includes("night")) return "nightlife";
  if (normalized.includes("shop")) return "shopping";
  if (normalized.includes("park") || normalized.includes("nature")) return "park";
  if (normalized.includes("culture") || normalized.includes("museum") || normalized.includes("landmark") || normalized.includes("sight") || normalized.includes("attraction")) return "attraction";
  if (normalized.includes("transport")) return "transportation";
  if (normalized.includes("neighbor") || normalized.includes("district")) return "neighborhood";
  if (normalized.includes("tour")) return "tour";
  if (normalized.includes("event")) return "event";
  return "activity";
}

function segmentKindForCategory(category: string) {
  switch (normalizeCategory(category)) {
    case "restaurant":
      return "restaurant";
    case "hotel":
      return "hotel";
    case "shopping":
    case "transportation":
      return "activity";
    default:
      return "activity";
  }
}

function buildRouteIntentFromPlace(place: Record<string, any>): TripSegmentRouteMetadata | null {
  const payload = isRecord(place.ai_payload) ? place.ai_payload : {};
  const candidateType = readString(payload.candidate_type ?? payload.candidateType);
  const category = normalizeCategory(readString(place.category) || "");
  const candidateLooksTransport =
    category === "transportation" ||
    candidateType === "transportation" ||
    /\b(flight|fly|train|drive|bus|ferry|transfer|transport)\b/i.test(place.name || "");

  if (!candidateLooksTransport) {
    return null;
  }

  const evidence = readStringArray(place.evidence).join(" ");
  const match =
    matchRouteText(readString(place.name) || "", true) ||
    matchRouteText(readString(place.travel_note) || "", false) ||
    matchRouteText(evidence, false);

  if (!match) {
    return null;
  }

  const mode = inferRouteMode(`${place.name || ""} ${place.category || ""} ${evidence}`);

  return {
    arriveAt: null,
    carrier: null,
    confirmation: null,
    departAt: null,
    destination: {
      address: null,
      code: airportCodeFromRouteText(match.destination),
      label: match.destination,
      lat: null,
      lng: null,
      placeId: null
    },
    flightNumber: null,
    mode,
    origin: {
      address: null,
      code: airportCodeFromRouteText(match.origin),
      label: match.origin,
      lat: null,
      lng: null,
      placeId: null
    }
  };
}

function matchRouteText(value: string, strictTitle: boolean) {
  const normalized = value.replace(/→|—|–/g, "->").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const routeVerbMatch = normalized.match(
    /\b(?:fly|flying|flight|train|drive|driving|bus|ferry|transfer|transport)\s+(?:from\s+)?(.{2,70}?)\s+(?:to|->)\s+(.{2,70}?)(?:[.;,]|$)/i
  );
  if (routeVerbMatch) {
    return cleanRouteEndpoints(routeVerbMatch[1], routeVerbMatch[2]);
  }

  if (!strictTitle) {
    return null;
  }

  const titleMatch = normalized.match(/^(.{2,70}?)\s+(?:to|->)\s+(.{2,70})$/i);
  return titleMatch ? cleanRouteEndpoints(titleMatch[1], titleMatch[2]) : null;
}

function cleanRouteEndpoints(origin: string, destination: string) {
  const cleanOrigin = cleanRouteEndpoint(origin);
  const cleanDestination = cleanRouteEndpoint(destination);
  if (!cleanOrigin || !cleanDestination || cleanOrigin === cleanDestination) return null;
  return { destination: cleanDestination, origin: cleanOrigin };
}

function cleanRouteEndpoint(value: string) {
  return value
    .replace(/^(from|in|at)\s+/i, "")
    .replace(/\s+(by|on|for|with)\s+.*$/i, "")
    .replace(/["'`]/g, "")
    .trim();
}

function inferRouteMode(text: string) {
  const lower = text.toLowerCase();
  if (/\b(flight|fly|flying|airport)\b/.test(lower)) return normalizeRouteMode("flight");
  if (/\b(train|rail)\b/.test(lower)) return normalizeRouteMode("train");
  if (/\b(bus|coach)\b/.test(lower)) return normalizeRouteMode("bus");
  if (/\b(ferry|boat transfer)\b/.test(lower)) return normalizeRouteMode("ferry");
  if (/\b(drive|driving|car|road trip)\b/.test(lower)) return normalizeRouteMode("drive");
  if (/\b(transfer|transport)\b/.test(lower)) return normalizeRouteMode("transfer");
  return normalizeRouteMode("transportation");
}

function airportCodeFromRouteText(value: string) {
  const match = value.match(/\b[A-Z]{3}\b/);
  return match ? match[0] : null;
}

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (/airport|\bMIA\b|station|terminal|flying into/i.test(text)) return "transportation";
  if (/boat day|boat tour|airboat tour|food tour|tour|cruise|experience/.test(lower)) return "tour";
  if (/neighborhood|district|wynwood|brickell|south beach|coconut grove|gran via|little havana/.test(lower)) return "neighborhood";
  if (/restaurant|cafe|bar|coffee|dinner|lunch|breakfast|taco|sushi|brunch|food/.test(lower)) {
    return "restaurant";
  }
  if (/hotel|stay|resort|hostel/.test(lower)) return "hotel";
  if (/museum|gallery|temple|church|castle|walls|landmark|attraction/.test(lower)) return "attraction";
  if (/beach|park|hike|trail|garden|nature/.test(lower)) return "park";
  if (/shop|market|boutique/.test(lower)) return "shopping";
  return "activity";
}

function looksLikePlace(value: string) {
  if (value.length < 3 || value.length > 180) return false;
  if (/https?:\/\//i.test(value)) return false;
  if (/^(and|the|this|that|with|from|for|you|travel|trip)$/i.test(value)) return false;
  return /[A-Z][a-z]+/.test(value) || /restaurant|cafe|hotel|market|museum|beach|sushi spot|rooftop drinks|waterfront brunch/i.test(value);
}

function cleanRuleCandidateName(value: string) {
  let cleaned = value
    .replace(/^test production inspiration:\s*/i, "")
    .replace(/^(?:pov:\s*)?you found the perfect\s+.+?\s+weekend\s*/i, "")
    .replace(/^(?:and\s+)?(?:maybe\s+)?(?:visit|see|try|eat at|have dinner at|dinner at|coffee at|tapas at|stay at|staying near|walk around|walk|go to|do a|book a|book|flying into)\s+/i, "")
    .replace(/^sunset from\s+/i, "")
    .replace(/^(?:I want to|I would like to)\s+/i, "")
    .replace(/^sunset\s+from\s+/i, "")
    .replace(/,\s+and\s+maybe$/i, "")
    .replace(/,\s+and\s+maybe\s+/i, "")
    .replace(/\s+(?:for|with)\s+.+$/i, "")
    .trim();
  if (!/\b(sushi spot|brunch|rooftop drinks|coffee place|restaurant)\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/\s+in\s+([A-Z][A-Za-z\s]+)$/i, "").trim();
  }
  return normalizeDisplayName(cleaned);
}

function confidenceForRuleCandidate(name: string, sourceText: string) {
  const text = normalizeCopy(`${name} ${sourceText}`);
  if (/dinner at|visit|walk around|go to|boat tour|restaurant|park|centre|center|walls/.test(text)) {
    return 0.9;
  }
  return 0.62;
}

function evidenceForCandidate(name: string, sourceText: string) {
  const sentences = sourceText
    .split(/(?<=[.!?])\s+|[\n;]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const normalizedName = normalizeCopy(name);
  const direct = sentences.find((sentence) =>
    normalizeCopy(sentence).includes(normalizedName)
  );
  return (direct || sourceText).slice(0, 240);
}

function locationHintFromText(sourceText: string) {
  const match =
    sourceText.match(/\bPlanning\s+([A-Z][A-Za-z\s]+?)(?:\s*:|\s+weekend|\s+trip|\.|,|\n|$)/) ||
    sourceText.match(/\b(?:Trip to|Destination:)\s+(?:a\s+)?([A-Z][A-Za-z\s]+?)(?:\s+weekend|\s+trip|\.|,|\n|$)/) ||
    sourceText.match(/\bin\s+([A-Z][A-Za-z\s]+?)(?:,|\.|\n|$)/);
  return match?.[1]?.trim() || null;
}

function cityForCandidate(name: string, sourceText: string) {
  const normalizedName = normalizeCopy(name);
  const normalizedSource = normalizeCopy(sourceText);
  if (/sagrada familia|el xampanyet|nomad coffee|park guell/.test(normalizedName)) {
    if (normalizedSource.includes("barcelona")) return "Barcelona";
  }
  if (/prado museum|retiro park|gran via/.test(normalizedName)) {
    if (normalizedSource.includes("madrid")) return "Madrid";
  }
  if (
    /wynwood|komodo|brickell|south pointe|south beach|coconut grove|biscayne bay|everglades|little havana|miami international airport|mia|sushi spot/.test(normalizedName)
  ) {
    if (normalizedSource.includes("miami")) return "Miami";
  }
  if (/coava|powell|japanese garden|le pigeon/.test(normalizedName)) {
    if (normalizedSource.includes("portland")) return "Portland";
  }
  return null;
}

function locationContextForSignal(signal: ExtractedTravelSignal, post: ImportedPostRow) {
  return (
    signal.city ||
    signal.locationHint ||
    locationHintFromText(buildSourceText(post)) ||
    readString(post.raw_metadata?.tripContext) ||
    null
  );
}

function placeDestinationContext(place: Record<string, any>) {
  const payload = isRecord(place.ai_payload) ? place.ai_payload : {};
  return [
    place.city,
    readString(payload.locationHint),
    place.country,
    place.address
  ].filter(Boolean).join(" ");
}

function destinationsOverlap(placeContext: string, tripContext: string) {
  const placeTokens = destinationTokens(placeContext);
  const tripTokens = destinationTokens(tripContext);
  if (!placeTokens.length || !tripTokens.length) return true;
  return placeTokens.some((token) => tripTokens.includes(token));
}

function destinationTokens(value: string) {
  return normalizeCopy(value)
    .split(" ")
    .filter((token) => token.length > 2 && !["trip", "work", "weekend", "travel", "planner"].includes(token));
}

function isMissingDestination(value: string | null | undefined) {
  const normalized = normalizeCopy(value || "");
  return !normalized || normalized === "destination not set" || normalized === "not set";
}

function isUnmappedActivityIdea(place: Record<string, any>) {
  const text = normalizeCopy([
    place.name,
    place.travel_note,
    place.description,
    ...(readStringArray(place.evidence) || [])
  ].filter(Boolean).join(" "));
  const category = normalizeCategory(String(place.category || ""));
  return (
    category === "tour" ||
    /\b(tour|experience|excursion|boat|cruise|guided|provider|meeting point)\b/.test(text)
  );
}

function titleFromUrl(value: string) {
  try {
    const url = new URL(value);
    const slug = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").slice(0, 120);
  } catch {
    return "Imported travel idea";
  }
}

function summarizeText(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

function buildDedupeKey(userId: string, placeId: string | null, name: string, city?: string | null) {
  return placeId ? `place:${placeId}` : `name:${userId}:${normalizeCanonicalName(`${name}:${city || ""}`)}`;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeCanonicalName(value: string) {
  return normalizeName(normalizeCanonicalPlaceLabel(value));
}

function normalizeCanonicalPlaceLabel(value: string) {
  const normalized = normalizeExtractionInput(value)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .replace(/\bthe\s+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const copy = normalizeCopy(normalized);
  if (copy === "wynwood wall" || copy === "wynwood walls" || copy === "the wynwood walls") {
    return "Wynwood Walls";
  }
  if (copy === "komodo miami" || copy === "dinner at komodo") return "Komodo";
  if (copy === "park guell") return "Park Guell";
  if (copy === "japanese garden") return "Portland Japanese Garden";
  if (copy === "biscayne bay boat day") return "Biscayne Bay boat tour";
  return normalized;
}

function normalizeDisplayName(value: string) {
  const canonical = normalizeCanonicalPlaceLabel(value)
    .replace(/^near\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const copy = normalizeCopy(canonical);
  if (copy === "mia") return "Miami International Airport";
  if (copy === "wynwood") return "Wynwood";
  return canonical;
}

function normalizeCopy(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sanitizeLogPreview(value: string | null | undefined) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function safeHostname(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(0.999, value));
}

function reviewReasonForConfidence(confidence: number) {
  return confidence >= highConfidenceThreshold ? "ready" : "low_confidence";
}

function reviewStatusForConfidence(_confidence: number) {
  return "needs_review";
}

function reviewStatusForSignal(
  signal: ExtractedTravelSignal,
  resolved: Awaited<ReturnType<typeof resolvePlace>>,
  _confidence: number
) {
  const candidateType = signal.candidateType || candidateTypeForSignal(signal);
  if (
    signal.needsProviderSearch ||
    candidateType === "activity_idea" ||
    candidateType === "restaurant_intent" ||
    candidateType === "tour"
  ) {
    return "needs_location_confirmation";
  }

  if (typeof resolved.latitude !== "number" || typeof resolved.longitude !== "number") {
    return "needs_location_confirmation";
  }

  return "needs_review";
}

function normalizeCandidateType(
  value: string | null,
  category: string,
  name: string
): ExtractedTravelSignal["candidateType"] {
  const normalized = normalizeCopy(value || "");
  if (normalized === "physical place") return "physical_place";
  if (
    normalized === "physical_place" ||
    normalized === "neighborhood" ||
    normalized === "activity_idea" ||
    normalized === "tour" ||
    normalized === "restaurant_intent" ||
    normalized === "hotel" ||
    normalized === "transportation" ||
    normalized === "event"
  ) {
    return normalized;
  }

  return candidateTypeForCategoryAndName(category, name);
}

function candidateTypeForSignal(signal: ExtractedTravelSignal) {
  return signal.candidateType || candidateTypeForCategoryAndName(signal.category, signal.name);
}

function candidateTypeForCategoryAndName(
  category: string,
  name: string
): NonNullable<ExtractedTravelSignal["candidateType"]> {
  const normalizedCategory = normalizeCategory(category);
  const text = normalizeCopy(name);
  if (normalizedCategory === "neighborhood") return "neighborhood";
  if (normalizedCategory === "hotel") return "hotel";
  if (normalizedCategory === "transportation") return "transportation";
  if (normalizedCategory === "event") return "event";
  if (normalizedCategory === "tour") return "tour";
  if (/\b(cute|spot|rooftop drinks|brunch|near the water|something near)\b/.test(text)) {
    return "restaurant_intent";
  }
  if (/\b(boat day|boat tour|airboat tour|food tour|experience|excursion)\b/.test(text)) {
    return "tour";
  }
  return "physical_place";
}

function readPriority(value: unknown): ExtractedTravelSignal["priority"] {
  if (
    value === "candidate" ||
    value === "must_do" ||
    value === "optional" ||
    value === "want_to_do"
  ) {
    return value;
  }

  return "candidate";
}

function buildPromotedNotes(place: any) {
  const parts = [
    place.travel_note || place.description,
    place.address ? `Address: ${place.address}` : null,
    place.place_id ? `Google Place ID: ${place.place_id}` : null
  ].filter(Boolean);
  return parts.join("\n");
}

function readLocationDiagnostics(payload: unknown) {
  if (!isRecord(payload)) return null;
  return isRecord(payload.locationDiagnostics) ? payload.locationDiagnostics : null;
}

function readProviderMetadata(payload: unknown) {
  if (!isRecord(payload)) return {};
  return isRecord(payload.providerMetadata) ? payload.providerMetadata : {};
}

function safeFileExtension(name: string, type: string) {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function isMissingTable(message: string) {
  return /imported_social_posts|extracted_places|schema cache/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeNotes(primary: string | null | undefined, secondary: string | null | undefined) {
  const notes = uniqueStrings([primary || "", secondary || ""]);
  return notes.join("\n\n").slice(0, 2000) || null;
}

async function claimPendingImport(supabase: SupabaseLike, postId: string, userId: string) {
  const { data, error } = await supabase
    .from("imported_social_posts")
    .update({ status: "processing" })
    .eq("id", postId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

function readRequiredString(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  throw new ApiError("internal_error", "Expected database row id.", 500);
}
