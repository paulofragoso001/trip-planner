export const ALMIDY_SAMPLE_INSPIRATION = {
  barcelona:
    "Planning a Barcelona weekend trip. I want coffee at Nomad Coffee, visit Sagrada Familia, see sunset from Park Guell, and have tapas at El Xampanyet.",
  miami:
    "Planning a Miami weekend trip. I want to visit Wynwood Walls, have dinner at Komodo, walk around Brickell City Centre, go to South Pointe Park, and maybe do a Biscayne Bay boat tour."
} as const;

export type AlmidySampleKey = keyof typeof ALMIDY_SAMPLE_INSPIRATION;

export type FirstRunStep =
  | "add_inspiration"
  | "review_places"
  | "create_trip_plan"
  | "complete";

export type FirstRunState = {
  currentStep: FirstRunStep;
  hasApprovedPlaces: boolean;
  hasMappedStop: boolean;
  hasSavedInspiration: boolean;
  hasTripPlan: boolean;
  isNewUser: boolean;
};

export function readSampleInspiration(value: string | string[] | null | undefined) {
  const key = Array.isArray(value) ? value[0] : value;
  if (isAlmidySampleKey(key)) {
    return {
      key,
      text: ALMIDY_SAMPLE_INSPIRATION[key]
    };
  }

  return null;
}

function isAlmidySampleKey(value: unknown): value is AlmidySampleKey {
  return value === "barcelona" || value === "miami";
}
