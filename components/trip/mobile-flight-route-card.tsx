"use client";

import { ArrowRight, ChevronRight, Plane } from "lucide-react";
import { useState } from "react";
import type { TripMapItem } from "@/components/TripMap";
import { ActivityDetailSheet } from "@/components/trip/activity-detail-sheet";

export type MobileFlightRoutePreview = {
  arriveLabel: string | null;
  dateLabel: string | null;
  departLabel: string | null;
  destinationCode: string | null;
  destinationLabel: string | null;
  id: string;
  item: TripMapItem;
  metaLabel: string | null;
  originCode: string | null;
  originLabel: string | null;
  title: string;
};

type MobileFlightRouteCardProps = {
  flight: MobileFlightRoutePreview | null;
  tripId: string;
};

export function MobileFlightRouteCard({ flight, tripId }: MobileFlightRouteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!flight) return null;

  const origin = flight.originCode || flight.originLabel || "From";
  const destination = flight.destinationCode || flight.destinationLabel || "To";
  const schedule = [flight.dateLabel, flight.departLabel].filter(Boolean).join(" · ");

  return (
    <>
      <button
        type="button"
        data-testid="overview-flight-card"
        onClick={() => setIsOpen(true)}
        className="group w-full rounded-[28px] border border-[#2d58b6]/75 bg-[#020615]/95 p-5 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] transition active:scale-[0.99]"
        aria-label={`Open flight details for ${flight.title}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-300">
              <Plane className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-[#f7bb75]">
                Flight
              </p>
              <h3 className="mt-1 line-clamp-2 text-[1.25rem] font-black leading-tight text-white">
                {flight.title}
              </h3>
              {flight.metaLabel ? (
                <p className="mt-1 text-sm font-bold text-white/55">{flight.metaLabel}</p>
              ) : null}
            </div>
          </div>
          <ChevronRight className="mt-2 h-6 w-6 shrink-0 text-white/55 transition group-active:translate-x-0.5" aria-hidden="true" />
        </div>

        <div className="mt-5 rounded-3xl bg-white/[0.035] p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-3xl font-black tracking-tight text-white">{origin}</p>
              {flight.originLabel && flight.originLabel !== origin ? (
                <p className="mt-1 truncate text-sm font-semibold text-white/50">{flight.originLabel}</p>
              ) : null}
              {flight.departLabel ? (
                <p className="mt-2 text-sm font-black text-[#f7bb75]">{flight.departLabel}</p>
              ) : null}
            </div>
            <div className="flex min-w-14 flex-col items-center gap-2 text-sky-300">
              <span className="h-1 w-14 rounded-full bg-sky-400/80" aria-hidden="true" />
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-3xl font-black tracking-tight text-white">{destination}</p>
              {flight.destinationLabel && flight.destinationLabel !== destination ? (
                <p className="mt-1 truncate text-sm font-semibold text-white/50">{flight.destinationLabel}</p>
              ) : null}
              {flight.arriveLabel ? (
                <p className="mt-2 text-sm font-black text-[#f7bb75]">{flight.arriveLabel}</p>
              ) : null}
            </div>
          </div>
          {schedule ? <p className="mt-3 text-center text-sm font-semibold text-white/45">{schedule}</p> : null}
        </div>
      </button>

      {isOpen ? (
        <ActivityDetailSheet
          target={{ type: "segment", item: flight.item }}
          tripId={tripId}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
