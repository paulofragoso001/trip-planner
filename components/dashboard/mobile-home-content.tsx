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
      className="relative z-10 bg-[#020817] px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4"
      data-testid="mobile-home-wallet-content"
    >
      <div className="mx-auto max-w-[25rem]">
        <div className="mb-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300/86">
            Wayline
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none tracking-normal text-white">
            Travel wallet
          </h1>
          <p className="mx-auto mt-2 max-w-[20rem] text-sm font-semibold leading-5 text-slate-300">
            Pick up a trip, start planning, or review saved ideas.
          </p>
        </div>

        <div
          className="rounded-[2rem] border border-white/12 bg-[#050914] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
          data-testid="mobile-home-actions"
        >
          <div className="grid gap-3">
            <MobileHomeAction
              href={primaryHref}
              icon={<Plane className="h-5 w-5" aria-hidden="true" />}
              label={primaryLabel}
              meta={primaryMeta}
              primary
            />
            <div className="grid grid-cols-2 gap-3">
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
