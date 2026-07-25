import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const repositoryRoot = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export default {}" };
    }
    if (specifier.startsWith("next/") && !path.extname(specifier)) {
      return { shortCircuit: true, url: pathToFileURL(path.resolve(repositoryRoot, `node_modules/${specifier}.js`)).href };
    }
    if (specifier === "@/lib/api/errors") {
      return {
        shortCircuit: true,
        url: "data:text/javascript," + encodeURIComponent(`
          export const apiCanonicalSuccess = (value) => Response.json(value);
          export const handleApiError = () => new Response(null, { status: 500 });
          export const unauthorized = () => new Response(null, { status: 401 });
          export const validationFailure = (_message, details) => Response.json({ details }, { status: 400 });
        `)
      };
    }
    if (specifier === "@/lib/server/dashboard-test-auth") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export async function authorizeDashboardApi(){return {user:{id:'test'}}}"
      };
    }
    if (specifier.startsWith("@/")) {
      let resolved = path.resolve(repositoryRoot, specifier.slice(2));
      if (!path.extname(resolved)) {
        resolved = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, "index.ts");
      }
      return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }
    return nextResolve(specifier, context);
  }
});

const gallery = await import("../../lib/travel-data/postcard-gallery.ts");
const validators = await import("../../lib/validators/travel-data.ts");
const travelData = await import("../../lib/travel-data/index.ts");
const suggestionsRoute = await import("../../app/api/travel-data/suggestions/route.ts");

function item(overrides = {}) {
  const placeTypes = overrides.placeTypes || ["tourist_attraction"];
  const providerPlaceId = overrides.providerPlaceId === undefined ? overrides.id || "place" : overrides.providerPlaceId;
  const dimensions = overrides.dimensions === undefined
    ? { heightPx: 1200, widthPx: 2000 }
    : overrides.dimensions;
  return {
    address: overrides.address ?? "Rio de Janeiro, Brazil",
    availability: null,
    bookingUrl: null,
    cancellationPolicy: null,
    category: placeTypes[0] || null,
    currency: null,
    description: null,
    durationMinutes: null,
    imageAlt: `Photo of ${overrides.title || "Place"}`,
    imageAttribution: overrides.attribution ?? "Photographer",
    imageProvider: "Google",
    id: overrides.id || `google_places:${providerPlaceId || overrides.title || "place"}`,
    imageUrl: overrides.imageUrl === undefined ? "/api/travel-data/place-photo?photoReference=photo" : overrides.imageUrl,
    latitude: overrides.latitude ?? -22.9519,
    longitude: overrides.longitude ?? -43.2105,
    metadata: {
      placePhoto: {
        placeTypes,
        primaryPhotoAttributions: overrides.attributions || ["Photographer"],
        primaryPhotoDimensions: dimensions,
        primaryPhotoName: null,
        primaryPhotoReference: overrides.photoReference || "photo",
        providerPlaceId
      }
    },
    priceFrom: null,
    provider: "google_places",
    providerItemId: providerPlaceId,
    rating: overrides.rating ?? 4.7,
    reviewCount: overrides.reviewCount ?? 1000,
    sourceUrl: null,
    title: overrides.title || "Christ the Redeemer Brazil",
    type: "activity"
  };
}

function validSuggestions(overrides = {}) {
  return { latitude: -22.95, longitude: -43.21, ...overrides };
}

test("validation: missing purpose defaults to nearby_activities", () => {
  const result = validators.validateSuggestionsInput(validSuggestions());
  assert.equal(result.ok, true);
  assert.equal(result.value.purpose, "nearby_activities");
});

test("validation: explicit nearby_activities remains accepted", () => {
  const result = validators.validateSuggestionsInput(validSuggestions({ purpose: "nearby_activities" }));
  assert.equal(result.ok, true);
  assert.equal(result.value.purpose, "nearby_activities");
});

test("validation: explicit postcard_gallery is accepted", () => {
  const result = validators.validateSuggestionsInput(validSuggestions({ purpose: "postcard_gallery" }));
  assert.equal(result.ok, true);
  assert.equal(result.value.purpose, "postcard_gallery");
});

test("validation: unknown purpose fails instead of becoming an empty success", () => {
  const result = validators.validateSuggestionsInput(validSuggestions({ purpose: "unknown" }));
  assert.equal(result.ok, false);
  assert.match(result.details.purpose, /nearby_activities or postcard_gallery/);
});

test("validation: route preserves validation failures as client errors", async () => {
  const response = await suggestionsRoute.POST(new Request("https://almidy.test/api/travel-data/suggestions", {
    body: JSON.stringify(validSuggestions({ purpose: "unknown" })),
    headers: { "content-type": "application/json" },
    method: "POST"
  }));
  assert.equal(response.status, 400);
});

test("validation: existing callers retain prior defaults", () => {
  const result = validators.validateSuggestionsInput(validSuggestions());
  assert.deepEqual(result.value, {
    latitude: -22.95,
    limit: 5,
    longitude: -43.21,
    purpose: "nearby_activities",
    radiusMeters: 1600,
    title: null,
    tripId: null
  });
});

test("query planning: normalizes text, removes normalized duplicates, and creates at most three queries", () => {
  const queries = gallery.planPostcardGalleryQueries("  Rio   de Janeiro  ");
  assert.equal(queries.length, 3);
  assert.equal(new Set(queries.map((query) => query.toLowerCase().replace(/\s+/g, " "))).size, queries.length);
  assert.ok(queries.every((query) => query.includes("Rio de Janeiro")));
  assert.ok(queries.length <= gallery.POSTCARD_GALLERY_MAX_DISCOVERY_REQUESTS);
});

test("query planning: empty destination fails safely", () => {
  assert.deepEqual(gallery.planPostcardGalleryQueries(" \n "), []);
});

for (const [label, type] of [
  ["restaurants", "restaurant"],
  ["cafes", "cafe"],
  ["bars", "bar"],
  ["nightlife", "night_club"],
  ["lodging", "lodging"],
  ["stores", "store"],
  ["shopping centers", "shopping_mall"]
]) {
  test(`filtering: excludes ${label}`, () => {
    assert.deepEqual(gallery.rankPostcardGallery([item({ id: type, placeTypes: [type] })], {
      destination: "Brazil"
    }), []);
  });
}

for (const type of ["historical_landmark", "tourist_attraction", "natural_feature", "park", "beach"]) {
  test(`filtering: retains ${type}`, () => {
    assert.equal(gallery.rankPostcardGallery([item({ id: type, placeTypes: [type] })], {
      destination: "Brazil"
    }).length, 1);
  });
}

test("ranking: destination-title relevance wins", () => {
  const relevant = item({ id: "relevant", reviewCount: 100, title: "Brazil Sugarloaf Mountain" });
  const unrelated = item({ address: "Somewhere Else", id: "unrelated", reviewCount: 1_000_000, title: "Generic Viewpoint" });
  assert.equal(gallery.rankPostcardGallery([unrelated, relevant], { destination: "Brazil" })[0].id, relevant.id);
});

test("ranking: iconic type outranks generic popularity", () => {
  const iconic = item({ id: "iconic", placeTypes: ["historical_landmark"], reviewCount: 50, title: "Monument" });
  const generic = item({ id: "generic", placeTypes: ["point_of_interest"], reviewCount: 10_000_000, title: "Popular Place" });
  assert.equal(gallery.rankPostcardGallery([generic, iconic], { destination: "Brazil" })[0].id, iconic.id);
});

test("ranking: landscape imagery is preferred", () => {
  const landscape = item({ id: "landscape", dimensions: { heightPx: 1200, widthPx: 2400 } });
  const portrait = item({ id: "portrait", dimensions: { heightPx: 2400, widthPx: 1200 } });
  assert.equal(gallery.rankPostcardGallery([portrait, landscape], { destination: "" })[0].id, landscape.id);
});

test("ranking: higher usable resolution is preferred", () => {
  const high = item({ id: "high", dimensions: { heightPx: 2000, widthPx: 3000 } });
  const low = item({ id: "low", dimensions: { heightPx: 400, widthPx: 600 } });
  assert.equal(gallery.rankPostcardGallery([low, high], { destination: "" })[0].id, high.id);
});

test("ranking: review prominence and rating are considered without dominating relevance", () => {
  const prominent = item({ address: "Somewhere Else", id: "prominent", rating: 4.9, reviewCount: 10_000, title: "View" });
  const weak = item({ address: "Somewhere Else", id: "weak", rating: 3.5, reviewCount: 10, title: "View" });
  assert.equal(gallery.rankPostcardGallery([weak, prominent], { destination: "" })[0].id, prominent.id);
  const relevant = item({ id: "relevant", rating: 3.5, reviewCount: 10, title: "Brazil View" });
  assert.equal(gallery.rankPostcardGallery([prominent, relevant], { destination: "Brazil" })[0].id, relevant.id);
});

test("ranking: distance is considered", () => {
  const near = item({ id: "near", latitude: 0, longitude: 0 });
  const far = item({ id: "far", latitude: 10, longitude: 10 });
  assert.equal(gallery.rankPostcardGallery([far, near], {
    destination: "",
    origin: { latitude: 0, longitude: 0 }
  })[0].id, near.id);
});

test("ranking: missing dimensions and types are safe", () => {
  const candidate = item({ id: "missing", dimensions: null, placeTypes: [] });
  assert.equal(gallery.rankPostcardGallery([candidate], { destination: "Brazil" })[0].id, candidate.id);
});

test("ranking: ties and input completion order resolve deterministically", () => {
  const alpha = item({ id: "alpha", providerPlaceId: null, title: "Alpha" });
  const beta = item({ id: "beta", providerPlaceId: null, title: "Beta" });
  const forward = gallery.rankPostcardGallery([beta, alpha], { destination: "" }).map((value) => value.id);
  const reverse = gallery.rankPostcardGallery([alpha, beta], { destination: "" }).map((value) => value.id);
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward, ["alpha", "beta"]);
});

test("deduplication: provider IDs collapse to one selected photo per place", () => {
  const low = item({ id: "low", providerPlaceId: "same", dimensions: { heightPx: 400, widthPx: 600 } });
  const high = item({ id: "high", providerPlaceId: "same", dimensions: { heightPx: 2000, widthPx: 3000 } });
  const result = gallery.rankPostcardGallery([low, high], { destination: "" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "high");
});

test("deduplication: safe normalized identity collapses candidates without provider IDs", () => {
  const first = item({ id: "first", providerPlaceId: null, title: "Sugarloaf  Mountain", address: "Rio, Brazil" });
  const second = item({ id: "second", providerPlaceId: null, title: "sugarloaf mountain", address: "Rio,  Brazil" });
  assert.equal(gallery.rankPostcardGallery([first, second], { destination: "Brazil" }).length, 1);
});

test("limits: returns no more than ten results", () => {
  const values = Array.from({ length: 15 }, (_, index) => item({ id: `place-${index}` }));
  assert.equal(gallery.rankPostcardGallery(values, { destination: "Brazil", limit: 99 }).length, 10);
});

function googleResult(id, overrides = {}) {
  return {
    formatted_address: overrides.address || "Rio de Janeiro, Brazil",
    geometry: { location: { lat: -22.95, lng: -43.21 } },
    name: overrides.name || `Brazil Landmark ${id}`,
    photos: overrides.photos || [{ height: 1200, html_attributions: ["<a>Photographer</a>"], photo_reference: `photo-${id}`, width: 2000 }],
    place_id: id,
    rating: 4.8,
    types: ["tourist_attraction"],
    user_ratings_total: 1000
  };
}

async function runPostcardFetch(failures = new Set(), delays = []) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const urls = [];
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    const query = url.searchParams.get("query") || "";
    const index = urls.length - 1;
    if (delays[index]) await new Promise((resolve) => setTimeout(resolve, delays[index]));
    if (failures.has(index)) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ results: [googleResult(`place-${index}`, { name: query })] }) };
  };
  try {
    const results = await travelData.searchNearbyActivities({
      limit: 10,
      location: { latitude: -22.95, longitude: -43.21, title: "Brazil" },
      purpose: "postcard_gallery",
      radiusMeters: 5000
    });
    return { results, urls };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
}

test("partial failure: one failed Google query preserves two successful queries", async () => {
  const { results, urls } = await runPostcardFetch(new Set([1]));
  assert.equal(urls.length, 3);
  assert.equal(results.length, 2);
});

test("partial failure: two failed Google queries preserve one successful query", async () => {
  const { results } = await runPostcardFetch(new Set([0, 2]));
  assert.equal(results.length, 1);
});

test("partial failure: all recoverable provider failures return an empty success", async () => {
  const { results } = await runPostcardFetch(new Set([0, 1, 2]));
  assert.deepEqual(results, []);
});

test("request limits and lazy photos: exactly three discovery searches execute without photo downloads", async () => {
  const { urls } = await runPostcardFetch();
  assert.equal(urls.length, 3);
  assert.ok(urls.every((url) => url.pathname.endsWith("/place/textsearch/json")));
  assert.ok(urls.every((url) => !url.pathname.includes("photo")));
});

test("ranking: provider network completion order cannot change final output", async () => {
  const normal = await runPostcardFetch(new Set(), [0, 5, 10]);
  const reversed = await runPostcardFetch(new Set(), [10, 5, 0]);
  assert.deepEqual(normal.results.map((result) => result.title), reversed.results.map((result) => result.title));
});

test("attribution and security: normalized ranking retains attribution without raw payloads or keys", async () => {
  const { results } = await runPostcardFetch();
  assert.equal(results[0].imageAttribution, "Photographer");
  assert.deepEqual(results[0].metadata.placePhoto.primaryPhotoAttributions, ["Photographer"]);
  const serialized = JSON.stringify(results);
  assert.equal(serialized.includes("test-secret-key"), false);
  assert.equal(Object.hasOwn(results[0].metadata, "photos"), false);
  assert.equal(Object.hasOwn(results[0].metadata, "raw"), false);
});

test("backward compatibility: omitted and explicit nearby purpose have identical behavior", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const urls = [];
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  globalThis.fetch = async (input) => {
    urls.push(new URL(String(input)));
    return { ok: true, json: async () => ({ results: [googleResult("nearby")] }) };
  };
  try {
    const base = { limit: 5, location: { latitude: 1, longitude: 2 }, radiusMeters: 1600 };
    const omitted = await travelData.searchNearbyActivities(base);
    const explicit = await travelData.searchNearbyActivities({ ...base, purpose: "nearby_activities" });
    assert.deepEqual(omitted, explicit);
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => url.pathname.endsWith("/place/nearbysearch/json")));
    assert.ok(urls.every((url) => url.searchParams.get("radius") === "1600"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
});

test("backward compatibility: nearby activities retain Google's first-photo selection", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [googleResult("nearby-photos", {
        photos: [
          { height: 2000, html_attributions: ["First"], photo_reference: "first-photo", width: 1000 },
          { height: 1000, html_attributions: ["Second"], photo_reference: "second-photo", width: 3000 }
        ]
      })]
    })
  });
  try {
    const [result] = await travelData.searchNearbyActivities({
      limit: 5,
      location: { latitude: 1, longitude: 2 },
      purpose: "nearby_activities",
      radiusMeters: 1600
    });
    assert.match(result.imageUrl, /photoReference=first-photo/);
    assert.equal(result.imageAttribution, "First");
    assert.equal(Object.hasOwn(result.metadata, "placePhoto"), false);
    assert.equal(Object.hasOwn(result.metadata, "primaryPhotoDimensions"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
});
