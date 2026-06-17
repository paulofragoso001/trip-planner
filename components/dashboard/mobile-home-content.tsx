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
      className="wayline-home-content-reveal relative z-10"
      data-testid="mobile-home-wallet-content"
    >
      <div className="mx-auto max-w-[25rem]">
        <div className="relative mb-2 text-left">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.3em] text-orange-300/86">
            Wayline
          </p>
          <h1 className="mt-1 text-[clamp(2rem,9.5vw,2.5rem)] font-black leading-none tracking-normal text-white">
            Travel wallet
          </h1>
          <p className="mt-1.5 max-w-[20rem] text-[0.82rem] font-semibold leading-4 text-slate-300 min-[390px]:text-sm min-[390px]:leading-5">
            Pick up a trip, start planning, or review saved ideas.
          </p>
        </div>

        <div
          className="rounded-[1.35rem] bg-[#050914]/76 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl min-[390px]:rounded-[1.55rem] min-[390px]:p-2.5"
          data-testid="mobile-home-actions"
        >
          <div className="grid gap-1.5 min-[390px]:gap-2">
            <MobileHomeAction
              href={primaryHref}
              icon={<Plane className="h-5 w-5" aria-hidden="true" />}
              label={primaryLabel}
              meta={primaryMeta}
              primary
            />
            <div className="grid grid-cols-2 gap-1.5 min-[390px]:gap-2">
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
