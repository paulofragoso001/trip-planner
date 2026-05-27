"use client";

import { PlanCard } from "./PlanCard";
import type { TripPlan } from "./types";

type MobileMapCarouselProps = {
  plans: TripPlan[];
  activePlanId?: string;
  onSelectPlan: (id: string) => void;
};

export function MobileMapCarousel({
  plans,
  activePlanId,
  onSelectPlan
}: MobileMapCarouselProps) {
  return (
    <div
      className="flex snap-x gap-3 overflow-x-auto pb-2 md:hidden"
      data-testid="trip-preview-mobile-carousel"
    >
      {plans.map((plan) => (
        <div key={plan.id} className="min-w-[82%] snap-center">
          <PlanCard
            plan={plan}
            active={plan.id === activePlanId}
            onClick={() => onSelectPlan(plan.id)}
          />
        </div>
      ))}
    </div>
  );
}
