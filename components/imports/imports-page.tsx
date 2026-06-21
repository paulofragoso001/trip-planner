import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import type { ImportsData } from "@/app/dashboard/imports/loader";
import { AiTravelPlannerForm } from "@/components/imports/ai-travel-planner-form";
import { ExtractedPlaceCard } from "@/components/imports/extracted-place-card";
import { SocialImportForm } from "@/components/imports/social-import-form";
import { TripDraftQueue } from "@/components/imports/trip-draft-queue";
import { UnfiledItemForm } from "@/components/imports/unfiled-item-form";
import { cn } from "@/components/trip-ui";
import { EmptyState, StatusBadge, tripUi } from "@/components/trip-ui";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import type { WaylineSampleKey } from "@/lib/wayline-onboarding";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type ImportsPageProps = ImportsData & {
  sampleInspiration?: {
    key: WaylineSampleKey;
    text: string;
  } | null;
};

export default function ImportsPage({
  aiReviewItems,
  error,
  heroImage,
  importedContent,
  reviewQueuePrefix,
  sampleInspiration,
  sources,
  tripDrafts,
  trips,
  unfiledItems
}: ImportsPageProps) {
  const defaultReviewTitle = reviewQueuePrefix
    ? `${reviewQueuePrefix} United confirmation email`
    : "";

  return (
    <WalletPageShell
      actions={<WalletActionLink href="#saved-inspiration">Add idea</WalletActionLink>}
      compactHero
      eyebrow="PLAN"
      fallbackGradient={heroImage.fallbackGradient}
      heroClassName="min-h-[11.5rem] rounded-[2rem] sm:min-h-[15rem]"
      heroImage={heroImage}
      subtitle="Paste a link, note, or screenshot. Wayline finds places for you to review."
      subtitleClassName="mt-2 text-[0.9rem] leading-5 text-white/82 sm:mt-4 sm:text-base"
      title="Capture travel ideas"
      titleClassName="text-[2.35rem] sm:text-6xl"
    >
      <div
        className="grid gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:gap-5 lg:pb-0"
        data-testid="imports-route"
      >
        <section className="grid gap-5">
          <WorkflowStepRow />

          <div id="social-imports" />
          <section
            className="rounded-[1.65rem] border border-white/10 bg-[#050505] p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/10 lg:rounded-[2rem] lg:border-slate-200 lg:bg-white lg:p-5 lg:text-slate-950 lg:shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:ring-0"
            id="saved-inspiration"
          >
            <div className="mb-4 grid gap-1 lg:mb-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300 lg:text-blue-600">
                Ideas
              </p>
              <h2 className="hidden text-xl font-black tracking-tight text-slate-950 lg:block">
                Add an idea
              </h2>
              <p className="text-lg font-black tracking-tight text-white lg:hidden">
                Capture travel inspiration
              </p>
            </div>
            <SocialImportForm
              defaultRawText={sampleInspiration?.text}
              sampleKey={sampleInspiration?.key}
              trips={trips}
            />
          </section>

          <div id="ai-review" />
          {aiReviewItems.length ? (
            <WalletCard
              action={<StatusBadge tone="blue">{aiReviewItems.length} to review</StatusBadge>}
              className="border-white/10 !bg-[#050505] !text-white ring-1 ring-white/10 lg:border-slate-200 lg:!bg-white lg:!text-slate-950 lg:ring-0"
              eyebrow="Ready for review"
              title="Review places"
              variant="primary"
            >
              <p className="text-sm font-semibold leading-6 text-white/68 lg:text-slate-600">
                Review places Wayline found before adding them to a trip.
              </p>
              <a
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950 lg:bg-slate-950 lg:text-white"
                href="#ai-review"
              >
                Review places
              </a>
              <div className="mt-4 grid gap-4">
                {aiReviewItems.map((place) => (
                  <ExtractedPlaceCard
                    key={place.id}
                    mergeTargets={aiReviewItems.filter((target) => target.id !== place.id)}
                    place={place}
                    trips={trips}
                  />
                ))}
              </div>
            </WalletCard>
          ) : null}

          <MobileTripContext hasTrips={trips.length > 0} />

          <div className="hidden lg:block">
            <TripDraftQueue drafts={tripDrafts} />
          </div>

        <details className="hidden rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5 lg:block">
          <summary className="cursor-pointer text-lg font-black text-slate-950">
            Optional trip context
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Add destination, style, and interests when you want Wayline to suggest places from trip details.
          </p>
          <div className="mt-4">
            <AiTravelPlannerForm trips={trips} />
          </div>
        </details>

        <details
          className="hidden rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5 lg:block"
          id="reservation-forwarding"
        >
          <summary className="cursor-pointer text-lg font-black text-slate-950">
            Advanced sources
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Optional inbox, calendar, and source connections that can feed Wayline later.
          </p>
          {error ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {error}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3">
            {sources.map(({ connected, label, sourceType, statusLabel }) => (
              <div
                className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                key={sourceType}
              >
                <div>
                  <p className="font-medium">{label}</p>
                  <span className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold">
                    {statusLabel}
                  </span>
                </div>
                <AsyncActionButton
                  body={{
                    connected: !connected,
                    confirmDisconnect: connected ? true : undefined,
                    lastError: null,
                    sourceLabel: label,
                    sourceType
                  }}
                  confirmDescription={
                    connected
                      ? "Disconnect this import source? Wayline will stop using it for future imports."
                      : undefined
                  }
                  confirmLabel={connected ? "Confirm disconnect" : undefined}
                  endpoint="/api/import-sources"
                  method="PATCH"
                  successMessage={`${label} updated.`}
                >
                  {connected ? "Disconnect" : "Connect"}
                </AsyncActionButton>
              </div>
            ))}
          </div>
        </details>
      </section>

        <details className="hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:block">
          <summary className="cursor-pointer text-base font-black text-slate-950">
            Recent ideas
          </summary>
          <div className="mt-4 grid gap-3">
            {importedContent.slice(0, 6).map((post) => (
              <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-2xl bg-slate-50 px-3 py-3" key={post.id}>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-xs font-black uppercase text-blue-700 ring-1 ring-slate-200">
                  {post.sourcePlatform.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {post.sourceTitle || post.sourceUrl || "Screenshot import"}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {post.sourcePlatform} · {post.statusLabel}
                  </p>
                  {post.status === "scanning" || post.status === "pending" ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
                    </div>
                  ) : null}
                </div>
                {post.errorMessage ? (
                  <p className="col-span-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    {post.errorMessage}
                  </p>
                ) : null}
              </div>
            ))}
            {importedContent.length === 0 ? (
              <EmptyState
                action={
                  <a
                    className={tripUi.button.primaryCompact}
                    href={dashboardActionRoutes.plan.sampleMiami}
                  >
                    Try sample inspiration
                  </a>
                }
                className="rounded-2xl px-4 py-6"
                description={waylineCopy.emptyStates.savedInspiration}
                title="No saved inspiration yet."
              />
            ) : null}
          </div>
        </details>

        <details className="hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:block">
          <summary className="cursor-pointer text-base font-black text-slate-950">
              Review queue
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <UnfiledItemForm defaultTitle={defaultReviewTitle} />
            {unfiledItems.map((item) => (
              <div className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3" key={item.id}>
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {item.sourceType} · {item.parseStatus}
                  </p>
                </div>
                {item.parseStatus === "promoted" ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    Added to itinerary
                  </p>
                ) : trips.length ? (
                  <AsyncActionButton
                    body={{
                      tripId: item.tripId || trips[0].id
                    }}
                    endpoint={`/api/unfiled-items/${item.id}/promote`}
                    successMessage={`${item.title} added to itinerary.`}
                  >
                    Promote to {trips[0].name}
                  </AsyncActionButton>
                ) : (
                  <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    Create a trip before promotion.
                  </p>
                )}
              </div>
            ))}
            {unfiledItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                <p className="font-bold text-slate-950">No review queue items yet.</p>
                <p className="mt-1">
                  Add an unfiled item or connect an import source to start review.
                </p>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </WalletPageShell>
  );
}

function WorkflowStepRow() {
  return (
    <nav
      aria-label="Plan workflow"
      className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-white/10 !bg-[#050505] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ring-1 ring-white/10 lg:rounded-[1.75rem] lg:!bg-white lg:p-2 lg:border-slate-200 lg:shadow-sm lg:ring-0"
      data-testid="plan-workflow-stepper"
    >
      {["Add", "Review", "Trip"].map((label, index) => (
        <div
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-full px-2 text-xs font-black sm:px-3",
            index === 0
              ? "bg-white text-slate-950 lg:bg-slate-950 lg:text-white"
              : "bg-white/[0.1] text-white/76 lg:bg-slate-50 lg:text-slate-700"
          )}
          key={label}
        >
          <span>{index + 1}</span>
          <span>{label}</span>
        </div>
      ))}
    </nav>
  );
}

function MobileTripContext({ hasTrips }: { hasTrips: boolean }) {
  return (
    <section
      className="rounded-[1.65rem] border border-white/10 bg-[#050505] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] ring-1 ring-white/10 lg:hidden"
      data-testid="plan-trip-context"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
        Trip
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight">
            {hasTrips ? "Add to trip" : "Create trip"}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-white/68">
            {hasTrips
              ? "Choose a trip after Wayline finds places."
              : "Create a trip when your idea is ready."}
          </p>
        </div>
        <a
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950"
          href={dashboardActionRoutes.trips.list}
        >
          {hasTrips ? "Trips" : "Create"}
        </a>
      </div>
    </section>
  );
}
