import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import type { ImportsData } from "@/app/dashboard/imports/loader";
import { AiTravelPlannerForm } from "@/components/imports/ai-travel-planner-form";
import { ExtractedPlaceCard } from "@/components/imports/extracted-place-card";
import { SocialImportForm } from "@/components/imports/social-import-form";
import { TripDraftQueue } from "@/components/imports/trip-draft-queue";
import { UnfiledItemForm } from "@/components/imports/unfiled-item-form";
import { EmptyState, PageHeader, SectionCard, Stepper, StatusBadge } from "@/components/trip-ui";

type ImportsPageProps = ImportsData;

export default function ImportsPage({
  aiReviewItems,
  error,
  importedContent,
  reviewQueuePrefix,
  sources,
  tripDrafts,
  trips,
  unfiledItems
}: ImportsPageProps) {
  const defaultReviewTitle = reviewQueuePrefix
    ? `${reviewQueuePrefix} United confirmation email`
    : "";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" data-testid="imports-route">
      <section className="grid gap-6">
        <PageHeader
          actions={
            <>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
                href="#saved-inspiration"
              >
                Add inspiration
              </a>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-800 transition hover:bg-slate-200"
                href="#ai-review"
              >
                Review places
              </a>
            </>
          }
          eyebrow="Plan with AI"
          subtitle="Paste a link, note, or screenshot. Wayline finds the places, checks the destination, and turns approved ideas into a mapped trip plan."
          title="Turn saved inspiration into a trip."
        />

        <Stepper
          steps={[
            {
              description: "Paste travel links, screenshots, or notes.",
              label: "Add inspiration"
            },
            {
              description: "Approve, edit, merge, or dismiss AI places.",
              label: "Review places"
            },
            {
              description: "Create a confirmed trip with timeline and map stops.",
              label: "Create trip plan"
            }
          ]}
        />

        <AiTravelPlannerForm trips={trips} />

        <SectionCard
          description="Paste a TikTok, Instagram, travel note, or screenshot. Wayline will find the places for you."
          eyebrow="Saved Inspiration"
          id="saved-inspiration"
          title="Add travel ideas"
        >
          <div className="mt-5">
            <SocialImportForm trips={trips} />
          </div>
        </SectionCard>

        <SectionCard
          actions={
            <StatusBadge tone={aiReviewItems.length ? "blue" : "slate"}>
              {aiReviewItems.length} to review
            </StatusBadge>
          }
          description="Review these places before adding them to your trip."
          eyebrow="AI Review"
          id="ai-review"
          title="Review places Wayline found"
        >
          <div className="mt-4 grid gap-4">
            {aiReviewItems.map((place) => (
              <ExtractedPlaceCard
                key={place.id}
                mergeTargets={aiReviewItems.filter((target) => target.id !== place.id)}
                place={place}
                trips={trips}
              />
            ))}
            {aiReviewItems.length === 0 ? (
              <EmptyState
                description="Add inspiration to start planning. Wayline will extract real places and activities for review."
                title="No places to review yet."
              />
            ) : null}
          </div>
        </SectionCard>

        <TripDraftQueue drafts={tripDrafts} />

        <details className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer text-lg font-black text-slate-950">Advanced sources</summary>
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

      <aside className="grid content-start gap-5">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Feed</p>
          <h3 className="mt-1 text-base font-black">Recent saved inspiration</h3>
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
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm font-semibold text-slate-600">
                Saved inspiration will appear here after you paste a link, upload a screenshot, or add notes.
              </p>
            ) : null}
          </div>
        </section>

        <details className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer text-base font-black text-slate-950">Legacy review queue</summary>
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
                  Promoted to timeline
                </p>
              ) : trips.length ? (
                <AsyncActionButton
                  body={{
                    tripId: item.tripId || trips[0].id
                  }}
                  endpoint={`/api/unfiled-items/${item.id}/promote`}
                  successMessage={`${item.title} promoted to timeline.`}
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
              <p className="mt-1">Add an unfiled item or connect an import source to start review.</p>
            </div>
          ) : null}
        </div>
        </details>
      </aside>
    </div>
  );
}
