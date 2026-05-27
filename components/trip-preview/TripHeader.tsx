import { TripEyebrow } from "@/components/trip-ui";

type TripHeaderProps = {
  title: string;
  dateRange?: string;
  destination?: string;
};

export function TripHeader({ title, dateRange, destination }: TripHeaderProps) {
  return (
    <header className="grid gap-2">
      <TripEyebrow>Trip itinerary</TripEyebrow>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black leading-tight text-[#221d17] md:text-5xl">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#5f574d]">
            {[destination, dateRange].filter(Boolean).join(" - ") || "Dates to be confirmed"}
          </p>
        </div>
      </div>
    </header>
  );
}
