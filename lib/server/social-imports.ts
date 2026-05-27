import "server-only";

import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import type {
  CreateSocialImportInput,
  UpdateExtractedPlaceInput
} from "@/lib/validators/social-imports";

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
  uploaded_asset_path: string | null;
};

type ExtractedTravelSignal = {
  address?: string | null;
  category: string;
  city?: string | null;
  confidence: number;
  country?: string | null;
  evidence: string[];
  name: string;
  priority?: "candidate" | "must_do" | "optional" | "want_to_do";
  reviewReason: "low_confidence" | "ready";
  summary: string;
};

const importedPostSelect =
  "id,user_id,trip_id,source_platform,source_url,source_title,source_author,source_caption,uploaded_asset_path,thumbnail_path,status,parser_version,raw_text,raw_metadata,error_message,created_at,updated_at";
const extractedPlaceSelect =
  "id,user_id,imported_post_id,trip_id,promoted_trip_segment_id,name,normalized_name,category,description,travel_note,address,city,region,country,place_id,latitude,longitude,confidence,priority,dedupe_key,duplicate_of,status,evidence,ai_payload,created_at,updated_at";
const highConfidenceThreshold = 0.85;

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
    extractedPlaces: placesResult.error ? [] : placesResult.data || [],
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
    extractedPlaces: data || [],
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
  const rawText = [input.sourceTitle, input.sourceCaption, input.rawText]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const { data, error } = await supabase
    .from("imported_social_posts")
    .insert({
      raw_metadata: {
        fileName: file?.name || null,
        fileType: file?.type || null,
        inputMode: file ? "screenshot" : input.sourceUrl ? "url" : "text"
      },
      raw_text: rawText || null,
      source_caption: input.sourceCaption,
      source_platform: file ? "screenshot" : input.sourcePlatform,
      source_title: input.sourceTitle,
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
    return { extractedPlaces: [], socialImport: data };
  }

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

  await supabase
    .from("imported_social_posts")
    .update({ error_message: null, status: "processing" })
    .eq("id", importedPostId)
    .eq("user_id", userId);

  try {
    const imageDataUrl =
      options?.imageDataUrl || (await loadStoredImageDataUrl(supabase, post));
    const ocrResult = await extractScreenshotText(imageDataUrl);
    const sourceText = [buildSourceText(post), ocrResult.text].filter(Boolean).join("\n\n");

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
      const { data, error } = await supabase
        .from("extracted_places")
        .insert({
          address: resolved.address,
          ai_payload: {
            reviewReason: signal.reviewReason,
            sourcePlatform: post.source_platform,
            sourceUrl: post.source_url,
            summary: signal.summary
          },
          category: normalizeCategory(signal.category),
          city: resolved.city || signal.city || null,
          confidence,
          country: resolved.country || signal.country || null,
          dedupe_key: buildDedupeKey(userId, resolved.placeId, signal.name, resolved.city),
          description: signal.summary,
          evidence: signal.evidence || [],
          imported_post_id: post.id,
          latitude: resolved.lat,
          longitude: resolved.lng,
          name: signal.name,
          normalized_name: normalizeName(signal.name),
          place_id: resolved.placeId,
          priority: signal.priority || "candidate",
          status: reviewStatusForConfidence(confidence),
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
  const updates: Record<string, unknown> = {};
  if ("category" in input) updates.category = input.category;
  if ("name" in input) {
    updates.name = input.name;
    updates.normalized_name = normalizeName(input.name || "");
  }
  if ("priority" in input) updates.priority = input.priority;
  if ("status" in input) updates.status = input.status;
  if ("travelNote" in input) updates.travel_note = input.travelNote;

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

  return data;
}

export async function promoteExtractedPlace(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  tripId: string
) {
  const place = await getExtractedPlace(supabase, userId, id);

  if (place.status === "promoted" && place.promoted_trip_segment_id) {
    return { place, segment: null };
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
      location: place.address || place.city || null,
      notes: buildPromotedNotes(place),
      position: nextPosition,
      provider: place.place_id ? "google_places" : "wayline_social_import",
      start_time: startTime,
      title: place.name,
      trip_id: tripId,
      user_id: userId
    })
    .select("id,trip_id,user_id,kind,title,start_time,end_time,location,lat,lng,notes,inserted_at")
    .single();

  if (segmentError) {
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

  return {
    place: finalPlace || updatedPlace,
    segment
  };
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
  if (process.env.OPENAI_API_KEY) {
    const aiSignals = await extractWithOpenAi(input).catch(() => null);
    if (aiSignals?.length) {
      return aiSignals;
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
        "Extract travel places from this saved social travel inspiration. Return only JSON with {\"places\":[{\"name\":\"\",\"category\":\"food|sightseeing|nightlife|shopping|hotel|nature|culture|transportation|hidden_gem|activity|tip\",\"summary\":\"\",\"address\":null,\"city\":null,\"country\":null,\"confidence\":0.0,\"evidence\":[]}]}.\n\n" +
        `Source platform: ${input.sourcePlatform}\nSource URL: ${input.sourceUrl || "none"}\nText:\n${input.sourceText || "No text provided."}`,
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
  const parsed = JSON.parse(text);
  return validateExtractedTravelSignals(parsed?.places, "openai");
}

function extractWithRules(sourceText: string, sourceUrl: string | null): ExtractedTravelSignal[] {
  const lines = sourceText
    .split(/\r?\n|\.|•|-/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = lines
    .filter((line) => looksLikePlace(line))
    .slice(0, 5)
    .map((line) => line.replace(/^visit\s+/i, "").replace(/^try\s+/i, ""));

  if (!candidates.length && sourceUrl) {
    candidates.push(titleFromUrl(sourceUrl));
  }

  return validateExtractedTravelSignals(candidates.map((name) => ({
    category: inferCategory(`${name}\n${sourceText}`),
    confidence: sourceText ? 0.62 : 0.4,
    evidence: sourceText ? [sourceText.slice(0, 180)] : [sourceUrl || "Imported URL"],
    name: name.slice(0, 180),
    priority: "candidate",
    summary: sourceText
      ? summarizeText(sourceText)
      : "Imported travel inspiration. Confirm the place before promoting it."
  })), "rules");
}

async function resolvePlace(signal: ExtractedTravelSignal, post: ImportedPostRow) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      address: signal.address || null,
      city: signal.city || null,
      country: signal.country || null,
      lat: null,
      lng: null,
      placeId: null
    };
  }

  const query = [signal.name, signal.city, signal.country, post.source_title]
    .filter(Boolean)
    .join(" ");
  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name,formatted_address,geometry");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return {
      address: signal.address || null,
      city: signal.city || null,
      country: signal.country || null,
      lat: null,
      lng: null,
      placeId: null
    };
  }

  const payload = await response.json();
  const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null;

  return {
    address: candidate?.formatted_address || signal.address || null,
    city: signal.city || null,
    country: signal.country || null,
    lat: candidate?.geometry?.location?.lat ?? null,
    lng: candidate?.geometry?.location?.lng ?? null,
    placeId: candidate?.place_id || null
  };
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
  return [post.source_title, post.source_caption, post.raw_text, post.source_url]
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

function validateExtractedTravelSignals(
  value: unknown,
  source: "openai" | "rules"
): ExtractedTravelSignal[] {
  if (!Array.isArray(value)) {
    throw new Error(`${source} extraction returned invalid places payload.`);
  }

  return value.map((item, index) => validateExtractedTravelSignal(item, index, source));
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
  if (!name || name.length > 180) {
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

  return {
    address: readString(value.address),
    category: normalizeCategory(readString(value.category) || "activity"),
    city: readString(value.city),
    confidence,
    country: readString(value.country),
    evidence,
    name,
    priority,
    reviewReason: reviewReasonForConfidence(confidence),
    summary
  };
}

function dedupeSignals(signals: ExtractedTravelSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = normalizeName(signal.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function normalizeCategory(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z_]/g, "_");
  if (normalized.includes("food") || normalized.includes("restaurant")) return "food";
  if (normalized.includes("hotel") || normalized.includes("lodging")) return "hotel";
  if (normalized.includes("night")) return "nightlife";
  if (normalized.includes("shop")) return "shopping";
  if (normalized.includes("nature") || normalized.includes("park")) return "nature";
  if (normalized.includes("culture") || normalized.includes("museum")) return "culture";
  if (normalized.includes("transport")) return "transportation";
  if (normalized.includes("hidden")) return "hidden_gem";
  if (normalized.includes("sight")) return "sightseeing";
  if (normalized.includes("tip")) return "tip";
  return "activity";
}

function segmentKindForCategory(category: string) {
  switch (normalizeCategory(category)) {
    case "food":
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

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (/restaurant|cafe|bar|coffee|dinner|lunch|breakfast|taco|sushi|food/.test(lower)) {
    return "food";
  }
  if (/hotel|stay|resort|hostel/.test(lower)) return "hotel";
  if (/museum|gallery|temple|church|castle/.test(lower)) return "culture";
  if (/beach|park|hike|trail|garden|nature/.test(lower)) return "nature";
  if (/shop|market|boutique/.test(lower)) return "shopping";
  return "activity";
}

function looksLikePlace(value: string) {
  if (value.length < 3 || value.length > 180) return false;
  if (/https?:\/\//i.test(value)) return false;
  if (/^(and|the|this|that|with|from|for|you|travel|trip)$/i.test(value)) return false;
  return /[A-Z][a-z]+/.test(value) || /restaurant|cafe|hotel|market|museum|beach/i.test(value);
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
  return placeId ? `place:${placeId}` : `name:${userId}:${normalizeName(`${name}:${city || ""}`)}`;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
