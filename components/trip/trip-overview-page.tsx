"use client";

import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  MapPin,
  MoreHorizontal,
  Plane,
  Plus,
  Route,
  Search,
  Share2,
  Sparkles,
  Utensils,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import type { TripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";
import { MobileFlightRouteCard } from "@/components/trip/mobile-flight-route-card";

type TripOverviewPageProps = TripOverviewData;

export default function TripOverviewPage({
  actualLabel,
  dateRange,
  destination,
  documentsPreview,
  error,
  expenseCategories,
  flightPreview,
  hasExpenses,
  heroImage,
  itineraryPreview,
  mappedCount,
  nextUp,
  routePreview,
  segmentCount,
  status,
  statusLabel,
  suggestionsCount,
  title,
  tripId
}: TripOverviewPageProps) {
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;
  const actionItems = [
    {
      href: `${base}/timeline#new-plan`,
      icon: <Plus className="h-5 w-5" aria-hidden="true" />,
      label: "New Activity",
      primary: true,
      show: true,
      testId: "mobile-primary-trip-cta"
    },
    {
      href: `${base}/timeline`,
      icon: <Plane className="h-5 w-5" aria-hidden="true" />,
      label: "Flights",
      primary: false,
      show: true
    },
    {
      href: `${base}/timeline`,
      icon: <BedDouble className="h-5 w-5" aria-hidden="true" />,
      label: "Lodgings",
      primary: false,
      show: true
    },
    {
      href: `${base}/timeline`,
      icon: <Utensils className="h-5 w-5" aria-hidden="true" />,
      label: "Restaurant",
      primary: false,
      show: true
    },
    {
      href: `${base}/timeline`,
      icon: <MapPin className="h-5 w-5" aria-hidden="true" />,
      label: "Places",
      primary: false,
      show: true
    }
  ].filter((item) => item.show);

  return (
    <div className="grid gap-0 text-white lg:gap-4" data-testid="trip-overview-page">
      <MobileOverviewSmallPass
        actionItems={actionItems}
        base={base}
        dateRange={dateRange}
        destination={destination}
        documentsPreview={documentsPreview}
        expenseCategories={expenseCategories}
        flightPreview={flightPreview}
        hasExpenses={hasExpenses}
        heroImage={heroImage}
        itineraryPreview={itineraryPreview}
        mappedCount={mappedCount}
        nextUp={nextUp}
        routePreview={routePreview}
        segmentCount={segmentCount}
        spendingLabel={actualLabel}
        statusLabel={statusLabel}
        title={title}
        tripId={tripId}
      />

      <div className="hidden gap-4 px-3 pt-4 lg:grid lg:px-0 lg:pt-0" id="overview-full">
        {error ? (
          <p className="rounded-[1.5rem] border border-amber-200/20 bg-amber-300/12 px-4 py-3 text-sm font-bold text-amber-50">
            Some trip details are unavailable, but you can still add an item or open the itinerary.
          </p>
        ) : null}

        <section
          aria-label="Quick trip actions"
          className="hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur-2xl lg:block"
        >
          <div className="grid grid-cols-4 gap-2">
            {actionItems.map((item) => (
              <Link
                className={[
                  "grid min-h-[5.8rem] place-items-center gap-2 rounded-[1.35rem] px-2 py-3 text-center text-xs font-bold transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
                  item.primary
                    ? "bg-orange-500 text-white shadow-[0_14px_30px_rgba(249,115,22,0.24)]"
                    : "bg-black/28 text-white/78 hover:bg-white/12 hover:text-white"
                ].join(" ")}
                data-testid={item.testId}
                href={item.href}
                key={item.label}
              >
                <span
                  className={[
                    "grid h-12 w-12 place-items-center rounded-full",
                    item.primary ? "bg-white/18" : "bg-white/10"
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

      {routePreview ? (
        <OverviewCard
          actionHref={`${base}/timeline#${routePreview.id}`}
          actionLabel="Open"
          eyebrow={routePreview.typeLabel}
          icon={<Route className="h-5 w-5" aria-hidden="true" />}
          title={routePreview.routeLabel}
        >
          <div className="rounded-[1.5rem] bg-black/36 p-4">
            {routePreview.originLabel && routePreview.destinationLabel ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <RouteEndpoint align="left" label={routePreview.originLabel} />
                <span className="h-1 w-14 rounded-full bg-sky-400/70" aria-hidden="true" />
                <RouteEndpoint align="right" label={routePreview.destinationLabel} />
              </div>
            ) : (
              <p className="text-base font-black text-white">{routePreview.title}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-white/62">
              <span>{routePreview.timeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{routePreview.metaLabel}</span>
            </div>
          </div>
        </OverviewCard>
      ) : null}

      <OverviewCard
        actionHref={`${base}/timeline`}
        actionLabel="View all"
        eyebrow="Itinerary"
        icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
        title={nextUp ? "Today" : `${segmentCount} place${segmentCount === 1 ? "" : "s"}`}
      >
        {itineraryPreview.length ? (
          <div className="overflow-hidden rounded-lg bg-white/[0.06]">
            {itineraryPreview.slice(0, 5).map((item) => (
              <Link
                className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 text-white/88 transition last:border-b-0 hover:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-orange-300/20"
                href={`${base}/timeline#${item.id}`}
                key={item.id}
              >
                <span className={previewIconBubbleClass(item.typeLabel)}>
                  {iconForPreview(item.typeLabel)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
                  <span className="block truncate text-xs font-semibold text-white/52">
                    {item.location}
                  </span>
                </span>
                <span className="text-right text-xs font-black text-white/56">{item.timeLabel}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyInline
            body="Add a place, activity, reservation, or note to start the itinerary."
            cta="Add trip item"
            href={`${base}/timeline#new-plan`}
          />
        )}
      </OverviewCard>

      {itineraryPreview.length ? (
        <OverviewCard
          actionHref={`${base}/timeline`}
          actionLabel="Open"
          eyebrow="Latest Added"
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          title="Recent items"
        >
          <div className="overflow-hidden rounded-lg bg-white/[0.06]">
            {itineraryPreview.slice(0, 5).map((item) => (
              <Link
                className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0 hover:bg-white/[0.08]"
                href={`${base}/timeline#${item.id}`}
                key={`latest-${item.id}`}
              >
                <span className={previewIconBubbleClass(item.typeLabel)}>
                  {iconForPreview(item.typeLabel)}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-white/88">{item.title}</span>
              </Link>
            ))}
          </div>
        </OverviewCard>
      ) : null}

      <OverviewCard
        actionHref={`${base}/map`}
        actionLabel="Open map"
        eyebrow="Map"
        icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
        title={mappedCount > 0 ? "Route ready" : "Build your route"}
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Mapped" value={`${mappedCount}`} />
            <MetricPill label="Places" value={`${segmentCount}`} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950 focus:outline-none focus:ring-4 focus:ring-white/25"
              href={`${base}/map`}
            >
              Open map
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white/10 px-4 text-sm font-black text-white/76 transition hover:bg-white/16 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              href={`${base}/ideas`}
            >
              Open Activities
            </Link>
          </div>
        </div>
      </OverviewCard>

      {hasExpenses ? (
        <OverviewCard
          actionHref={`${base}/budget`}
          actionLabel="Open"
          eyebrow="Expenses"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
          title={actualLabel}
        >
          <div className="overflow-hidden rounded-lg bg-white/[0.06]">
            {expenseCategories.slice(0, 3).map((category) => (
              <div
                className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 text-sm last:border-b-0"
                key={category.id}
              >
                <span className={previewIconBubbleClass(category.label)}>
                  {iconForPreview(category.label)}
                </span>
                <span className="font-semibold text-white/78">{category.label}</span>
                <strong className="text-right text-white">{category.amountLabel}</strong>
              </div>
            ))}
          </div>
        </OverviewCard>
      ) : null}

      <OverviewCard
        actionHref={`${base}/share`}
        actionLabel="Invite"
        eyebrow="Share"
        icon={<Share2 className="h-5 w-5" aria-hidden="true" />}
        title="Trip guests"
      >
        <p className="text-sm font-semibold leading-6 text-white/62">
          Invite someone when you are ready to share the itinerary or plan together.
        </p>
      </OverviewCard>

      <details
        className="group rounded-[2rem] border border-white/10 bg-[#1c1c1f]/72 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
        data-testid="overview-more-tools"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.35rem] px-1 text-left font-black text-white">
          <span>More trip tools</span>
          <ChevronRight className="h-5 w-5 text-white/48 transition group-open:rotate-90" aria-hidden="true" />
        </summary>
        <div className="mt-3 grid gap-2">
          {!hasExpenses ? (
            <ToolRow
              href={`${base}/budget`}
              icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
              meta="Track costs when you need them."
              title="Expenses"
            />
          ) : null}
          <ToolRow
            href={`${base}/documents`}
            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            meta="Keep confirmations, screenshots, notes, and links together. Email import coming soon."
            title="Documents"
          />
          <ToolRow
            href={`${base}/ideas`}
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            meta={suggestionsCount > 0 ? `${suggestionsCount} nearby idea${suggestionsCount === 1 ? "" : "s"} ready.` : "Find activities near your mapped places."}
            title="Activities"
          />
        </div>
      </details>

      {itineraryPreview.length === 0 && !routePreview ? (
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950 shadow-sm focus:outline-none focus:ring-4 focus:ring-white/25"
          href="/dashboard/plan"
        >
          Start with an idea
        </Link>
      ) : null}

        <p className="sr-only">Trip status: {status}</p>
      </div>
    </div>
  );
}

function MobileOverviewSmallPass({
  actionItems,
  base,
  dateRange,
  destination,
  documentsPreview,
  expenseCategories,
  flightPreview,
  hasExpenses,
  heroImage,
  itineraryPreview,
  mappedCount,
  nextUp,
  routePreview,
  segmentCount,
  spendingLabel,
  statusLabel,
  title,
  tripId
}: {
  actionItems: Array<{
    href: string;
    icon: ReactNode;
    label: string;
    primary: boolean;
    show: boolean;
    testId?: string;
  }>;
  base: string;
  dateRange: string;
  destination: string;
  documentsPreview: TripOverviewData["documentsPreview"];
  expenseCategories: TripOverviewData["expenseCategories"];
  flightPreview: TripOverviewData["flightPreview"];
  hasExpenses: boolean;
  heroImage: TripOverviewData["heroImage"];
  itineraryPreview: TripOverviewData["itineraryPreview"];
  mappedCount: number;
  nextUp: TripOverviewData["nextUp"];
  routePreview: TripOverviewData["routePreview"];
  segmentCount: number;
  spendingLabel: string;
  statusLabel: string | null;
  title: string;
  tripId: string;
}) {
  const routePreviewForNext = routePreview?.id === flightPreview?.id ? null : routePreview;
  const nextUpForNext = nextUp?.id === flightPreview?.id ? null : nextUp;
  const nextItem = routePreviewForNext
    ? {
        href: `${base}/timeline#${routePreviewForNext.id}`,
        label: routePreviewForNext.routeLabel,
        meta: [routePreviewForNext.timeLabel, routePreviewForNext.metaLabel].filter(Boolean).join(" · "),
        routeDestination: routePreviewForNext.destinationLabel,
        routeOrigin: routePreviewForNext.originLabel
      }
    : nextUpForNext
      ? {
          href: `${base}/timeline#${nextUpForNext.id}`,
          label: nextUpForNext.title,
          meta: [nextUpForNext.timeLabel, nextUpForNext.location, nextUpForNext.typeLabel].filter(Boolean).join(" · "),
          routeDestination: null,
          routeOrigin: null
        }
      : null;
  const heroCredit = heroImage.imageAttribution || heroImage.imageSourceLabel;
  const hasHeroPhoto = Boolean(heroImage.imageUrl);

  return (
    <section
      aria-label="Compressed trip overview"
      className="relative min-h-[100svh] overflow-hidden bg-[#05060a] pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-[0_26px_80px_rgba(0,0,0,0.34)] lg:hidden"
      data-testid="overview-small-pass"
    >
      <div
        className={`relative min-h-[26rem] overflow-hidden ${hasHeroPhoto ? "bg-black" : heroImage.fallbackGradient}`}
        data-testid="overview-mobile-hero"
      >
        {hasHeroPhoto ? (
          // Provider photo URLs are internal API routes with query strings, which Next Image blocks without localPatterns.
          <img
            alt={heroImage.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
            src={heroImage.imageUrl!}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,10,0.1),rgba(5,6,10,0.2)_32%,rgba(5,6,10,0.76)_68%,#05060a)]" />
        <div className="relative z-10 flex min-h-[26rem] flex-col px-4 pb-6 pt-3">
          <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-white/32" aria-hidden="true" />
          <div className="grid grid-cols-[44px_1fr_44px_44px] items-center gap-2">
            <OverviewMoreMenu base={base} />
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold text-white/68">{dateRange}</p>
            </div>
            <Link
              aria-label="Search trip activities"
              className="grid h-11 w-11 place-items-center rounded-full bg-black/36 text-white/86"
              href={`${base}/ideas`}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              aria-label="Back to trips"
              className="grid h-11 w-11 place-items-center rounded-full bg-black/36 text-white/86"
              href="/dashboard/trips"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-auto text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-xl shadow-xl ring-2 ring-black/20">
              {flagForDestination(destination)}
            </div>
            <h1 className="mx-auto max-w-[20rem] text-balance text-4xl font-black leading-[0.95] text-white drop-shadow-lg">
              {title}
            </h1>
            {statusLabel ? (
              <p className="mt-2 text-base font-bold text-white/82">{statusLabel}</p>
            ) : null}
            <p className="mt-1 text-sm font-semibold text-white/66">{destination}</p>
            {heroCredit ? (
              <p className="sr-only">Photo: {heroCredit}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="relative -mt-4 grid gap-5 rounded-t-[2rem] bg-[#201f20]/96 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5 text-white shadow-[0_-24px_70px_rgba(0,0,0,0.42)] ring-1 ring-white/10 backdrop-blur-2xl"
        data-testid="overview-small-sheet"
      >
        <div
          aria-label="Quick trip actions"
          className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="overview-quick-actions"
        >
          {actionItems.map((item) => (
            <Link
              className="grid w-[4.8rem] shrink-0 snap-start place-items-center gap-2 text-center text-[0.7rem] font-semibold text-white/68 transition focus:outline-none focus:ring-4 focus:ring-orange-300/20"
              data-testid={item.primary ? "overview-small-primary-cta" : undefined}
              href={item.href}
              key={item.label}
            >
              <span
                className={[
                  "grid h-16 w-16 place-items-center rounded-full",
                  item.primary ? "bg-black/48 text-white" : "bg-black/34 text-white/90"
                ].join(" ")}
              >
                {item.icon}
              </span>
              <span className="leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>

        <MobileFlightRouteCard flight={flightPreview} tripId={tripId} />

        {nextItem ? (
          <Link
            className="block rounded-[1.35rem] bg-[#19191b] p-4 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24)] focus:outline-none focus:ring-4 focus:ring-orange-300/20"
            data-testid="overview-next-up-card"
            href={nextItem.href}
          >
            {nextItem.routeOrigin && nextItem.routeDestination ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <RouteEndpoint align="left" label={nextItem.routeOrigin} />
                <span className="grid place-items-center text-sky-400">
                  <Plane className="h-6 w-6" aria-hidden="true" />
                </span>
                <RouteEndpoint align="right" label={nextItem.routeDestination} />
              </div>
            ) : (
              <>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/38">Next</p>
                <p className="mt-1 truncate text-lg font-black text-white">{nextItem.label}</p>
              </>
            )}
            <p className="mt-3 truncate text-sm font-semibold text-white/54">{nextItem.meta}</p>
          </Link>
        ) : (
          <Link
            className="block rounded-[1.35rem] bg-[#19191b] p-4 text-sm font-semibold text-white/68"
            data-testid="overview-starter-row"
            href={`${base}/timeline#new-plan`}
          >
            Start organizing your itinerary
          </Link>
        )}

        <MobileOverviewSection
          actionHref={`${base}/timeline`}
          actionLabel={itineraryPreview.length ? "View all" : "Add"}
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          testId="overview-itinerary-preview"
          title="Itinerary"
          value={itineraryPreview.length ? dateRange : "Today"}
        >
          {itineraryPreview.length ? (
            <div className="overflow-hidden rounded-xl bg-white/[0.04]">
              {itineraryPreview.slice(0, 4).map((item) => (
                <Link
                  className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0"
                  href={`${base}/timeline#${item.id}`}
                  key={item.id}
                >
                  <span className={previewIconBubbleClass(item.typeLabel)}>
                    {iconForPreview(item.typeLabel)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{item.title}</span>
                    <span className="block truncate text-xs font-semibold text-white/48">{item.location}</span>
                  </span>
                  <span className="text-xs font-black text-white/58">{item.timeLabel}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Link
              className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/62"
              href={`${base}/timeline#new-plan`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/18 text-orange-300">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </span>
              Start organizing your itinerary
            </Link>
          )}
        </MobileOverviewSection>

        <MobileOverviewSection
          actionHref={`${base}/documents`}
          actionLabel={documentsPreview.length ? "Open" : "Add"}
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          testId="overview-documents-preview"
          title="Documents"
        >
          {documentsPreview.length ? (
            <div className="overflow-hidden rounded-xl bg-white/[0.04]">
              {documentsPreview.map((document) => (
                <Link
                  className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0"
                  href={document.href}
                  key={document.id}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/18 text-indigo-200">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{document.title}</span>
                    <span className="block truncate text-xs font-semibold text-white/48">
                      {document.metaLabel}
                    </span>
                  </span>
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/34">
                    {document.typeLabel}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Link
              className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/62"
              href={`${base}/documents`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500/18 text-indigo-200">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-black text-white">Add documents</span>
                <span className="block text-xs font-semibold text-white/48">
                  Reservations, links, screenshots, and notes.
                </span>
              </span>
            </Link>
          )}
        </MobileOverviewSection>

        <MobileOverviewSection
          actionHref={`${base}/budget`}
          actionLabel={hasExpenses ? "Open" : "Track"}
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
          testId="overview-spending-summary"
          title="Total in USD"
          value={hasExpenses ? spendingLabel : undefined}
        >
          {hasExpenses ? (
            <div className="overflow-hidden rounded-xl bg-white/[0.04]">
              {expenseCategories.slice(0, 3).map((category) => (
                <Link
                  className="grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0"
                  href={`${base}/budget`}
                  key={category.id}
                >
                  <span className={previewIconBubbleClass(category.label)}>
                    {iconForPreview(category.label)}
                  </span>
                  <span className="truncate text-sm font-semibold text-white/78">{category.label}</span>
                  <span className="text-sm font-black text-white">{category.amountLabel}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Link
              className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/62"
              href={`${base}/budget`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/18 text-orange-300">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-black text-white">No expenses yet</span>
                <span className="block text-xs font-semibold text-white/48">Add an expense to track trip spending.</span>
              </span>
            </Link>
          )}
        </MobileOverviewSection>

        <Link
          className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1.35rem] bg-black/24 px-4 py-3 text-white focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={`${base}/map`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500/16 text-orange-300">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">Open map</span>
            <span className="block text-xs font-semibold text-white/48">
              {mappedCount} mapped · {segmentCount} {segmentCount === 1 ? "place" : "places"}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-white/42" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function MobileOverviewSection({
  actionHref,
  actionLabel,
  children,
  icon,
  testId,
  title,
  value
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  icon: ReactNode;
  testId: string;
  title: string;
  value?: string;
}) {
  return (
    <article
      className="rounded-[1.35rem] bg-[#19191b] p-4 text-white shadow-[0_14px_34px_rgba(0,0,0,0.18)]"
      data-testid={testId}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/16 text-orange-300">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{title}</p>
          {value ? <p className="mt-0.5 truncate text-sm font-semibold text-white/52">{value}</p> : null}
        </div>
        <Link className="text-sm font-black text-orange-400" href={actionHref}>
          {actionLabel}
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function OverviewMoreMenu({ base }: { base: string }) {
  return (
    <details className="relative z-50" suppressHydrationWarning>
      <summary
        aria-label="More trip options"
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-black/28 text-white/82 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 z-[80] mt-2 w-44 overflow-hidden rounded-2xl bg-[#111113]/98 p-1 text-sm font-black text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/budget`}>
          Expenses
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/documents`}>
          Documents
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={`${base}/share`}>
          Share
        </Link>
        <Link className="block rounded-xl px-3 py-3 hover:bg-white/10" href={base}>
          Settings
        </Link>
      </div>
    </details>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] bg-black/26 px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function OverviewCard({
  actionHref,
  actionLabel,
  children,
  eyebrow,
  icon,
  title
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  eyebrow: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-[1.55rem] bg-[#1c1c1f]/92 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.24)] ring-1 ring-white/8 backdrop-blur-2xl lg:rounded-[2rem] lg:border lg:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-500/16 text-orange-300 lg:h-11 lg:w-11">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/42">{eyebrow}</p>
            <h3 className="mt-1 break-words text-lg font-black leading-tight text-white lg:text-xl">{title}</h3>
          </div>
        </div>
        <Link
          className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-white/10 px-3 text-xs font-black text-white/76 transition hover:bg-white/16 hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function ToolRow({
  href,
  icon,
  meta,
  title
}: {
  href: string;
  icon: ReactNode;
  meta: string;
  title: string;
}) {
  return (
    <Link
      className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1.35rem] bg-black/24 px-3 py-3 text-white/78 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-orange-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-white/52">{meta}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-white/42" aria-hidden="true" />
    </Link>
  );
}

function RouteEndpoint({ align, label }: { align: "left" | "right"; label: string }) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <p className="truncate text-3xl font-black uppercase leading-none text-white">
        {shortRouteLabel(label)}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-white/54">{label}</p>
    </div>
  );
}

function iconForPreview(typeLabel: string) {
  const normalized = typeLabel.toLowerCase();
  if (/flight|airport/.test(normalized)) return <Plane className="h-4 w-4" aria-hidden="true" />;
  if (/hotel|lodging|stay/.test(normalized)) return <BedDouble className="h-4 w-4" aria-hidden="true" />;
  if (/restaurant|food|dinner|lunch|cafe/.test(normalized)) return <Utensils className="h-4 w-4" aria-hidden="true" />;
  return <MapPin className="h-4 w-4" aria-hidden="true" />;
}

function previewIconBubbleClass(typeLabel: string) {
  const normalized = typeLabel.toLowerCase();
  const base = "grid h-8 w-8 shrink-0 place-items-center rounded-full";
  if (/flight|airport/.test(normalized)) return `${base} bg-sky-500/18 text-sky-300`;
  if (/hotel|lodging|stay/.test(normalized)) return `${base} bg-purple-500/18 text-purple-300`;
  if (/restaurant|food|dinner|lunch|cafe/.test(normalized)) return `${base} bg-orange-500/18 text-orange-300`;
  if (/bar|party/.test(normalized)) return `${base} bg-amber-500/18 text-amber-300`;
  return `${base} bg-emerald-500/18 text-emerald-300`;
}

function EmptyInline({
  body,
  cta,
  href
}: {
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-white/16 px-4 py-5 text-sm text-white/68">
      <p className="font-semibold">{body}</p>
      <Link
        className="mt-3 inline-flex min-h-10 items-center rounded-full bg-orange-500 px-4 text-xs font-black text-white"
        href={href}
      >
        {cta}
      </Link>
    </div>
  );
}

function shortRouteLabel(label: string) {
  const codeMatch = label.match(/\b[A-Z]{3}\b/);
  if (codeMatch) return codeMatch[0];

  return label
    .split(/[,\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase() || "-";
}

function flagForDestination(destination: string) {
  const normalized = destination.toLowerCase();
  if (normalized.includes("japan") || normalized.includes("tokyo")) return "🇯🇵";
  if (normalized.includes("spain") || normalized.includes("barcelona")) return "🇪🇸";
  if (normalized.includes("brazil") || normalized.includes("sao ") || normalized.includes("rio ")) return "🇧🇷";
  if (normalized.includes("canada") || normalized.includes("vancouver")) return "🇨🇦";
  if (normalized.includes("france") || normalized.includes("paris")) return "🇫🇷";
  if (normalized.includes("italy") || normalized.includes("rome")) return "🇮🇹";
  if (normalized.includes("united kingdom") || normalized.includes("london")) return "🇬🇧";
  return "🇺🇸";
}
