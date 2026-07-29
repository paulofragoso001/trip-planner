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
          export class ApiError extends Error {
            constructor(code, message, status, details) {
              super(message);
              this.code = code;
              this.status = status;
              this.details = details;
            }
          }
          export const apiCanonicalSuccess = (value) => Response.json(value);
          export const handleApiError = (error) => Response.json({
            error: {
              code: error?.code || "internal_error",
              message: error?.message || "Unexpected error."
            }
          }, { status: error?.status || 500 });
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
const resolvePlaceRoute = await import("../../app/api/travel-data/resolve-place/route.ts");
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
      postcardDiscoveryCategory: overrides.postcardDiscoveryCategory || null,
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

test("ranking: Christ the Redeemer outranks a generic Rio museum", () => {
  const landmark = item({
    id: "redeemer",
    placeTypes: ["historical_landmark", "tourist_attraction"],
    postcardDiscoveryCategory: "iconic_landmark",
    reviewCount: 500,
    title: "Christ the Redeemer"
  });
  const museum = item({
    id: "museum",
    placeTypes: ["museum", "point_of_interest"],
    postcardDiscoveryCategory: "tourist_attraction",
    reviewCount: 100_000,
    title: "Rio Museum"
  });
  const ranked = gallery.rankPostcardGallery([museum, landmark], {
    destination: "Rio de Janeiro"
  });
  assert.deepEqual(ranked.map((candidate) => candidate.id), ["redeemer", "museum"]);
});

test("ranking: Sugarloaf Mountain outranks a generic cultural building", () => {
  const sugarloaf = item({
    id: "sugarloaf",
    placeTypes: ["natural_feature", "tourist_attraction"],
    postcardDiscoveryCategory: "scenic_view",
    title: "Sugarloaf Mountain"
  });
  const building = item({
    id: "cultural-building",
    placeTypes: ["establishment", "point_of_interest"],
    postcardDiscoveryCategory: "tourist_attraction",
    reviewCount: 50_000,
    title: "Rio Cultural Building"
  });
  assert.equal(gallery.rankPostcardGallery([building, sugarloaf], {
    destination: "Rio de Janeiro"
  })[0].id, "sugarloaf");
});

test("ranking: scenic beach imagery outranks a weak interior attraction", () => {
  const beach = item({
    id: "copacabana",
    placeTypes: ["beach", "natural_feature"],
    postcardDiscoveryCategory: "scenic_view",
    title: "Copacabana Beach"
  });
  const interior = item({
    dimensions: { heightPx: 2400, widthPx: 1200 },
    id: "interior",
    placeTypes: ["museum", "point_of_interest"],
    postcardDiscoveryCategory: "tourist_attraction",
    reviewCount: 500_000,
    title: "Rio Interior Collection"
  });
  assert.equal(gallery.rankPostcardGallery([interior, beach], {
    destination: "Rio de Janeiro"
  })[0].id, "copacabana");
});

test("ranking: an exact museum query still permits the museum to rank first", () => {
  const museum = item({
    id: "museum",
    placeTypes: ["museum"],
    postcardDiscoveryCategory: "tourist_attraction",
    title: "Museum of Modern Art Rio"
  });
  const skyline = item({
    id: "skyline",
    placeTypes: ["tourist_attraction"],
    postcardDiscoveryCategory: "scenic_view",
    title: "Rio Skyline"
  });
  assert.equal(gallery.rankPostcardGallery([skyline, museum], {
    destination: "Museum of Modern Art Rio"
  })[0].id, "museum");
});

test("ranking: discovery intent is retained independently of response order", () => {
  const iconic = item({
    id: "iconic",
    placeTypes: ["point_of_interest"],
    postcardDiscoveryCategory: "iconic_landmark",
    title: "Destination Monument"
  });
  const generic = item({
    id: "generic",
    placeTypes: ["point_of_interest"],
    postcardDiscoveryCategory: "tourist_attraction",
    title: "Destination Attraction"
  });
  const forward = gallery.rankPostcardGallery([generic, iconic], {
    destination: "Destination"
  }).map((candidate) => candidate.id);
  const reverse = gallery.rankPostcardGallery([iconic, generic], {
    destination: "Destination"
  }).map((candidate) => candidate.id);
  assert.deepEqual(forward, ["iconic", "generic"]);
  assert.deepEqual(reverse, forward);
});

test("ranking: distance remains secondary to iconic relevance", () => {
  const iconic = item({
    id: "iconic-farther",
    latitude: -22.95,
    longitude: -43.25,
    placeTypes: ["historical_landmark"],
    postcardDiscoveryCategory: "iconic_landmark",
    title: "Famous Monument"
  });
  const nearby = item({
    id: "generic-nearby",
    latitude: -22.95,
    longitude: -43.21,
    placeTypes: ["point_of_interest"],
    postcardDiscoveryCategory: "tourist_attraction",
    reviewCount: 100_000,
    title: "Nearby Building"
  });
  assert.equal(gallery.rankPostcardGallery([nearby, iconic], {
    destination: "Rio de Janeiro",
    origin: { latitude: -22.95, longitude: -43.21 }
  })[0].id, "iconic-farther");
});

test("ranking: lower-tier candidates remain available after iconic candidates", () => {
  const iconic = item({
    id: "iconic",
    placeTypes: ["monument"],
    postcardDiscoveryCategory: "iconic_landmark",
    title: "Famous Monument"
  });
  const museum = item({
    id: "museum",
    placeTypes: ["museum"],
    postcardDiscoveryCategory: "tourist_attraction",
    title: "City Museum"
  });
  const ranked = gallery.rankPostcardGallery([museum, iconic], {
    destination: "City",
    limit: 10
  });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[1].id, "museum");
});

test("hero selection skips an unsuitable top gallery candidate", () => {
  const portraitLandmark = item({
    dimensions: { heightPx: 3000, widthPx: 1200 },
    id: "portrait",
    placeTypes: ["historical_landmark"],
    postcardDiscoveryCategory: "iconic_landmark",
    title: "City Monument"
  });
  const landscape = item({
    dimensions: { heightPx: 1600, widthPx: 2600 },
    id: "landscape",
    placeTypes: ["natural_feature"],
    postcardDiscoveryCategory: "scenic_view",
    title: "City Skyline View"
  });
  assert.equal(gallery.selectPostcardHero([portraitLandmark, landscape], {
    destination: "City"
  })?.id, "landscape");
});

test("hero selection returns a deterministic usable fallback without iconic metadata", () => {
  const alpha = item({
    id: "alpha-fallback",
    placeTypes: [],
    postcardDiscoveryCategory: "destination_discovery",
    title: "Alpha"
  });
  const beta = item({
    id: "beta-fallback",
    placeTypes: [],
    postcardDiscoveryCategory: "destination_discovery",
    title: "Beta"
  });
  const forward = gallery.selectPostcardHero([beta, alpha], { destination: "" });
  const reverse = gallery.selectPostcardHero([alpha, beta], { destination: "" });
  assert.equal(forward?.id, reverse?.id);
});

for (const [destination, iconicTitle, weakTitle] of [
  ["Rio de Janeiro", "Christ the Redeemer", "Rio Convention Center"],
  ["Paris", "Eiffel Tower", "Paris Museum Annex"],
  ["New York", "Statue of Liberty", "New York Cultural Building"],
  ["Tokyo", "Tokyo Tower Skyline View", "Tokyo Interior Collection"],
  ["Rome", "Colosseum Monument", "Rome Conference Center"]
]) {
  test(`ranking regression: ${destination} favors its iconic fixture`, () => {
    const iconic = item({
      id: `${destination}-iconic`,
      placeTypes: ["historical_landmark", "tourist_attraction"],
      postcardDiscoveryCategory: "iconic_landmark",
      title: iconicTitle
    });
    const weak = item({
      id: `${destination}-weak`,
      placeTypes: ["establishment", "point_of_interest"],
      postcardDiscoveryCategory: "tourist_attraction",
      reviewCount: 1_000_000,
      title: weakTitle
    });
    assert.equal(gallery.rankPostcardGallery([weak, iconic], {
      destination
    })[0].id, iconic.id);
  });
}

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
    rating: overrides.rating ?? 4.8,
    types: overrides.types || ["tourist_attraction"],
    user_ratings_total: overrides.reviewCount ?? 1000
  };
}

async function runResolvedHeroFixture({
  destination,
  iconic,
  scenic = null,
  tourist = null,
  failedCategories = new Set()
}) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const urls = [];
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  const base = googleResult("base-place", {
    address: destination,
    name: destination,
    photos: [{
      height: 1200,
      html_attributions: ["<a>Base photographer</a>"],
      photo_reference: "base-photo",
      width: 2000
    }],
    types: ["locality", "political"]
  });
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.endsWith("/findplacefromtext/json")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [base], status: "OK" })
      };
    }
    const query = url.searchParams.get("query") || "";
    const category = query.includes("iconic landmarks")
      ? "iconic_landmark"
      : query.includes("scenic viewpoints")
        ? "scenic_view"
        : "tourist_attraction";
    if (failedCategories.has(category)) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    const result = category === "iconic_landmark"
      ? iconic
      : category === "scenic_view"
        ? scenic
        : tourist;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: result ? [result] : [],
        status: result ? "OK" : "ZERO_RESULTS"
      })
    };
  };
  try {
    const resolved = await travelData.resolvePlaceWithPostcardHero({
      name: destination
    });
    return { resolved, urls };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
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
    return { ok: true, status: 200, json: async () => ({
      results: [googleResult(`place-${index}`, { name: query })],
      status: "OK"
    }) };
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

test("partial failure: all provider failures preserve the server error contract", async () => {
  await assert.rejects(
    () => runPostcardFetch(new Set([0, 1, 2])),
    (error) => error?.code === "bad_gateway" && error?.status === 502
  );
});

async function runPostcardProviderPayloads(payloads, operation) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  let callCount = 0;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => payloads[Math.min(callCount++, payloads.length - 1)]
  });
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
}

function postcardSearch() {
  return travelData.searchNearbyActivities({
    limit: 10,
    location: { latitude: -22.95, longitude: -43.21, title: "Brazil" },
    purpose: "postcard_gallery",
    radiusMeters: 5000
  });
}

test("provider status: OK returns normalized candidates", async () => {
  const results = await runPostcardProviderPayloads([
    { results: [googleResult("ok")], status: "OK" }
  ], postcardSearch);
  assert.equal(results.length, 1);
  assert.equal(results[0].providerItemId, "ok");
});

test("provider status: OK with empty results is a valid empty gallery", async () => {
  const results = await runPostcardProviderPayloads([
    { results: [], status: "OK" }
  ], postcardSearch);
  assert.deepEqual(results, []);
});

test("provider status: ZERO_RESULTS is a valid empty gallery", async () => {
  const results = await runPostcardProviderPayloads([
    { status: "ZERO_RESULTS" }
  ], postcardSearch);
  assert.deepEqual(results, []);
});

for (const [status, expectedCode] of [
  ["REQUEST_DENIED", "provider_authorization"],
  ["INVALID_REQUEST", "provider_invalid_request"],
  ["OVER_QUERY_LIMIT", "provider_quota"],
  ["RESOURCE_EXHAUSTED", "provider_quota"],
  ["UNKNOWN_ERROR", "provider_transient"],
  ["UNRECOGNIZED_STATUS", "provider_failed"]
]) {
  test(`provider status: ${status} rejects instead of becoming empty inventory`, async () => {
    const originalInfo = console.info;
    const logs = [];
    console.info = (value) => logs.push(String(value));
    try {
      await assert.rejects(
        () => runPostcardProviderPayloads([
          { error_message: "provider detail must remain server-only", status }
        ], postcardSearch),
        (error) => error?.code === "bad_gateway" &&
          error?.status === 502 &&
          !String(error?.message).includes("provider detail")
      );
    } finally {
      console.info = originalInfo;
    }
    assert.ok(logs.every((line) => line.includes(expectedCode)));
  });
}

test("provider status: one success plus two provider failures preserves partial results", async () => {
  const results = await runPostcardProviderPayloads([
    { error_message: "denied detail", status: "REQUEST_DENIED" },
    { results: [googleResult("partial")], status: "OK" },
    { error_message: "quota detail", status: "OVER_QUERY_LIMIT" }
  ], postcardSearch);
  assert.equal(results.length, 1);
  assert.equal(results[0].providerItemId, "partial");
});

test("provider status: all denials produce the existing sanitized 502 client contract", async () => {
  const rawMessage = "This API key is not authorized for this service.";
  const response = await runPostcardProviderPayloads([
    { error_message: rawMessage, status: "REQUEST_DENIED" }
  ], () => suggestionsRoute.POST(new Request(
    "https://almidy.test/api/travel-data/suggestions",
    {
      body: JSON.stringify(validSuggestions({
        limit: 10,
        purpose: "postcard_gallery",
        radiusMeters: 5000,
        title: "Brazil"
      })),
      headers: { "content-type": "application/json" },
      method: "POST"
    }
  )));
  const body = await response.text();
  assert.equal(response.status, 502);
  assert.equal(body.includes(rawMessage), false);
  assert.equal(body.includes("test-secret-key"), false);
  assert.match(body, /Destination images are temporarily unavailable/);
});

test("provider diagnostics contain classifications but no key or raw provider message", async () => {
  const originalInfo = console.info;
  const logs = [];
  console.info = (value) => logs.push(String(value));
  try {
    await assert.rejects(() => runPostcardProviderPayloads([
      {
        error_message: "Raw denial detail containing test-secret-key",
        status: "REQUEST_DENIED"
      }
    ], postcardSearch));
  } finally {
    console.info = originalInfo;
  }
  const serialized = logs.join("\n");
  assert.match(serialized, /places_legacy_text_search/);
  assert.match(serialized, /provider_authorization/);
  assert.match(serialized, /REQUEST_DENIED/);
  assert.equal(serialized.includes("test-secret-key"), false);
  assert.equal(serialized.includes("Raw denial detail"), false);
});

test("hero resolution remains independent from postcard provider-status handling", async () => {
  const resolved = await runPostcardProviderPayloads([
    {
      candidates: [{
        formatted_address: "Brazil",
        geometry: { location: { lat: -14.235, lng: -51.9253 } },
        name: "Brazil",
        photos: [{
          height: 1200,
          html_attributions: ["<a>Photographer</a>"],
          photo_reference: "hero-photo-reference",
          width: 2000
        }],
        place_id: "hero-place",
        types: ["country"]
      }],
      status: "OK"
    }
  ], () => travelData.resolvePlace({ name: "Brazil" }));
  assert.equal(resolved.diagnostics?.status, "resolved");
  assert.equal(resolved.placeId, "hero-place");
  assert.match(resolved.inventoryItem?.imageUrl || "", /place-photo/);

  const photoRouteSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/travel-data/place-photo/route.ts"),
    "utf8"
  );
  assert.match(photoRouteSource, /maps\.googleapis\.com\/maps\/api\/place\/photo/);
  assert.match(photoRouteSource, /places\.googleapis\.com\/v1\/\$\{normalizedName\}\/media/);
});

for (const [destination, iconicTitle, iconicTypes] of [
  ["Rio de Janeiro", "Christ the Redeemer", ["historical_landmark", "tourist_attraction"]],
  ["Paris", "Eiffel Tower", ["historical_landmark", "tourist_attraction"]],
  ["New York", "Statue of Liberty Skyline", ["historical_landmark", "tourist_attraction"]],
  ["Tokyo", "Tokyo Tower Skyline View", ["tourist_attraction"]],
  ["Rome", "Colosseum Monument", ["historical_landmark", "tourist_attraction"]]
]) {
  test(`automatic hero: ${destination} uses its ranked iconic postcard candidate`, async () => {
    const iconic = googleResult(`${destination}-iconic`, {
      address: destination,
      name: iconicTitle,
      photos: [{
        height: 1600,
        html_attributions: [`<a>${destination} photographer</a>`],
        photo_reference: `${destination}-iconic-photo`,
        width: 2800
      }],
      types: iconicTypes
    });
    const weak = googleResult(`${destination}-museum`, {
      address: destination,
      name: `${destination} Generic Museum`,
      reviewCount: 500_000,
      types: ["museum", "point_of_interest"]
    });
    const { resolved, urls } = await runResolvedHeroFixture({
      destination,
      iconic,
      tourist: weak
    });

    assert.equal(urls.filter((url) => url.pathname.endsWith("/place/textsearch/json")).length, 3);
    const heroUrl = new URL(resolved.inventoryItem?.imageUrl || "", "https://almidy.test");
    assert.equal(heroUrl.searchParams.get("photoReference"), `${destination}-iconic-photo`);
    assert.equal(resolved.inventoryItem?.imageAttribution, `${destination} photographer`);
    assert.equal(resolved.inventoryItem?.title, destination);
  });
}

test("automatic hero: an explicit museum query can select that museum", async () => {
  const destination = "Museum of Modern Art Rio";
  const museum = googleResult("museum", {
    address: "Rio de Janeiro, Brazil",
    name: destination,
    photos: [{
      height: 1400,
      html_attributions: ["<a>Museum photographer</a>"],
      photo_reference: "museum-photo",
      width: 2400
    }],
    types: ["museum", "tourist_attraction"]
  });
  const skyline = googleResult("skyline", {
    address: "Rio de Janeiro, Brazil",
    name: "Rio Skyline View",
    photos: [{
      height: 1400,
      html_attributions: ["<a>Skyline photographer</a>"],
      photo_reference: "skyline-photo",
      width: 2400
    }],
    types: ["tourist_attraction"]
  });
  const { resolved } = await runResolvedHeroFixture({
    destination,
    iconic: skyline,
    tourist: museum
  });
  assert.match(resolved.inventoryItem?.imageUrl || "", /museum-photo/);
  assert.equal(resolved.inventoryItem?.imageAttribution, "Museum photographer");
});

test("automatic hero: no postcard candidates preserves the representative place photo", async () => {
  const { resolved } = await runResolvedHeroFixture({
    destination: "Rio de Janeiro",
    iconic: null
  });
  assert.match(resolved.inventoryItem?.imageUrl || "", /base-photo/);
  assert.equal(resolved.inventoryItem?.imageAttribution, "Base photographer");
});

test("automatic hero: all postcard HTTP failures preserve the representative place photo", async () => {
  const { resolved } = await runResolvedHeroFixture({
    destination: "Rio de Janeiro",
    failedCategories: new Set([
      "iconic_landmark",
      "scenic_view",
      "tourist_attraction"
    ]),
    iconic: null
  });
  assert.match(resolved.inventoryItem?.imageUrl || "", /base-photo/);
  assert.equal(resolved.inventoryItem?.imageAttribution, "Base photographer");
});

test("automatic hero: partial postcard success remains eligible for hero selection", async () => {
  const scenic = googleResult("partial-scenic", {
    address: "Rio de Janeiro, Brazil",
    name: "Sugarloaf Mountain Scenic View",
    photos: [{
      height: 1600,
      html_attributions: ["<a>Scenic photographer</a>"],
      photo_reference: "partial-scenic-photo",
      width: 2800
    }],
    types: ["natural_feature", "tourist_attraction"]
  });
  const { resolved } = await runResolvedHeroFixture({
    destination: "Rio de Janeiro",
    failedCategories: new Set(["iconic_landmark", "tourist_attraction"]),
    iconic: null,
    scenic
  });
  assert.match(resolved.inventoryItem?.imageUrl || "", /partial-scenic-photo/);
  assert.equal(resolved.inventoryItem?.imageAttribution, "Scenic photographer");
});

test("automatic hero: resolve-place response remains native-decoder compatible", async () => {
  const iconic = googleResult("compatible", {
    name: "Christ the Redeemer",
    photos: [{
      height: 1600,
      html_attributions: ["<a>Compatible photographer</a>"],
      photo_reference: "compatible-photo",
      width: 2800
    }],
    types: ["historical_landmark"]
  });
  const { resolved } = await runResolvedHeroFixture({
    destination: "Rio de Janeiro",
    iconic
  });
  const nativeVisibleShape = JSON.parse(JSON.stringify({ data: { resolved } }));
  assert.equal(typeof nativeVisibleShape.data.resolved.latitude, "number");
  assert.equal(typeof nativeVisibleShape.data.resolved.longitude, "number");
  assert.equal(typeof nativeVisibleShape.data.resolved.inventoryItem.imageUrl, "string");
  assert.equal(typeof nativeVisibleShape.data.resolved.inventoryItem.title, "string");
});

test("automatic hero: resolve-place route returns the ranked image in the existing contract", async () => {
  const iconic = googleResult("route-compatible", {
    name: "Christ the Redeemer",
    photos: [{
      height: 1600,
      html_attributions: ["<a>Route photographer</a>"],
      photo_reference: "route-compatible-photo",
      width: 2800
    }],
    types: ["historical_landmark"]
  });
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-secret-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/findplacefromtext/json")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [googleResult("route-base", {
            name: "Rio de Janeiro",
            photos: [{
              height: 1200,
              html_attributions: ["<a>Base photographer</a>"],
              photo_reference: "route-base-photo",
              width: 2000
            }],
            types: ["locality"]
          })],
          status: "OK"
        })
      };
    }
    const query = url.searchParams.get("query") || "";
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: query.includes("iconic landmarks") ? [iconic] : [],
        status: query.includes("iconic landmarks") ? "OK" : "ZERO_RESULTS"
      })
    };
  };
  try {
    const response = await resolvePlaceRoute.POST(new Request(
      "https://almidy.test/api/travel-data/resolve-place",
      {
        body: JSON.stringify({ name: "Rio de Janeiro" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }
    ));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data, undefined);
    assert.equal(typeof payload.resolved.latitude, "number");
    assert.match(payload.resolved.inventoryItem.imageUrl, /route-compatible-photo/);
    assert.equal(payload.resolved.inventoryItem.imageAttribution, "Route photographer");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
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
    return { ok: true, json: async () => ({ results: [googleResult("nearby")], status: "OK" }) };
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
      })],
      status: "OK"
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
