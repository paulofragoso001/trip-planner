"use client";

import { Pin } from "@vis.gl/react-google-maps";
import type { TripPlan } from "./types";

type PlanPinProps = {
  plan: TripPlan;
  active?: boolean;
};

export function PlanPin({ plan, active = false }: PlanPinProps) {
  return (
    <div data-plan-id={plan.id} data-testid={`trip-preview-pin-${plan.id}`}>
      <Pin
        background={active ? "#ff385c" : "#1f6feb"}
        borderColor="#ffffff"
        glyph={plan.type.slice(0, 1).toUpperCase()}
        glyphColor="#ffffff"
      />
    </div>
  );
}
