"use client";

import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import { PlanPin } from "./PlanPin";
import type { TripPlan } from "./types";

type MapPanelProps = {
  plans: TripPlan[];
  activePlan?: TripPlan;
  onSelectPlan: (id: string) => void;
};

const fallbackCenter = { lat: 25.7617, lng: -80.1918 };

export function MapPanel({ plans, activePlan, onSelectPlan }: MapPanelProps) {
  const center =
    typeof activePlan?.lat === "number" && typeof activePlan.lng === "number"
      ? { lat: activePlan.lat, lng: activePlan.lng }
      : fallbackCenter;

  const mappablePlans = plans.filter(
    (plan) => typeof plan.lat === "number" && typeof plan.lng === "number"
  );

  return (
    <section
      aria-label="Trip map"
      className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm"
      data-testid="trip-preview-map-panel"
    >
      <div aria-hidden="true" className="hidden" data-testid="trip-preview-pin-list">
        {mappablePlans.map((plan) => (
          <span
            data-plan-id={plan.id}
            data-testid={`trip-preview-pin-${plan.id}`}
            key={plan.id}
          />
        ))}
      </div>
      <div className="aspect-[16/10] w-full min-h-[360px]">
        <Map
          defaultCenter={center}
          defaultZoom={12}
          disableDefaultUI
          gestureHandling="greedy"
          mapId="wayline-trip-preview"
        >
          {mappablePlans.map((plan) => (
            <AdvancedMarker
              key={plan.id}
              position={{ lat: plan.lat!, lng: plan.lng! }}
              onClick={() => onSelectPlan(plan.id)}
            >
              <PlanPin plan={plan} active={plan.id === activePlan?.id} />
            </AdvancedMarker>
          ))}
        </Map>
      </div>
    </section>
  );
}
