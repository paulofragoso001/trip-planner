import {
  Map,
  Plane,
  Plus,
  Search,
  Sparkles
} from "lucide-react";
import { MobileHomeAction, MobileHomeTile } from "@/components/dashboard/mobile-home-actions";

export function MobileHomeSheet({
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
    <div
      className="rounded-t-[2.25rem] border border-white/12 bg-[#050914]/88 p-4 shadow-[0_-28px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      data-testid="mobile-home-sheet"
    >
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/34" />
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
  );
}
