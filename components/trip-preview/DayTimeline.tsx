import { EmptyState } from "./EmptyState";
import { PlanCard } from "./PlanCard";
import type { GroupedPlans } from "./types";

type DayTimelineProps = {
  groupedPlans: GroupedPlans;
  activePlanId?: string;
  onSelectPlan: (id: string) => void;
};

export function DayTimeline({ groupedPlans, activePlanId, onSelectPlan }: DayTimelineProps) {
  const entries = Object.entries(groupedPlans);

  if (entries.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-5" data-testid="trip-preview-day-timeline">
      {entries.map(([day, plans]) => (
        <section className="grid gap-3" data-testid="trip-preview-day-group" key={day}>
          <h2 className="sticky top-0 z-10 w-fit rounded-full bg-[#f1ede7] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#625a51]">
            {day}
          </h2>
          <div className="grid gap-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                active={plan.id === activePlanId}
                onClick={() => onSelectPlan(plan.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
