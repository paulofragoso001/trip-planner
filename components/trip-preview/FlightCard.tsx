import { PlanCard } from "./PlanCard";
import type { TripPlan } from "./types";

type FlightCardProps = {
  plan: TripPlan;
  active?: boolean;
  onClick: () => void;
};

export function FlightCard({ plan, active, onClick }: FlightCardProps) {
  return <PlanCard plan={{ ...plan, type: "flight" }} active={active} onClick={onClick} />;
}
