"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Map,
  Plane,
  Plus,
  Search,
  Settings,
  Sparkles,
  User
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/components/trip-ui";

type SheetState = "collapsed" | "expanded";

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
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const dragStartY = useRef<number | null>(null);
  const isExpanded = sheetState === "expanded";

  function toggleSheet() {
    setSheetState((current) => (current === "collapsed" ? "expanded" : "collapsed"));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartY.current = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = dragStartY.current;
    dragStartY.current = null;

    if (startY === null) {
      return;
    }

    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) < 18) {
      toggleSheet();
      return;
    }

    setSheetState(deltaY < 0 ? "expanded" : "collapsed");
  }

  return (
    <section
      className="wayline-home-content-reveal pointer-events-auto relative z-10"
      data-sheet-state={sheetState}
      data-testid="mobile-home-wallet-content"
    >
      <div
        className={cn(
          "mx-auto max-w-[28rem] overflow-hidden rounded-t-[2rem] bg-white text-slate-950 shadow-[0_-24px_70px_rgba(0,0,0,0.34)] transition-[max-height] duration-300 ease-out min-[390px]:rounded-t-[2.25rem]",
          isExpanded ? "max-h-[min(78dvh,43rem)]" : "max-h-[15.5rem]"
        )}
        data-testid="ios-launch-sheet"
      >
        <div className="px-4 pb-4 pt-2 min-[390px]:px-5 min-[390px]:pb-5">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="mobile-launch-expanded-menu"
            aria-label={isExpanded ? "Collapse launch menu" : "Expand launch menu"}
            className="mx-auto mb-3 grid h-8 w-24 place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20"
            data-testid="ios-launch-sheet-handle"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <span className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
          </button>

          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls="mobile-launch-expanded-menu"
              className="min-w-0 flex-1 text-left focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              onClick={toggleSheet}
            >
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-orange-500">
                Wayline
              </p>
              <span className="mt-1 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[clamp(2rem,8.6vw,2.75rem)] font-black leading-none tracking-normal text-slate-950">
                  Travel Wallet
                </h1>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-180")}
                />
              </span>
            </button>
            {isExpanded ? (
              <button
                type="button"
                aria-label="Collapse launch menu"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-950 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                onClick={() => setSheetState("collapsed")}
              >
                <ChevronDown className="h-6 w-6" aria-hidden="true" />
              </button>
            ) : (
              <Link
                aria-label="Add trip"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.1rem] bg-orange-500 text-white shadow-[0_18px_38px_rgba(249,115,22,0.24)] transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                href="/dashboard/trips#new-trip"
              >
                <Plus className="h-8 w-8" aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="mt-4" data-testid="mobile-home-actions">
            <CompactPrimaryRow href={primaryHref} label={primaryLabel} meta={primaryMeta} />
            <div className="mt-3 grid grid-cols-3 gap-2" data-testid="mobile-home-compact-actions">
              <CompactAction href="/dashboard/search" icon={<Search />} label="Search" />
              <CompactAction href="/dashboard/profile/stats" icon={<BookOpen />} label="Travel Book" />
              <CompactAction href="/dashboard/trips#new-trip" icon={<Plus />} label="Add" primary />
            </div>
          </div>

          <div
            id="mobile-launch-expanded-menu"
            className={cn(
              "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
            data-testid="ios-launch-sheet-expanded"
          >
            <div className="min-h-0">
              {isExpanded ? (
                <div className="mt-5 max-h-[calc(78dvh-14.75rem)] overflow-y-auto pb-24">
                  <ActionGroup label="Main">
                    <SheetRow href={primaryHref} icon={<Plane />} label={primaryLabel} meta={primaryMeta} />
                    <SheetRow
                      href="/dashboard/plan"
                      icon={<Plus />}
                      label="Add idea"
                      meta="Save a note, link, or place."
                    />
                    {ideasWaitingCount > 0 ? (
                      <SheetRow
                        href="/dashboard/plan#ai-review"
                        icon={<Sparkles />}
                        label="Review places"
                        meta={`${ideasWaitingCount} item${ideasWaitingCount === 1 ? "" : "s"} waiting`}
                      />
                    ) : null}
                    <SheetRow href="/dashboard/map" icon={<Map />} label="Open map" meta="View trips on the map." />
                  </ActionGroup>

                  <ActionGroup label="Resources">
                    <SheetRow href="/dashboard/trips" icon={<BookOpen />} label="My Trips" meta="Browse your trips." />
                    <SheetRow
                      href="/dashboard/profile/stats"
                      icon={<BookOpen />}
                      label="Travel Book"
                      meta="Countries, trips, and stats."
                    />
                    <SheetRow href="/dashboard/search" icon={<Search />} label="Search" meta="Find trips and places." />
                  </ActionGroup>

                  <ActionGroup label="Account">
                    <SheetRow href="/dashboard/profile" icon={<User />} label="Profile" meta="Your Wayline account." />
                    <SheetRow href="/dashboard/account" icon={<Settings />} label="Settings" meta="Preferences and sync." />
                  </ActionGroup>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactPrimaryRow({ href, label, meta }: { href: string; label: string; meta: string }) {
  return (
    <Link
      className="grid min-h-[3.7rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] bg-slate-100 px-3.5 py-2 text-left text-slate-950 ring-1 ring-slate-200 transition hover:bg-slate-200/70 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-orange-500 shadow-sm">
        <Plane className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[1rem] font-black">{label}</span>
        <span className="mt-0.5 block truncate text-[0.78rem] font-bold text-slate-500">{meta}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
    </Link>
  );
}

function CompactAction({
  href,
  icon,
  label,
  primary = false
}: {
  href: string;
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={cn(
        "grid min-h-[3.5rem] place-items-center rounded-[1.15rem] px-2 text-center text-[0.78rem] font-black transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
        primary
          ? "bg-orange-500 text-white shadow-[0_18px_38px_rgba(249,115,22,0.24)] hover:bg-orange-600"
          : "bg-white text-slate-950 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 hover:bg-slate-50"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full",
          primary ? "bg-white/16 text-white" : "bg-orange-50 text-orange-500"
        )}
      >
        <span className="[&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="mt-1 max-w-full truncate">{label}</span>
    </Link>
  );
}

function ActionGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="mt-5 first:mt-0" aria-label={label}>
      <h2 className="mb-2 px-1 text-[0.75rem] font-bold uppercase tracking-normal text-slate-400">{label}</h2>
      <div className="overflow-hidden rounded-[1.35rem] bg-white ring-1 ring-slate-200/90">
        {children}
      </div>
    </section>
  );
}

function SheetRow({
  href,
  icon,
  label,
  meta
}: {
  href: string;
  icon: ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <Link
      className="group grid min-h-[4rem] scroll-mb-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200/80 px-4 py-2.5 text-left text-slate-950 transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500 shadow-sm">
        <span className="[&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[1rem] font-semibold">{label}</span>
        {meta ? <span className="mt-0.5 block truncate text-[0.78rem] font-medium text-slate-500">{meta}</span> : null}
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-500" aria-hidden="true" />
    </Link>
  );
}
