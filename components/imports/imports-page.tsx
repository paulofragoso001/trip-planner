import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import type { ImportsData } from "@/app/dashboard/imports/loader";
import { AiTravelPlannerForm } from "@/components/imports/ai-travel-planner-form";
import { ExtractedPlaceCard } from "@/components/imports/extracted-place-card";
import { SocialImportForm } from "@/components/imports/social-import-form";
import { TripDraftQueue } from "@/components/imports/trip-draft-queue";
import { UnfiledItemForm } from "@/components/imports/unfiled-item-form";

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
        <AiTravelPlannerForm trips={trips} />

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Saved Inspiration</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Scan links, screenshots, and notes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Paste Instagram, TikTok, Pinterest, YouTube, or travel notes. Wayline extracts places into reviewable itinerary candidates.
          </p>
          <div className="mt-5">
            <SocialImportForm trips={trips} />
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">AI Review</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Confirm AI candidates</h3>
              <p className="mt-1 text-sm text-slate-600">
                Edit, merge, reject, or approve places into a trip draft.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {aiReviewItems.length} pending
            </span>
          </div>
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
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                <p className="font-bold text-slate-950">No AI candidates yet.</p>
                <p className="mt-1">Scan saved inspiration to create reviewable places. Approved items move into the trip draft queue.</p>
              </div>
            ) : null}
          </div>
        </div>

        <TripDraftQueue drafts={tripDrafts} />

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black">Connected sources</h2>
        <p className="mt-2 text-sm text-slate-600">
          Review inbox, calendar, and source connections that feed Wayline.
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
        </div>
      </section>

      <aside className="grid content-start gap-5">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Feed</p>
          <h3 className="mt-1 text-base font-black">Recent inspiration scans</h3>
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

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-black">Trip draft queue</h3>
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
        </section>
      </aside>
    </div>
  );
}
