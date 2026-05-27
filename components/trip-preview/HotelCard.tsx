import { PlanCard } from "./PlanCard";
import type { TripPlan } from "./types";

type HotelCardProps = {
  plan: TripPlan;
  active?: boolean;
  onClick: () => void;
};

export function HotelCard({ plan, active, onClick }: HotelCardProps) {
  return <PlanCard plan={{ ...plan, type: "hotel" }} active={active} onClick={onClick} />;
}
