import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import type { ImportsData } from "@/app/dashboard/imports/loader";
import { AiTravelPlannerForm } from "@/components/imports/ai-travel-planner-form";
import { ExtractedPlaceCard } from "@/components/imports/extracted-place-card";
import { SocialImportForm } from "@/components/imports/social-import-form";
import { TripDraftQueue } from "@/components/imports/trip-draft-queue";
import { UnfiledItemForm } from "@/components/imports/unfiled-item-form";
import { EmptyState, StatusBadge, tripUi } from "@/components/trip-ui";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";
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
      heroImage={heroImage}
      subtitle="Add a note, link, or screenshot. Wayline finds places for you to review."
      title="Capture travel ideas"
    >
      <div className="grid gap-5" data-testid="imports-route">
        <section className="grid gap-5">
          <WorkflowStepRow />

          <WalletCard
            eyebrow="Ideas"
            id="saved-inspiration"
            title="Add an idea"
            variant="primary"
          >
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Paste a travel note, link, or screenshot.
            </p>
            <div className="mt-5">
              <SocialImportForm
                defaultRawText={sampleInspiration?.text}
                sampleKey={sampleInspiration?.key}
                trips={trips}
              />
            </div>
          </WalletCard>

          <div id="ai-review" />
          {aiReviewItems.length ? (
            <WalletCard
              action={<StatusBadge tone="blue">{aiReviewItems.length} to review</StatusBadge>}
              eyebrow="AI Review"
              title="Review places"
              variant="primary"
            >
              <p className="text-sm font-semibold leading-6 text-slate-600">
                Approve, edit, merge, or dismiss each place.
              </p>
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

          <TripDraftQueue drafts={tripDrafts} />

        <details className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5">
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

        <details className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5">
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
                    lastError: null,
                    sourceLabel: label,
                    sourceType
                  }}
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

        <details className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
                    href="/dashboard/imports?sample=miami#saved-inspiration"
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

        <details className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <summary className="cursor-pointer text-base font-black text-slate-950">
            Legacy review queue
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
      className="grid grid-cols-3 gap-2 rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm"
      data-testid="plan-workflow-stepper"
    >
      {["Add", "Review", "Create"].map((label, index) => (
        <div
          className={[
            "flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-black",
            index === 0 ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700"
          ].join(" ")}
          key={label}
        >
          <span>{index + 1}</span>
          <span>{label}</span>
        </div>
      ))}
    </nav>
  );
}
