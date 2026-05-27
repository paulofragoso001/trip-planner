import { TripCard, TripEyebrow } from "@/components/trip-ui";
import type { DirectionLeg, TripPlan } from "./types";

type DirectionsPanelProps = {
  activePlan?: TripPlan;
  directions?: DirectionLeg[];
  plans: TripPlan[];
};

export function DirectionsPanel({ activePlan, directions = [], plans }: DirectionsPanelProps) {
  if (!activePlan || directions.length === 0) {
    return null;
  }

  const leg =
    directions.find((item) => item.fromPlanId === activePlan.id) ||
    directions.find((item) => item.toPlanId === activePlan.id) ||
    directions[0];
  const from = plans.find((plan) => plan.id === leg.fromPlanId);
  const to = plans.find((plan) => plan.id === leg.toPlanId);

  return (
    <TripCard
      as="section"
      aria-labelledby="trip-preview-directions-title"
      className="p-5"
      data-testid="trip-preview-directions"
      variant="surfaceSoft"
    >
      <TripEyebrow>Directions</TripEyebrow>
      <h2 id="trip-preview-directions-title" className="mt-2 text-lg font-black text-[#221d17]">
        {from?.title || "Previous plan"} to {to?.title || "Next plan"}
      </h2>
      <p className="mt-2 text-sm text-[#5f574d]">
        {leg.summary}
        {[leg.distance, leg.duration].filter(Boolean).length
          ? ` - ${[leg.distance, leg.duration].filter(Boolean).join(" - ")}`
          : ""}
      </p>
      {leg.mapNote ? <p className="mt-2 text-sm text-[#5f574d]">{leg.mapNote}</p> : null}
    </TripCard>
  );
}
