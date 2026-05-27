import { PlanCard } from "./PlanCard";
import type { TripPlan } from "./types";

type DayGroupProps = {
  day: string;
  plans: TripPlan[];
  activePlanId?: string;
  onSelectPlan: (id: string) => void;
};

export function DayGroup({ day, plans, activePlanId, onSelectPlan }: DayGroupProps) {
  return (
    <section className="grid gap-3">
      <h2 className="sticky top-0 z-10 w-fit rounded-full bg-[#f1ede7] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#7a7166]">
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
  );
}
