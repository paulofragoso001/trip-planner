import { DayGroup } from "./DayGroup";
import type { GroupedPlans } from "./types";

type ItineraryTimelineProps = {
  groupedPlans: GroupedPlans;
  activePlanId?: string;
  onSelectPlan: (id: string) => void;
};

export function ItineraryTimeline({
  groupedPlans,
  activePlanId,
  onSelectPlan
}: ItineraryTimelineProps) {
  const entries = Object.entries(groupedPlans);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-sm text-[#6f675c]">
        No plans yet.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {entries.map(([day, plans]) => (
        <DayGroup
          key={day}
          day={day}
          plans={plans}
          activePlanId={activePlanId}
          onSelectPlan={onSelectPlan}
        />
      ))}
    </div>
  );
}
