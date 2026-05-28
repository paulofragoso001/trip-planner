export type AiTripPlannerInput = {
  destination: string | null;
  endDate: string | null;
  interests: string | null;
  startDate: string | null;
  travelStyle: string;
  tripId: string | null;
  tripName: string | null;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

const travelStyles = new Set([
  "balanced",
  "relaxed",
  "packed",
  "food_focused",
  "culture_focused",
  "outdoors",
  "nightlife",
  "family_friendly"
]);

export function validateAiTripPlannerInput(
  value: unknown
): ValidationResult<AiTripPlannerInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const destination = readNullableString(value.destination, 300);
  const interests = readNullableString(value.interests, 5000);
  const travelStyle = readNullableString(value.travelStyle ?? value.travel_style, 80);

  if (!destination && !interests) {
    details.body = "Destination or interests are required.";
  }

  return Object.keys(details).length
    ? { details, ok: false }
    : {
        ok: true,
        value: {
          destination,
          endDate: readNullableString(value.endDate ?? value.end_date, 40),
          interests,
          startDate: readNullableString(value.startDate ?? value.start_date, 40),
          travelStyle:
            travelStyle && travelStyles.has(travelStyle) ? travelStyle : "balanced",
          tripId: readNullableString(value.tripId ?? value.trip_id, 120),
          tripName: readNullableString(value.tripName ?? value.trip_name, 300)
        }
      };
}

export function buildAiTripPlannerBrief(input: AiTripPlannerInput) {
  return [
    input.destination ? `Destination: ${input.destination}` : null,
    input.startDate || input.endDate
      ? `Dates: ${input.startDate || "TBD"} to ${input.endDate || "TBD"}`
      : null,
    input.travelStyle ? `Travel style: ${input.travelStyle}` : null,
    input.interests ? `Saved inspiration: ${input.interests}` : null
  ].filter(Boolean).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}
