import {
  Map,
  Plane,
  Plus,
  Search,
  Sparkles
} from "lucide-react";
import { MobileHomeAction, MobileHomeTile } from "@/components/dashboard/mobile-home-actions";

export function MobileHomeContent({
  ideasWaitingCount,
  primaryHref,
  primaryLabel,
  primaryMeta
}: {
  ideasWaitingCount: number;
  primaryHref: string;
  primaryLabel: string;
  primaryMeta: string;
}) {
  return (
    <section
      className="relative z-10 bg-[#020817] px-4 pb-[calc(176px+env(safe-area-inset-bottom))] pt-5 before:pointer-events-none before:absolute before:inset-x-0 before:-top-20 before:h-24 before:bg-[linear-gradient(180deg,rgba(2,8,23,0),rgba(2,8,23,0.84)_58%,#020817_100%)]"
      data-testid="mobile-home-wallet-content"
    >
      <div className="mx-auto max-w-[25rem]">
        <div className="relative mb-3 text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300/86">
            Wayline
          </p>
          <h1 className="mt-1.5 text-[2.15rem] font-black leading-none tracking-normal text-white">
            Travel wallet
          </h1>
          <p className="mx-auto mt-1.5 max-w-[20rem] text-sm font-semibold leading-5 text-slate-300">
            Pick up a trip, start planning, or review saved ideas.
          </p>
        </div>

        <div
          className="rounded-[1.75rem] border border-white/12 bg-[#050914] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
          data-testid="mobile-home-actions"
        >
          <div className="grid gap-2">
            <MobileHomeAction
              href={primaryHref}
              icon={<Plane className="h-5 w-5" aria-hidden="true" />}
              label={primaryLabel}
              meta={primaryMeta}
              primary
            />
            <div className="grid grid-cols-2 gap-2">
              <MobileHomeTile
                href="/dashboard/imports"
                icon={<Plus className="h-5 w-5" aria-hidden="true" />}
                label="Add idea"
              />
              <MobileHomeTile
                href="/dashboard/search"
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                label="Search"
              />
            </div>
            {ideasWaitingCount > 0 ? (
              <MobileHomeAction
                href="/dashboard/imports#ai-review"
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                label="Review places"
                meta={`${ideasWaitingCount} item${ideasWaitingCount === 1 ? "" : "s"} waiting`}
              />
            ) : null}
            <MobileHomeAction
              href="/dashboard/map"
              icon={<Map className="h-5 w-5" aria-hidden="true" />}
              label="Open map"
              meta="View your trips on the map."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
