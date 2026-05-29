import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || readLocalEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || readLocalEnv("SUPABASE_SERVICE_ROLE_KEY");

const fixtures = [
  {
    forbidden: ["Planning Spain", "2 days in Barcelona", "then Madrid", "dinner near"],
    input:
      "Planning Spain: 2 days in Barcelona for Sagrada Familia and El Xampanyet, then Madrid for Prado Museum, Retiro Park, and dinner near Gran Via.",
    name: "multi-city travel note",
    required: ["Sagrada Familia", "El Xampanyet", "Prado Museum", "Retiro Park", "Gran Via"]
  },
  {
    forbidden: ["cute restaurant", "fake restaurant"],
    input:
      "Need a cute sushi spot in Brickell, rooftop drinks after, and something near the water for Sunday brunch.",
    name: "vague restaurant note",
    required: ["sushi spot in Brickell", "rooftop drinks", "waterfront brunch"],
    statusByName: {
      "rooftop drinks": "needs_location_confirmation",
      "sushi spot in Brickell": "needs_location_confirmation",
      "waterfront brunch": "needs_location_confirmation"
    }
  },
  {
    input:
      "Explore Wynwood during the day, dinner in Brickell, sunset around South Beach, and maybe coffee in Coconut Grove.",
    name: "neighborhood-heavy note",
    required: ["Wynwood", "Brickell", "South Beach", "Coconut Grove"]
  },
  {
    input:
      "Book a Biscayne Bay boat tour, do an Everglades airboat tour, and maybe a Little Havana food tour.",
    name: "tour activity note",
    required: ["Biscayne Bay boat tour", "Everglades airboat tour", "Little Havana food tour"],
    statusByName: {
      "Biscayne Bay boat tour": "needs_location_confirmation",
      "Everglades airboat tour": "needs_location_confirmation",
      "Little Havana food tour": "needs_location_confirmation"
    }
  },
  {
    forbidden: ["BEST MIAMI SPOTS", "Follow for more travel tips", "#fyp", "#ad", "travel tips"],
    input:
      "BEST MIAMI SPOTS ✨\nWYNW00D WALLS\nK0MODO\nBR1CKELL CITY CENTRE\nSOUTH POINTE PARK\nFollow for more travel tips\n#miamitravel #fyp #ad",
    name: "screenshot OCR noise",
    required: ["Wynwood Walls", "Komodo", "Brickell City Centre", "South Pointe Park"]
  },
  {
    forbidden: ["POV", "save this", "perfect Miami weekend", "travelhack", "thingstodo"],
    input:
      "POV: you found the perfect Miami weekend 😍 save this!! Wynwood Walls → Komodo → Brickell City Centre → South Pointe Park. Boat day on Biscayne Bay if you have time. #miami #travelhack #thingstodo",
    name: "TikTok-style caption",
    required: ["Wynwood Walls", "Komodo", "Brickell City Centre", "South Pointe Park", "Biscayne Bay boat tour"]
  },
  {
    input:
      "Wynwood Walls, Wynwood Wall, The Wynwood Walls, Komodo Miami, Komodo, dinner at Komodo.",
    maxCounts: {
      "Komodo": 1,
      "Wynwood Walls": 1
    },
    name: "duplicate names",
    required: ["Wynwood Walls", "Komodo"]
  },
  {
    forbidden: [
      "Saved Inspiration",
      "Review candidates before promoting them into the itinerary",
      "Destination: Miami",
      "Travel style: balanced",
      "OpenAI generated planner brief",
      "Wayline AI trip planner"
    ],
    input:
      "Saved Inspiration\nReview candidates before promoting them into the itinerary\nDestination: Miami\nTravel style: balanced\nOpenAI generated planner brief\nWayline AI trip planner\nWynwood Walls\nKomodo",
    name: "metadata UI contamination",
    required: ["Wynwood Walls", "Komodo"]
  },
  {
    input:
      "Flying into MIA, staying near citizenM Miami Brickell, then visiting Wynwood Walls and South Pointe Park.",
    name: "hotel airport transport note",
    required: ["Miami International Airport", "citizenM Miami Brickell", "Wynwood Walls", "South Pointe Park"]
  },
  {
    input:
      "Planning Portland: coffee at Coava, Powell’s Books, Japanese Garden, and dinner at Le Pigeon.",
    name: "ambiguous city names",
    required: ["Coava", "Powell's Books", "Portland Japanese Garden", "Le Pigeon"]
  }
] as const;

test("AI extraction quality fixtures return only travel candidates", async ({ request }) => {
  test.setTimeout(240_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "AI extraction quality requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });
  test.skip(
    preflight.status() !== 200,
    "AI extraction quality requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const importIds: string[] = [];
  const sourceTitles: string[] = [];

  try {
    for (const fixture of fixtures) {
      const sourceTitle = `e2e-extraction-quality-${Date.now().toString(36)}-${fixture.name}`;
      sourceTitles.push(sourceTitle);

      const response = await request.post(`${baseUrl}/api/social-imports`, {
        data: {
          processNow: true,
          rawText: fixture.input,
          sourcePlatform: "manual",
          sourceTitle
        },
        headers: dashboardHeaders
      });
      expect(response.status(), fixture.name).toBe(201);
      const payload = await response.json();
      const importId = payload?.data?.socialImport?.id;
      if (typeof importId === "string") importIds.push(importId);

      const places = payload?.data?.extractedPlaces || [];
      const names = places.map((place: any) => String(place.name || ""));
      const normalizedNames = names.map(normalizeNameForAssertion);

      for (const expected of fixture.required) {
        expect(
          normalizedNames.some((name) => name.includes(normalizeNameForAssertion(expected))),
          `${fixture.name} missing ${expected}; got ${names.join(", ")}`
        ).toBeTruthy();
      }

      for (const forbidden of fixture.forbidden || []) {
        expect(
          normalizedNames.some((name) => name.includes(normalizeNameForAssertion(forbidden))),
          `${fixture.name} included forbidden ${forbidden}; got ${names.join(", ")}`
        ).toBeFalsy();
      }

      for (const [expected, maxCount] of Object.entries(fixture.maxCounts || {})) {
        const actualCount = normalizedNames.filter((name) =>
          name.includes(normalizeNameForAssertion(expected))
        ).length;
        expect(actualCount, `${fixture.name} duplicate count for ${expected}`).toBeLessThanOrEqual(maxCount);
      }

      for (const [expected, status] of Object.entries(fixture.statusByName || {})) {
        const place = places.find((candidate: any) =>
          normalizeNameForAssertion(String(candidate.name || "")).includes(
            normalizeNameForAssertion(expected)
          )
        );
        expect(place, `${fixture.name} missing status target ${expected}`).toBeTruthy();
        expect(String(place.status || ""), `${fixture.name} status for ${expected}`).toBe(status);
        expect(place.latitude, `${fixture.name} should not fake latitude for ${expected}`).toBeNull();
        expect(place.longitude, `${fixture.name} should not fake longitude for ${expected}`).toBeNull();
      }
    }
  } finally {
    for (const importId of importIds) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    for (const sourceTitle of sourceTitles) {
      const { data } = await admin
        .from("imported_social_posts")
        .select("id")
        .eq("source_title", sourceTitle);
      const ids = (data || []).map((row: { id: string }) => row.id);
      if (ids.length) {
        await admin.from("extracted_places").delete().in("imported_post_id", ids);
        await admin.from("imported_social_posts").delete().in("id", ids);
      }
    }
  }
});

function readLocalEnv(name: string) {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim() : "";
}

function normalizeNameForAssertion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
