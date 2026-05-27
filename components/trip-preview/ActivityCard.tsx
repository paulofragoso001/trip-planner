import { PlanCard } from "./PlanCard";
import type { TripPlan } from "./types";

type ActivityCardProps = {
  plan: TripPlan;
  active?: boolean;
  onClick: () => void;
};

export function ActivityCard({ plan, active, onClick }: ActivityCardProps) {
  return <PlanCard plan={{ ...plan, type: "activity" }} active={active} onClick={onClick} />;
}
