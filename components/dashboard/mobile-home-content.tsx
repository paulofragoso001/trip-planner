import {
  BookOpen,
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
      className="wayline-home-content-reveal pointer-events-auto relative z-10"
      data-testid="mobile-home-wallet-content"
    >
      <div className="mx-auto max-w-[28rem] rounded-t-[2.1rem] bg-white px-4 pb-4 pt-2 text-slate-950 shadow-[0_-24px_70px_rgba(0,0,0,0.34)] min-[390px]:rounded-t-[2.35rem] min-[390px]:px-5 min-[390px]:pb-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-orange-500">
              Wayline
            </p>
            <h1 className="mt-1 text-[clamp(2.35rem,10.5vw,3.25rem)] font-black leading-none tracking-normal text-slate-950">
              Travel Wallet
            </h1>
          </div>
          <MobileHomeTile
            href="/dashboard/trips#new-trip"
            icon={<Plus className="h-7 w-7" aria-hidden="true" />}
            label="Add"
            compact
            primary
          />
        </div>
        <div
          className="mt-5 grid grid-cols-[4.25rem_minmax(0,1fr)_4.25rem] gap-2 min-[390px]:grid-cols-[4.6rem_minmax(0,1fr)_4.6rem] min-[390px]:gap-2.5"
          data-testid="mobile-home-actions"
        >
          <MobileHomeTile
            href="/dashboard/search"
            icon={<Search className="h-7 w-7" aria-hidden="true" />}
            label="Search"
          />
          <MobileHomeAction
            href="/dashboard/profile/stats"
            icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
            label="Travel Book"
            meta="Countries, trips, and saved places."
            primary
          />
          <MobileHomeTile
            href="/dashboard/trips#new-trip"
            icon={<Plus className="h-7 w-7" aria-hidden="true" />}
            label="Add"
            primary
          />
        </div>

        <div className="mt-3 grid gap-2 min-[390px]:mt-4">
          <MobileHomeAction
            href={primaryHref}
            icon={<Plane className="h-5 w-5" aria-hidden="true" />}
            label={primaryLabel}
            meta={primaryMeta}
          />
          <div className="grid grid-cols-2 gap-2">
            <MobileHomeAction
              href="/dashboard/plan"
              icon={<Plus className="h-5 w-5" aria-hidden="true" />}
              label="Add idea"
              meta="Save a note, link, or place."
            />
            {ideasWaitingCount > 0 ? (
              <MobileHomeAction
                href="/dashboard/plan#ai-review"
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                label="Review places"
                meta={`${ideasWaitingCount} item${ideasWaitingCount === 1 ? "" : "s"} waiting`}
              />
            ) : (
              <MobileHomeAction
                href="/dashboard/plan#ai-review"
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                label="Review places"
                meta="Check saved ideas."
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileHomeAction
              href="/dashboard/map"
              icon={<Map className="h-5 w-5" aria-hidden="true" />}
              label="Open map"
              meta="View your trips on the map."
            />
            <MobileHomeAction
              href="/dashboard/trips"
              icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
              label="My Trips"
              meta="Browse your trip wallet."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
