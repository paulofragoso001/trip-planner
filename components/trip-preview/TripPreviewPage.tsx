"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { useMemo, useState } from "react";
import { DayTimeline } from "./DayTimeline";
import { DirectionsPanel } from "./DirectionsPanel";
import { EmptyState } from "./EmptyState";
import { MapPanel } from "./MapPanel";
import { MobileMapCarousel } from "./MobileMapCarousel";
import { PrintExportToolbar } from "./PrintExportToolbar";
import { TripHeader } from "./TripHeader";
import { WeatherStrip } from "./WeatherStrip";
import type { DirectionLeg, GroupedPlans, TripPlan, DailyWeather } from "./types";

type TripPreviewPageProps = {
  title: string;
  dateRange?: string;
  destination?: string;
  plans: TripPlan[];
  weather?: DailyWeather[];
  directions?: DirectionLeg[];
};

export function TripPreviewPage({
  title,
  dateRange,
  destination,
  plans,
  weather = [],
  directions = []
}: TripPreviewPageProps) {
  const [activePlanId, setActivePlanId] = useState(plans[0]?.id ?? "");
  const [showMaps, setShowMaps] = useState(true);
  const [showDirections, setShowDirections] = useState(true);
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];

  const groupedPlans = useMemo<GroupedPlans>(() => {
    return plans.reduce<GroupedPlans>((groups, plan) => {
      groups[plan.dayLabel] ??= [];
      groups[plan.dayLabel].push(plan);
      return groups;
    }, {});
  }, [plans]);

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}>
      <main
        className="min-h-screen bg-[#f7f6f2] text-[#221d17]"
        data-testid="trip-preview-page"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
          <TripHeader title={title} dateRange={dateRange} destination={destination} />
          <div className="mt-5 grid gap-5">
            <PrintExportToolbar
              showMaps={showMaps}
              showDirections={showDirections}
              onToggleMaps={() => setShowMaps((current) => !current)}
              onToggleDirections={() => setShowDirections((current) => !current)}
            />
            <WeatherStrip weather={weather} />
          </div>
          {plans.length === 0 ? (
            <div className="mt-5">
              <EmptyState />
            </div>
          ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.95fr]">
            <div className="grid gap-5 lg:order-1">
              <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
                <DayTimeline
                  groupedPlans={groupedPlans}
                  activePlanId={activePlanId}
                  onSelectPlan={setActivePlanId}
                />
              </div>
              {showDirections ? (
                <DirectionsPanel
                  activePlan={activePlan}
                  directions={directions}
                  plans={plans}
                />
              ) : null}
            </div>
            {showMaps ? (
              <div className="grid gap-3 lg:order-2">
                <MapPanel
                  plans={plans}
                  activePlan={activePlan}
                  onSelectPlan={setActivePlanId}
                />
                <MobileMapCarousel
                  plans={plans}
                  activePlanId={activePlanId}
                  onSelectPlan={setActivePlanId}
                />
              </div>
            ) : null}
          </div>
          )}
        </div>
      </main>
    </APIProvider>
  );
}
