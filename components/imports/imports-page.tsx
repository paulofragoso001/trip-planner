import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import type { ImportsData } from "@/app/dashboard/imports/loader";
import { UnfiledItemForm } from "@/components/imports/unfiled-item-form";

type ImportsPageProps = ImportsData;

export default function ImportsPage({
  error,
  reviewQueuePrefix,
  sources,
  trips,
  unfiledItems
}: ImportsPageProps) {
  const defaultReviewTitle = reviewQueuePrefix
    ? `${reviewQueuePrefix} United confirmation email`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="imports-route">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Imports</h2>
        <p className="mt-2 text-sm text-slate-600">
          Review connected sources and unfiled itinerary items here.
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
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Unfiled items</h3>
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
      </aside>
    </div>
  );
}
