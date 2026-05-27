import { cn, tripUi } from "@/components/trip-ui";
import { PlanTypeBadge } from "./PlanTypeBadge";
import type { TripPlan } from "./types";

type PlanCardProps = {
  plan: TripPlan;
  active?: boolean;
  onClick: () => void;
};

export function PlanCard({ plan, active = false, onClick }: PlanCardProps) {
  const timeLabel = plan.time
    ? `${plan.time}${plan.endTime ? ` - ${plan.endTime}` : ""}`
    : "Time TBD";

  return (
    <button
      data-plan-id={plan.id}
      data-plan-type={plan.type}
      data-testid={`trip-preview-plan-${plan.id}`}
      className={cn(
        "w-full p-4 text-left transition",
        tripUi.card.nested,
        active
          ? "ring-brand bg-blue-50 shadow-sm"
          : "hover:bg-[#faf8f5]"
      )}
      aria-pressed={active}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PlanTypeBadge type={plan.type} />
          <h3 className="mt-2 font-black text-[#221d17]">{plan.title}</h3>
          <p className="mt-1 text-sm text-[#5f574d]">
            {timeLabel}
            {plan.location ? ` - ${plan.location}` : ""}
          </p>
        </div>
      </div>
      {plan.notes ? <p className="mt-3 text-sm text-[#5f574d]">{plan.notes}</p> : null}
    </button>
  );
}
