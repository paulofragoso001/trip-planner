import { TripCard, TripEyebrow } from "@/components/trip-ui";
import type { DailyWeather } from "./types";

type WeatherStripProps = {
  weather?: DailyWeather[];
};

export function WeatherStrip({ weather = [] }: WeatherStripProps) {
  if (weather.length === 0) {
    return null;
  }

  return (
    <TripCard
      className="flex gap-2 overflow-x-auto p-3"
      data-testid="trip-preview-weather-strip"
      variant="surfaceSoft"
    >
      {weather.map((day) => (
        <TripCard key={day.dayLabel} className="min-w-[140px] p-3" variant="inset">
          <TripEyebrow>{day.dayLabel}</TripEyebrow>
          <p className="mt-1 text-sm font-bold text-[#221d17]">{day.summary}</p>
          {typeof day.high === "number" || typeof day.low === "number" ? (
            <p className="mt-1 text-xs text-[#5f574d]">
              {[day.high ? `${day.high} high` : null, day.low ? `${day.low} low` : null]
                .filter(Boolean)
                .join(" / ")}
            </p>
          ) : null}
        </TripCard>
      ))}
    </TripCard>
  );
}
