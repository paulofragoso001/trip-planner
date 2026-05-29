"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { LocationAutocompletePanel } from "@/components/location-autocomplete-panel";
import { PanelErrorBoundary } from "@/components/panel-error-boundary";
import { TimelineImportPanelLoader } from "@/components/timeline-import-panel-loader";
import { TripHeader, TripShell } from "@/components/trip";
import { TripTabs } from "@/components/trip-workspace";
import { TripButton, TripCard, TripEyebrow, tripUi } from "@/components/trip-ui";
import type { Trip } from "@/lib/trips";

export type TripFormState = {
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  route: string;
  budget: string;
  notes: string;
};

type MetricsPanelProps = {
  trips: Trip[];
  userEmail: string;
};

export function DashboardMetricsPanel({ trips, userEmail }: MetricsPanelProps) {
  const activeTrips = trips.filter((trip) => trip.status !== "Completed").length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Traveler" value={userEmail || "Signed in"} />
      <Metric label="Trips saved" value={String(trips.length)} />
      <Metric label="Active plans" value={String(activeTrips)} />
    </div>
  );
}

type TripEditorPanelProps = {
  editingId: string | null;
  error: string;
  form: TripFormState;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: (field: keyof TripFormState, value: string) => void;
};

const statuses = ["Planning", "Booked", "In transit", "Completed"];

export function TripEditorPanel({
  editingId,
  error,
  form,
  saving,
  onCancel,
  onSubmit,
  onUpdateField
}: TripEditorPanelProps) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            My Trips
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {editingId ? "Edit trip" : "Create trip"}
          </h2>
        </div>
        {editingId ? (
          <button
            className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <label>
          Trip name
          <input
            onChange={(event) => onUpdateField("name", event.target.value)}
            placeholder="Tokyo spring launch"
            required
            value={form.name}
          />
        </label>

        <label>
          Destination
          <PanelErrorBoundary fallbackTitle="Location autocomplete">
            <LocationAutocompletePanel
              onChange={(value) => onUpdateField("destination", value)}
              value={form.destination}
            />
          </PanelErrorBoundary>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Start date
            <input
              onChange={(event) => onUpdateField("start_date", event.target.value)}
              type="date"
              value={form.start_date}
            />
          </label>
          <label>
            End date
            <input
              onChange={(event) => onUpdateField("end_date", event.target.value)}
              type="date"
              value={form.end_date}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Status
            <select
              onChange={(event) => onUpdateField("status", event.target.value)}
              value={form.status}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Budget
            <input
              min="0"
              onChange={(event) => onUpdateField("budget", event.target.value)}
              placeholder="3500"
              step="0.01"
              type="number"
              value={form.budget}
            />
          </label>
        </div>

        <label>
          Route
          <input
            onChange={(event) => onUpdateField("route", event.target.value)}
            placeholder="JFK to HND, Shinjuku, Kyoto"
            value={form.route}
          />
        </label>

        <label>
          Notes
          <textarea
            onChange={(event) => onUpdateField("notes", event.target.value)}
            placeholder="Airline confirmation, hotel area, restaurant shortlist..."
            rows={4}
            value={form.notes}
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <TripButton disabled={saving} type="submit" variant="primary">
          {saving ? "Saving..." : editingId ? "Update trip" : "Create trip"}
        </TripButton>
      </form>
    </section>
  );
}

type TripListPanelProps = {
  loading: boolean;
  selectedTripId: string | null;
  stateMessage: string;
  trips: Trip[];
  onDeleteTrip: (tripId: string) => void;
  onEditTrip: (trip: Trip) => void;
  onRefresh: () => void;
  onShareTrip: (trip: Trip) => void;
  onSelectTrip: (tripId: string) => void;
};

export function TripListPanel({
  loading,
  selectedTripId,
  stateMessage,
  trips,
  onDeleteTrip,
  onEditTrip,
  onRefresh,
  onShareTrip,
  onSelectTrip
}: TripListPanelProps) {
  return (
    <TripCard className="p-5" data-testid="trip-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <TripEyebrow>Live itinerary records</TripEyebrow>
          <h2 className="mt-2 text-2xl font-black">Trips</h2>
        </div>
        <TripButton onClick={onRefresh}>Refresh</TripButton>
      </div>

      {loading ? (
        <p className={`mt-6 rounded-2xl bg-[#f7f6f2] p-4 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
          {stateMessage}
        </p>
      ) : trips.length === 0 ? (
        <p className={`mt-6 rounded-2xl bg-[#f7f6f2] p-4 text-sm leading-6 ${tripUi.text.bodyMuted}`}>
          {stateMessage}
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {trips.map((trip) => {
            const selected = trip.id === selectedTripId;

            return (
              <TripCard
                as="article"
                className={selected ? "p-3 ring-2 ring-brand" : "p-3"}
                key={trip.id}
                variant="inset"
              >
                <button
                  aria-current={selected ? "true" : undefined}
                  className="w-full rounded-2xl p-2 text-left transition hover:bg-white"
                  data-testid={`trip-card-${trip.id}`}
                  onClick={() => onSelectTrip(trip.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{trip.name}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-evergreen ring-1 ring-black/10">
                      {trip.status}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
                    {trip.destination}
                  </p>
                  <p className={`mt-1 text-xs font-bold ${tripUi.text.bodyMuted}`}>
                    {formatDates(trip)}
                  </p>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className={tripUi.button.secondary} href={`/trip/${trip.slug || trip.id}`}>
                    Open
                  </Link>
                  <TripButton onClick={() => onShareTrip(trip)} variant="primaryCompact">
                    Share
                  </TripButton>
                  <TripButton onClick={() => onEditTrip(trip)}>Edit</TripButton>
                  <TripButton onClick={() => onDeleteTrip(trip.id)} variant="danger">
                    Delete
                  </TripButton>
                </div>
              </TripCard>
            );
          })}
        </div>
      )}
    </TripCard>
  );
}

type SelectedTripPanelProps = {
  stateMessage: string;
  trip: Trip | null;
  onShareTrip: (trip: Trip) => void;
};

export function SelectedTripPanel({
  onShareTrip,
  stateMessage,
  trip
}: SelectedTripPanelProps) {
  if (!trip) {
    return (
      <TripCard
        className="grid min-h-[420px] place-items-center p-8 text-center"
        data-testid="trip-preview"
      >
        <div>
          <TripEyebrow>Selected itinerary</TripEyebrow>
          <h2 className="mt-2 text-2xl font-black">Choose a trip to preview</h2>
          <p className={`mx-auto mt-2 max-w-md text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            {stateMessage}
          </p>
        </div>
      </TripCard>
    );
  }

  return (
    <TripShell
      header={<TripExecutionHeader onShareTrip={onShareTrip} trip={trip} />}
      tabs={<TripWorkspaceTabs trip={trip} />}
      testId="trip-preview"
      trip={buildTripShellTrip(trip)}
    >

      <TripItParityPanel trip={trip} />
      <WaylineOperatingSystemPanel trip={trip} />
      <BudgetCollaborativeMapPanel trip={trip} />

      <div id="trip-timeline-panel">
        <PanelErrorBoundary fallbackTitle="Timeline and import panel">
          <TimelineImportPanelLoader trip={trip} />
        </PanelErrorBoundary>
      </div>
    </TripShell>
  );
}

function TripExecutionHeader({
  onShareTrip,
  trip
}: {
  onShareTrip: (trip: Trip) => void;
  trip: Trip;
}) {
  return <TripHeader onShare={() => onShareTrip(trip)} />;
}

function TripWorkspaceTabs({ trip }: { trip: Trip }) {
  const itineraryItems = normalizeItineraryItems(trip.itinerary);
  const expenses = buildExpenseRows(itineraryItems);
  const mappedItems = itineraryItems.filter((item) =>
    Boolean(readString(item.location) || isCoordinatePair(item.lat, item.lng))
  );

  return (
    <TripTabs
      items={[
        {
          badge: String(itineraryItems.length),
          id: "timeline",
          label: "Timeline"
        },
        {
          badge: String(mappedItems.length),
          id: "map",
          label: "Map"
        },
        {
          badge: String(expenses.length),
          id: "budget",
          label: "Budget"
        },
        {
          id: "activity",
          label: "Activity"
        },
        {
          id: "sharing",
          label: "Sharing"
        }
      ]}
    />
  );
}

function buildTripShellTrip(trip: Trip) {
  const itineraryItems = normalizeItineraryItems(trip.itinerary);
  const budget = buildBudgetSummary(trip, buildExpenseRows(itineraryItems));

  return {
    actualSpend: budget.actual,
    destination: trip.destination,
    endDate: trip.end_date || "End date pending",
    id: trip.id,
    name: trip.name,
    plannedBudget: budget.planned,
    startDate: trip.start_date || "Start date pending"
  };
}

function BudgetCollaborativeMapPanel({ trip }: { trip: Trip }) {
  const itineraryItems = normalizeItineraryItems(trip.itinerary);
  const expenseRows = buildExpenseRows(itineraryItems);
  const budget = buildBudgetSummary(trip, expenseRows);
  const categoryRows = buildCategoryRows(expenseRows, budget.planned);
  const mapState = buildCollaborativeMapState(trip, itineraryItems);
  const activityRows = buildActivityRows(trip, expenseRows, mapState.pinCount);

  return (
    <section
      className="mt-6 grid gap-4 border-t border-black/10 pt-5"
      data-testid="budget-collab-panel"
      id="trip-budget-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Budget and collaborative map</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">Trip execution workspace</h3>
          <p className={`mt-1 max-w-2xl text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            Track planned versus actual spend, keep map pins tied to itinerary
            items, and expose the collaboration states needed for shared trip
            editing across devices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TripButton variant="primaryCompact">Add expense</TripButton>
          <TripButton variant="secondary">Add plan</TripButton>
          <TripButton variant="secondary">Share view</TripButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <BudgetKpi label="Planned spend" value={formatMoney(budget.planned)} />
        <BudgetKpi label="Actual spend" value={formatMoney(budget.actual)} />
        <BudgetKpi
          label="Remaining"
          tone={budget.remaining < 0 ? "danger" : "good"}
          value={formatMoney(Math.abs(budget.remaining))}
        />
        <BudgetKpi label="Overspend risk" tone={budget.tone} value={budget.riskLabel} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <TripCard className="p-4" variant="inset">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-black">Budget dashboard</h4>
              <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                {expenseRows.length
                  ? `${expenseRows.length} expense${expenseRows.length === 1 ? "" : "s"} linked to plans.`
                  : "No expenses recorded yet. Add expenses from the trip header or budget panel."}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${budget.statusClass}`}
            >
              {budget.status}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {categoryRows.map((row) => (
              <div key={row.category}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-black">{row.category}</span>
                  <span className={tripUi.text.bodyMuted}>{formatMoney(row.amount)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
            <div className="grid grid-cols-[1fr_90px_100px] gap-3 border-b border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#6f675c]">
              <span>Expense</span>
              <span>Amount</span>
              <span>Paid by</span>
            </div>
            {expenseRows.length ? (
              expenseRows.slice(0, 4).map((row) => (
                <div
                  className="grid grid-cols-[1fr_90px_100px] gap-3 px-3 py-3 text-sm"
                  key={row.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black">{row.merchant}</span>
                    <span className={`block truncate text-xs ${tripUi.text.bodyMuted}`}>
                      {row.category}
                    </span>
                  </span>
                  <span className="font-semibold">{formatMoney(row.amount)}</span>
                  <span className={`truncate ${tripUi.text.bodyMuted}`}>{row.paidBy}</span>
                </div>
              ))
            ) : (
              <div className={`px-3 py-4 text-sm ${tripUi.text.bodyMuted}`}>
                Expense table is ready for receipt uploads, category tracking, and
                linked itinerary costs.
              </div>
            )}
          </div>
        </TripCard>

        <TripCard className="p-4" variant="inset">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-black">Collaborative map</h4>
              <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                {mapState.pinCount} mapped pin{mapState.pinCount === 1 ? "" : "s"} across hotel,
                flight, restaurant, activity, and note layers.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
              {mapState.activeEditors} active editor{mapState.activeEditors === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Map controls">
            {["Search place", "Add pin", "Route mode", "Filters", "Share view"].map((control) => (
              <button
                className="min-h-11 rounded-full border border-black/10 bg-white px-4 text-sm font-bold text-[#5f574d] transition hover:bg-[#faf8f5] focus:outline-none focus:ring-4 focus:ring-brand/20"
                key={control}
                type="button"
              >
                {control}
              </button>
            ))}
          </div>

          <div className="mt-4 grid min-h-[240px] gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-[1fr_220px]">
            <div className="relative overflow-hidden rounded-2xl bg-[#e8eef6]">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(37,99,235,0.12),transparent),linear-gradient(45deg,transparent_48%,rgba(15,23,42,0.08)_49%,rgba(15,23,42,0.08)_51%,transparent_52%)]" />
              {mapState.previewPins.map((pin, index) => (
                <span
                  aria-label={`${pin.title} map pin`}
                  className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-xs font-black text-white shadow-lg ring-4 ring-white"
                  key={pin.id}
                  role="img"
                  style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
                >
                  {index + 1}
                </span>
              ))}
            </div>

            <div className="grid content-start gap-2">
              {mapState.layers.map((layer) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f6f2] px-3 py-2 text-sm"
                  key={layer.label}
                >
                  <span className="font-black">{layer.label}</span>
                  <span className={tripUi.text.bodyMuted}>{layer.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
                Presence
              </p>
              <div className="mt-3 flex items-center gap-2">
                {mapState.avatars.map((avatar) => (
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-black text-white ring-2 ring-white"
                    key={avatar}
                    title={avatar}
                  >
                    {avatar}
                  </span>
                ))}
              </div>
              <p className={`mt-2 text-sm ${tripUi.text.bodyMuted}`}>
                Last edited {mapState.lastEdited}.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
                Sharing permissions
              </p>
              <p className="mt-3 text-sm font-semibold text-ink">
                Owner can edit. Collaborators can edit and comment. Guests can view shared trip links.
              </p>
            </div>
          </div>
        </TripCard>
      </div>

      <TripCard className="p-4" variant="inset">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-base font-black" id="trip-activity-panel">Activity feed</h4>
          <span className={`text-sm font-semibold ${tripUi.text.bodyMuted}`}>
            Optimistic updates with version-stamp conflict warnings
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {activityRows.map((row) => (
            <div className="rounded-2xl bg-white p-3 text-sm ring-1 ring-black/10" key={row.label}>
              <p className="font-black">{row.label}</p>
              <p className={`mt-1 ${tripUi.text.bodyMuted}`}>{row.detail}</p>
            </div>
          ))}
        </div>
      </TripCard>
    </section>
  );
}

function BudgetKpi({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "danger" | "good" | "neutral" | "warn";
  value: string;
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-ink";

  return (
    <TripCard className="p-4" variant="inset">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${toneClass}`}>{value}</p>
    </TripCard>
  );
}

function WaylineOperatingSystemPanel({ trip }: { trip: Trip }) {
  const itineraryItems = normalizeItineraryItems(trip.itinerary);
  const airItems = itineraryItems.filter((item) => isAirItem(item));
  const documents = Array.isArray(trip.documents) ? trip.documents : [];
  const expenseModel = buildExpenseModel(trip, itineraryItems.length);
  const checklist = buildExecutionChecklist(trip, {
    airItems: airItems.length,
    documents: documents.length,
    itineraryItems: itineraryItems.length
  });
  const journalPrompts = buildJournalPrompts(trip);

  return (
    <section
      className="mt-6 grid gap-4 border-t border-black/10 pt-5"
      data-testid="wayline-os-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Wayline operating system</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">Planning depth beyond itinerary import</h3>
          <p className={`mt-1 max-w-2xl text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            Turn this trip into a shared workspace with planning prompts, map
            context, expense readiness, offline vault coverage, execution tasks,
            and post-trip memory capture.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-blue-700 ring-1 ring-blue-100">
          {expenseModel.perTraveler || "Budget pending"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <OperatingFeature
          detail={
            trip.is_public
              ? "Traveler view is ready for shared planning and handoff."
              : "Share this trip to unlock collaborative review."
          }
          label="Collaborative workspace"
          status={trip.is_public ? "Ready" : "Needs share link"}
          tone={trip.is_public ? "good" : "warn"}
        />
        <OperatingFeature
          detail={
            trip.route
              ? `Route context: ${trip.route}`
              : "Add a route summary or mapped stops to reason about travel time."
          }
          label="Map-first planning"
          status={trip.route ? "Route captured" : "Route needed"}
          tone={trip.route ? "good" : "warn"}
        />
        <OperatingFeature
          detail={`${expenseModel.baseline} baseline; ${expenseModel.splitHint}`}
          label="Expense split"
          status={expenseModel.status}
          tone={trip.budget > 0 ? "good" : "neutral"}
        />
        <OperatingFeature
          detail={
            documents.length
              ? "Documents are attached to this trip record."
              : "Add passports, tickets, visas, receipts, and offline PDFs."
          }
          label="Offline trip vault"
          status={documents.length ? `${documents.length} docs` : "Empty"}
          tone={documents.length ? "good" : "warn"}
        />
        <OperatingFeature
          detail={
            airItems.length
              ? "Flight items can drive check-in, disruption, and airport tasks."
              : "Add flight segments to activate ops-focused execution."
          }
          label="Mixed disruption ops"
          status={airItems.length ? `${airItems.length} flight signals` : "Needs flights"}
          tone={airItems.length ? "good" : "neutral"}
        />
        <OperatingFeature
          detail="Generate alternate plans, fill gaps, and refine the itinerary from current context."
          label="AI planning assistant"
          status="Prompt ready"
          tone="good"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <TripCard className="p-4" variant="inset">
          <h4 className="text-base font-black">Execution checklist</h4>
          <div className="mt-3 grid gap-2">
            {checklist.map((item) => (
              <label
                className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/10"
                key={item.label}
              >
                <input
                  checked={item.done}
                  className="mt-1 h-4 w-4"
                  readOnly
                  type="checkbox"
                />
                <span>
                  <span className="block font-black">{item.label}</span>
                  <span className={tripUi.text.bodyMuted}>{item.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </TripCard>

        <TripCard className="p-4" variant="inset">
          <h4 className="text-base font-black">AI planner and trip journal</h4>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
                Planning prompt
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {buildPlanningPrompt(trip, itineraryItems.length)}
              </p>
            </div>
            <div className="grid gap-2">
              {journalPrompts.map((prompt) => (
                <div
                  className={`rounded-2xl bg-white p-3 text-sm ${tripUi.text.bodyMuted} ring-1 ring-black/10`}
                  key={prompt}
                >
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </TripCard>
      </div>
    </section>
  );
}

function OperatingFeature({
  detail,
  label,
  status,
  tone
}: {
  detail: string;
  label: string;
  status: string;
  tone: "good" | "neutral" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : "bg-white text-[#5f574d] ring-black/10";

  return (
    <TripCard className="p-4" variant="inset">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
          {label}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${toneClass}`}>
          {status}
        </span>
      </div>
      <p className={`mt-3 text-sm leading-6 ${tripUi.text.bodyMuted}`}>{detail}</p>
    </TripCard>
  );
}

function TripItParityPanel({ trip }: { trip: Trip }) {
  const itineraryItems = normalizeItineraryItems(trip.itinerary);
  const documentCount = Array.isArray(trip.documents) ? trip.documents.length : 0;
  const airItems = itineraryItems.filter((item) => isAirItem(item));
  const confirmationCount = itineraryItems.filter((item) => hasConfirmation(item)).length;
  const bookingLinkCount = itineraryItems.filter((item) => hasBookingLink(item)).length;
  const readiness = calculateReadiness({
    airItems: airItems.length,
    confirmationCount,
    documentCount,
    itineraryCount: itineraryItems.length,
    isShared: trip.is_public,
    route: trip.route,
    startDate: trip.start_date
  });

  return (
    <section
      className="mt-6 grid gap-4 border-t border-black/10 pt-5"
      data-testid="tripit-coverage-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Traveler command center</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">TripIt-style coverage</h3>
          <p className={`mt-1 max-w-2xl text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            Wayline now audits imported confirmations, flight-monitoring readiness,
            share status, documents, and reminder coverage for the selected trip.
          </p>
        </div>
        <span className="rounded-full bg-[#f7f6f2] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-evergreen ring-1 ring-black/10">
          {readiness.score}% ready
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TravelSignal
          label="Master itinerary"
          status={itineraryItems.length ? `${itineraryItems.length} plans filed` : "Needs import"}
          tone={itineraryItems.length ? "good" : "warn"}
        />
        <TravelSignal
          label="Confirmations"
          status={
            confirmationCount
              ? `${confirmationCount} confirmation${confirmationCount === 1 ? "" : "s"} captured`
              : "No confirmation codes"
          }
          tone={confirmationCount ? "good" : "warn"}
        />
        <TravelSignal
          label="Flight monitoring"
          status={
            airItems.length
              ? `${airItems.length} flight${airItems.length === 1 ? "" : "s"} eligible`
              : "No flight plans yet"
          }
          tone={airItems.length ? "good" : "neutral"}
        />
        <TravelSignal
          label="Travel wallet"
          status={
            documentCount
              ? `${documentCount} document${documentCount === 1 ? "" : "s"} attached`
              : "Documents pending"
          }
          tone={documentCount ? "good" : "neutral"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <TripCard className="p-4" variant="inset">
          <h4 className="text-base font-black">Next reminders</h4>
          <div className="mt-3 grid gap-2">
            {buildReminderRows(trip, airItems.length).map((row) => (
              <div
                className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/10"
                key={row.label}
              >
                <div>
                  <p className="font-black">{row.label}</p>
                  <p className={`mt-1 ${tripUi.text.bodyMuted}`}>{row.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f7f6f2] px-2.5 py-1 text-xs font-black text-[#5f574d]">
                  {row.when}
                </span>
              </div>
            ))}
          </div>
        </TripCard>

        <TripCard className="p-4" variant="inset">
          <h4 className="text-base font-black">Action gaps</h4>
          <ul className="mt-3 grid gap-2 text-sm">
            {readiness.gaps.map((gap) => (
              <li className={`rounded-2xl bg-white p-3 ${tripUi.text.bodyMuted}`} key={gap}>
                {gap}
              </li>
            ))}
          </ul>
          {bookingLinkCount ? (
            <p className="mt-3 text-xs font-bold text-evergreen">
              {bookingLinkCount} booking link{bookingLinkCount === 1 ? "" : "s"} ready for traveler handoff.
            </p>
          ) : null}
        </TripCard>
      </div>
    </section>
  );
}

function TravelSignal({
  label,
  status,
  tone
}: {
  label: string;
  status: string;
  tone: "good" | "neutral" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : "bg-white text-[#5f574d] ring-black/10";

  return (
    <TripCard className="p-4" variant="inset">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
        {label}
      </p>
      <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${toneClass}`}>
        {status}
      </p>
    </TripCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <TripCard as="article" className="p-5">
      <TripEyebrow>{label}</TripEyebrow>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
    </TripCard>
  );
}

type NormalizedItineraryItem = {
  amount?: unknown;
  booking_url?: unknown;
  category?: unknown;
  cost?: unknown;
  confirmation?: unknown;
  confirmation_code?: unknown;
  confirmation_number?: unknown;
  currency?: unknown;
  date_time?: unknown;
  end_time?: unknown;
  flight_number?: unknown;
  id?: unknown;
  lat?: unknown;
  segment_type?: unknown;
  lng?: unknown;
  location?: unknown;
  merchant?: unknown;
  paid_by?: unknown;
  price?: unknown;
  receipt_url?: unknown;
  start_time?: unknown;
  title?: unknown;
  type?: unknown;
};

function normalizeItineraryItems(items: unknown[]) {
  return items.filter((item): item is NormalizedItineraryItem =>
    Boolean(item && typeof item === "object")
  );
}

function isAirItem(item: NormalizedItineraryItem) {
  const segmentType = String(item.segment_type || item.type || "").toLowerCase();
  return (
    segmentType === "air" ||
    segmentType === "flight" ||
    typeof item.flight_number === "string"
  );
}

function hasConfirmation(item: NormalizedItineraryItem) {
  return Boolean(
    readString(item.confirmation_code) ||
      readString(item.confirmation) ||
      readString(item.confirmation_number)
  );
}

function hasBookingLink(item: NormalizedItineraryItem) {
  return Boolean(readString(item.booking_url));
}

function calculateReadiness({
  airItems,
  confirmationCount,
  documentCount,
  itineraryCount,
  isShared,
  route,
  startDate
}: {
  airItems: number;
  confirmationCount: number;
  documentCount: number;
  itineraryCount: number;
  isShared: boolean;
  route: string | null;
  startDate: string | null;
}) {
  const checks = [
    itineraryCount > 0,
    confirmationCount > 0,
    airItems > 0,
    Boolean(route),
    Boolean(startDate),
    documentCount > 0,
    isShared
  ];
  const score = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );
  const gaps = [
    itineraryCount ? null : "Import confirmations or add plans to build the master itinerary.",
    confirmationCount ? null : "Add confirmation codes so booking details are available offline.",
    airItems ? null : "Add flight segments to enable status monitoring and check-in reminders.",
    route ? null : "Add a route summary for quick traveler context.",
    startDate ? null : "Add trip dates to unlock reminder timing.",
    documentCount ? null : "Attach passports, visas, receipts, or PDFs to complete the travel wallet.",
    isShared ? null : "Copy a share link so another traveler can view the itinerary."
  ].filter((gap): gap is string => Boolean(gap));

  return {
    gaps: gaps.length ? gaps : ["No obvious gaps. Keep confirmations current before departure."],
    score
  };
}

function buildReminderRows(trip: Trip, flightCount: number) {
  const start = parseTripDate(trip.start_date);
  const dayBefore = start ? offsetDate(start, -1) : null;
  const weekBefore = start ? offsetDate(start, -7) : null;

  return [
    {
      detail: flightCount
        ? "Review flight status, gates, and departure times before check-in opens."
        : "Add flight plans first so Wayline can monitor status changes.",
      label: "Flight check-in",
      when: dayBefore ? formatShortDate(dayBefore) : "Needs dates"
    },
    {
      detail: "Review hotel, activity, and car-rental cancellation windows before they close.",
      label: "Cancellation review",
      when: weekBefore ? formatShortDate(weekBefore) : "Needs dates"
    },
    {
      detail: trip.is_public
        ? "Traveler view is available for handoff."
        : "Create a share link when this itinerary is ready for others.",
      label: "Traveler handoff",
      when: trip.is_public ? "Ready" : "Pending"
    }
  ];
}

function buildExpenseRows(items: NormalizedItineraryItem[]) {
  return items
    .map((item, index) => {
      const amount =
        readNumber(item.amount) ||
        readNumber(item.cost) ||
        readNumber(item.price);

      if (!amount) {
        return null;
      }

      return {
        amount,
        category: formatCategory(
          readString(item.category) ||
            readString(item.segment_type) ||
            readString(item.type) ||
            "other"
        ),
        id: readString(item.id) || `expense-${index}`,
        merchant:
          readString(item.merchant) ||
          readString(item.title) ||
          readString(item.location) ||
          "Trip expense",
        paidBy: readString(item.paid_by) || "Trip owner"
      };
    })
    .filter((row): row is {
      amount: number;
      category: string;
      id: string;
      merchant: string;
      paidBy: string;
    } => Boolean(row));
}

function buildBudgetSummary(
  trip: Trip,
  expenseRows: Array<{ amount: number }>
) {
  const planned = Number(trip.budget || 0);
  const actual = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const remaining = planned - actual;
  const ratio = planned > 0 ? actual / planned : 0;
  const tone =
    ratio > 1 ? "danger" : ratio >= 0.9 ? "warn" : "good";
  const riskLabel =
    planned <= 0
      ? "Needs budget"
      : ratio > 1
        ? "Over budget"
        : ratio >= 0.9
          ? "Within 10%"
          : "Under budget";

  return {
    actual,
    planned,
    remaining,
    riskLabel,
    status:
      planned <= 0
        ? "Budget missing"
        : ratio > 1
          ? "Red alert"
          : ratio >= 0.9
            ? "Amber watch"
            : "Green",
    statusClass:
      planned <= 0
        ? "bg-white text-[#5f574d] ring-black/10"
        : ratio > 1
          ? "bg-red-50 text-red-700 ring-red-100"
          : ratio >= 0.9
            ? "bg-amber-50 text-amber-800 ring-amber-100"
            : "bg-emerald-50 text-emerald-700 ring-emerald-100",
    tone
  } as const;
}

function buildCategoryRows(
  expenseRows: Array<{ amount: number; category: string }>,
  plannedBudget: number
) {
  const totals = new Map<string, number>();

  for (const row of expenseRows) {
    totals.set(row.category, (totals.get(row.category) || 0) + row.amount);
  }

  const rows = Array.from(totals.entries()).map(([category, amount]) => ({
    amount,
    category,
    percent: plannedBudget > 0 ? Math.min(100, Math.round((amount / plannedBudget) * 100)) : 0
  }));

  if (rows.length) {
    return rows.sort((a, b) => b.amount - a.amount);
  }

  return [
    { amount: 0, category: "Flights", percent: 0 },
    { amount: 0, category: "Lodging", percent: 0 },
    { amount: 0, category: "Food", percent: 0 },
    { amount: 0, category: "Activities", percent: 0 }
  ];
}

function buildCollaborativeMapState(trip: Trip, items: NormalizedItineraryItem[]) {
  const mappedItems = items.filter((item) =>
    Boolean(readString(item.location) || isCoordinatePair(item.lat, item.lng))
  );
  const layerCounts = new Map<string, number>();

  for (const item of mappedItems) {
    const type = normalizeLayer(readString(item.segment_type) || readString(item.type));
    layerCounts.set(type, (layerCounts.get(type) || 0) + 1);
  }

  const previewPins = mappedItems.slice(0, 5).map((item, index) => ({
    id: readString(item.id) || `pin-${index}`,
    left: 18 + ((index * 17) % 62),
    title: readString(item.title) || readString(item.location) || `Pin ${index + 1}`,
    top: 24 + ((index * 19) % 48)
  }));

  return {
    activeEditors: trip.is_public ? 2 : 1,
    avatars: trip.is_public ? ["TO", "CO", "GV"] : ["TO"],
    lastEdited: formatRelativeTimestamp(trip.updated_at),
    layers: ["Hotels", "Flights", "Restaurants", "Activities", "Custom notes"].map((label) => ({
      count: layerCounts.get(label) || 0,
      label
    })),
    pinCount: mappedItems.length,
    previewPins: previewPins.length
      ? previewPins
      : [{ id: "empty-preview", left: 50, title: trip.destination, top: 50 }]
  };
}

function buildActivityRows(
  trip: Trip,
  expenses: Array<{ amount: number }>,
  pinCount: number
) {
  return [
    {
      detail: trip.is_public
        ? "Shared traveler view is live for collaborators and guests."
        : "Share the trip to enable collaborator presence and comments.",
      label: "Sharing"
    },
    {
      detail: expenses.length
        ? `${expenses.length} budget event${expenses.length === 1 ? "" : "s"} ready for realtime sync.`
        : "Expense mutations will update KPIs and category bars instantly.",
      label: "Budget updates"
    },
    {
      detail: pinCount
        ? `${pinCount} map pin${pinCount === 1 ? "" : "s"} can host comments and editor state.`
        : "Pins appear when plans include a location or coordinates.",
      label: "Map collaboration"
    }
  ];
}

function buildExpenseModel(trip: Trip, itineraryCount: number) {
  const budget = Number(trip.budget || 0);
  const hasBudget = Number.isFinite(budget) && budget > 0;
  const itemLabel = itineraryCount === 1 ? "item" : "items";

  return {
    baseline: hasBudget ? `${formatMoney(budget)} trip budget` : "No budget set",
    perTraveler: hasBudget ? `${formatMoney(budget / 2)} / traveler` : "",
    splitHint: itineraryCount
      ? `${itineraryCount} itinerary ${itemLabel} can be reviewed for shared costs.`
      : "Add plans before splitting activity, lodging, and transport costs.",
    status: hasBudget ? "Budget ready" : "Needs budget"
  };
}

function buildExecutionChecklist(
  trip: Trip,
  counts: { airItems: number; documents: number; itineraryItems: number }
) {
  return [
    {
      detail:
        trip.start_date && trip.end_date
          ? formatDates(trip)
          : "Add trip start and end dates.",
      done: Boolean(trip.start_date && trip.end_date),
      label: "Confirm core dates"
    },
    {
      detail: counts.itineraryItems
        ? `${counts.itineraryItems} plans imported or added.`
        : "Import confirmations or add plans.",
      done: counts.itineraryItems > 0,
      label: "Build itinerary"
    },
    {
      detail: counts.airItems
        ? `${counts.airItems} flight signals ready.`
        : "Add flight segments for status tracking.",
      done: counts.airItems > 0,
      label: "Prepare flight ops"
    },
    {
      detail: counts.documents
        ? `${counts.documents} documents attached.`
        : "Attach documents, tickets, IDs, and receipts.",
      done: counts.documents > 0,
      label: "Pack offline vault"
    },
    {
      detail: trip.is_public
        ? "Traveler view is shared."
        : "Copy a share link before handoff.",
      done: trip.is_public,
      label: "Share with travelers"
    }
  ];
}

function buildPlanningPrompt(trip: Trip, itineraryCount: number) {
  return `Refine ${trip.name} for ${trip.destination} (${formatDates(trip)}) with ${itineraryCount} saved plan${itineraryCount === 1 ? "" : "s"}, ${formatMoney(Number(trip.budget || 0))} budget context, and route ${trip.route || "not set"}.`;
}

function buildJournalPrompts(trip: Trip) {
  return [
    `Capture arrival notes, photos, and favorite places for ${trip.destination}.`,
    "Save receipts, local tips, and decisions worth reusing on the next trip.",
    trip.status === "Completed"
      ? "Summarize what worked before archiving the itinerary."
      : "Create a post-trip recap after the final day."
  ];
}

function parseTripDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function offsetDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(date);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isCoordinatePair(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function formatCategory(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim().toLowerCase();

  if (!normalized) {
    return "Other";
  }

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeLayer(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("hotel") || normalized.includes("lodging")) return "Hotels";
  if (normalized.includes("flight") || normalized.includes("air")) return "Flights";
  if (normalized.includes("restaurant") || normalized.includes("food")) return "Restaurants";
  if (normalized.includes("activity") || normalized.includes("event")) return "Activities";

  return "Custom notes";
}

function formatRelativeTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Budget pending";
  }

  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDates(trip: Trip) {
  if (!trip.start_date && !trip.end_date) {
    return "Dates pending";
  }

  return [trip.start_date, trip.end_date].filter(Boolean).join(" to ");
}
