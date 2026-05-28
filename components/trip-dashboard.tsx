"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import DraggableList, { type DashboardTimelineItem } from "@/components/DraggableList";
import {
  SegmentQuickForm,
  type SegmentTemplate
} from "@/components/SegmentQuickForm";
import { TripButton, TripCard, TripEyebrow, tripUi } from "@/components/trip-ui";
import {
  getApiErrorMessage,
  readApiField,
  readLegacyArrayOrField
} from "@/lib/api/client";
import type { Trip } from "@/lib/trips";

const FlightTruthPanel = dynamic(
  () => import("@/components/FlightTruthPanel").then((mod) => mod.FlightTruthPanel),
  {
    loading: () => <div className="text-sm text-slate-500">Loading flight status...</div>,
    ssr: false
  }
);

const LocationAutocomplete = dynamic(
  () => import("@/components/LocationAutocomplete"),
  {
    loading: () => (
      <input
        className="google-places-autocomplete"
        disabled
        placeholder="Loading location search..."
      />
    ),
    ssr: false
  }
);

const TripMapTab = dynamic(
  () => import("@/components/trip-map-tab").then((mod) => mod.TripMapTab),
  {
    loading: () => <div className="text-sm text-slate-500">Loading map...</div>,
    ssr: false
  }
);

type TripDashboardProps = {
  userEmail: string;
};

type TripForm = {
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  route: string;
  budget: string;
  notes: string;
};

type SaveSegmentInput = {
  tripId: string;
  template: SegmentTemplate;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  notes: string;
  confirmationCode?: string;
  bookingUrl?: string;
  organizer?: string;
  virtualUrl?: string;
};

type UnfiledItem = {
  id: string;
  trip_id: string | null;
  source_type: string;
  source_label: string | null;
  raw_text: string | null;
  parse_status: string;
  parse_confidence: number | null;
  title: string | null;
  location: string | null;
  date_time: string | null;
  segment_type: string | null;
  notes: string | null;
  promoted_trip_segment_id: string | null;
  created_at: string;
};

type ImportSource = {
  source_type: string;
  connected: boolean;
  source_label: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

type SelectedTripTab = "overview" | "timeline" | "map";

const selectedTripTabs: Array<{ id: SelectedTripTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "map", label: "Map" }
];

const emptyForm: TripForm = {
  name: "",
  destination: "",
  start_date: "",
  end_date: "",
  status: "Planning",
  route: "",
  budget: "",
  notes: ""
};

const statuses = ["Planning", "Booked", "In transit", "Completed"];

const defaultImportSources: ImportSource[] = [
  {
    source_type: "email_forwarding",
    connected: false,
    source_label: "Forwarded email",
    last_synced_at: null,
    last_error: null
  },
  {
    source_type: "gmail",
    connected: false,
    source_label: "Gmail inbox sync",
    last_synced_at: null,
    last_error: null
  },
  {
    source_type: "outlook",
    connected: false,
    source_label: "Outlook inbox sync",
    last_synced_at: null,
    last_error: null
  },
  {
    source_type: "calendar",
    connected: false,
    source_label: "Calendar feed",
    last_synced_at: null,
    last_error: null
  }
];

export function TripDashboard({ userEmail }: TripDashboardProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tripListState, setTripListState] = useState("Loading trips...");
  const [previewState, setPreviewState] = useState("Select a trip to view details.");
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [unfiledItems, setUnfiledItems] = useState<UnfiledItem[]>([]);
  const [unfiledLoading, setUnfiledLoading] = useState(false);
  const [importSources, setImportSources] = useState<ImportSource[]>(defaultImportSources);
  const [importSourcesLoading, setImportSourcesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const addSegmentButtonRef = useRef<HTMLButtonElement | null>(null);

  const upcomingTrips = useMemo(
    () => trips.filter((trip) => trip.status !== "Completed").length,
    [trips]
  );
  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips]
  );
  const visibleTimelineItems = useMemo(() => {
    if (!selectedTrip) {
      return [];
    }

    const items = normalizeTimelineItems(selectedTrip.itinerary);

    if (timelineOrder.length === 0) {
      return items;
    }

    const byId = new Map(items.map((item) => [item.id, item]));
    const orderedItems = timelineOrder
      .map((id) => byId.get(id))
      .filter(isDashboardTimelineItem);
    const orderedIds = new Set(orderedItems.map((item) => item.id));
    const remainingItems = items.filter((item) => !orderedIds.has(item.id));

    return [...orderedItems, ...remainingItems];
  }, [selectedTrip, timelineOrder]);

  async function loadTrips() {
    setTripsLoading(true);
    setTripListState("Loading trips...");
    setError("");

    const response = await fetch("/api/trips", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      const message = payload.error || "Could not load trips.";
      setError(message);
      setTripListState(message);
      setTripsLoading(false);
      return;
    }

    const nextTrips = payload.trips || [];
    setTrips(nextTrips);
    setSelectedTripId((current) =>
      current && nextTrips.some((trip: Trip) => trip.id === current)
        ? current
        : nextTrips[0]?.id ?? null
    );
    setTripListState(
      nextTrips.length === 0
        ? "No trips saved yet. Create the first one to test the database, protected API routes, and responsive dashboard flow."
        : "Select a trip to view details."
    );
    setPreviewState("Select a trip to view details.");
    setTripsLoading(false);
  }

  useEffect(() => {
    loadTrips();
    loadUnfiledItems();
    loadImportSources();
  }, []);

  useEffect(() => {
    setTimelineOrder([]);
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTrip) {
      setPreviewState("Select a trip to view details.");
      return;
    }

    setPreviewState(`${selectedTrip.name} selected.`);
  }, [selectedTrip]);

  async function loadTripItinerary(tripId: string) {
    const itineraryResponse = await fetch(
      `/api/itinerary?tripId=${encodeURIComponent(tripId)}`,
      { cache: "no-store" }
    );
    const itineraryPayload = await itineraryResponse.json();

    if (!itineraryResponse.ok) {
      throw new Error(getApiErrorMessage(itineraryPayload, "Could not load itinerary."));
    }

    let itinerary = readLegacyArrayOrField<Record<string, unknown>>(
      itineraryPayload,
      "itinerary",
      []
    );

    if (itinerary.length === 0) {
      const segmentResponse = await fetch(
        `/api/trip-segments?tripId=${encodeURIComponent(tripId)}`,
        { cache: "no-store" }
      );
      const segmentPayload = await segmentResponse.json();

      if (!segmentResponse.ok) {
        throw new Error(getApiErrorMessage(segmentPayload, "Could not load trip segments."));
      }

      itinerary = readLegacyArrayOrField<Record<string, unknown>>(
        segmentPayload,
        "segments",
        []
      );
    }

    return itinerary;
  }

  async function refreshTripItinerary(tripId: string) {
    setPreviewLoading(true);
    setError("");

    try {
      const itinerary = await loadTripItinerary(tripId);

      setTrips((current) =>
        current.map((trip) =>
          trip.id === tripId ? { ...trip, itinerary } : trip
        )
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load trip details.");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedTripId) {
      return;
    }

    let active = true;

    async function loadSelectedTripItinerary(tripId: string) {
      setPreviewLoading(true);
      setError("");

      try {
        const itinerary = await loadTripItinerary(tripId);
        if (!active) return;

        setTrips((current) =>
          current.map((trip) =>
            trip.id === tripId ? { ...trip, itinerary } : trip
          )
        );
      } catch (error) {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Could not load trip details.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    loadSelectedTripItinerary(selectedTripId);

    return () => {
      active = false;
    };
  }, [selectedTripId]);

  async function saveSegment(input: SaveSegmentInput) {
    const response = await fetch("/api/itinerary", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      setError("Could not save segment.");
      throw new Error(`Failed to save segment: ${response.status}`);
    }

    await response.json();
    await refreshTripItinerary(input.tripId);
  }

  async function loadUnfiledItems() {
    setUnfiledLoading(true);

    try {
      const response = await fetch("/api/unfiled-items", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not load unfiled items."));
      }

      setUnfiledItems(readApiField<UnfiledItem[]>(payload, "items", []));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load unfiled items.");
    } finally {
      setUnfiledLoading(false);
    }
  }

  async function loadImportSources() {
    setImportSourcesLoading(true);

    try {
      const response = await fetch("/api/import-sources", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not load import sources."));
      }

      setImportSources(readApiField<ImportSource[]>(payload, "sources", defaultImportSources));
    } catch {
      setImportSources(defaultImportSources);
    } finally {
      setImportSourcesLoading(false);
    }
  }

  async function updateImportSource(sourceType: string, connected: boolean) {
    const previousSources = importSources;
    const nextSyncedAt = connected ? new Date().toISOString() : null;

    setImportSources((current) =>
      mergeImportSources(
        current.map((source) =>
          source.source_type === sourceType
            ? {
                ...source,
                connected,
                last_synced_at: nextSyncedAt,
                last_error: null
              }
            : source
        )
      )
    );

    try {
      const response = await fetch("/api/import-sources", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceType, connected })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not update import source."));
      }

      const updatedSource = readApiField<ImportSource | null>(payload, "source", null);
      setImportSources((current) =>
        mergeImportSources(
          current.map((source) =>
            source.source_type === sourceType && updatedSource ? updatedSource : source
          )
        )
      );
      announce(`${formatSourceType(sourceType)} ${connected ? "connected" : "disconnected"}.`);
    } catch (error) {
      setImportSources(previousSources);
      setError(error instanceof Error ? error.message : "Could not update import source.");
    }
  }

  async function refreshFlightStatuses(tripId: string, items: DashboardTimelineItem[]) {
    const flightItems = items.filter(isFlightTimelineItem);

    if (!flightItems.length) {
      announce("No flights to refresh.");
      return;
    }

    try {
      const results = await Promise.all(
        flightItems.map(async (item) => {
          const response = await fetch("/api/itinerary/flight-status", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              tripId,
              itemId: item.id,
              flightNumber: item.flight_number || item.confirmation_code || null,
              airline: item.airline || item.provider || null,
              departureAirport: item.departure_airport || null,
              arrivalAirport: item.arrival_airport || null,
              scheduledDeparture: item.scheduled_departure || item.date_time || null,
              estimatedDeparture: item.estimated_departure || item.date_time || null,
              gate: item.gate || null,
              terminal: item.terminal || null,
              status: item.flight_status || "scheduled"
            })
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(getApiErrorMessage(payload, "Could not refresh flight status."));
          }

          return {
            alert: readApiField<string | undefined>(payload, "alert", undefined),
            item: readApiField<Record<string, unknown>>(payload, "item", {})
          };
        })
      );

      setTrips((current) =>
        current.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                itinerary: replaceItineraryItems(trip.itinerary, results.map((result) => result.item))
              }
            : trip
        )
      );

      announce(results.find((result) => result.alert)?.alert || "Flight statuses updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not refresh flight status.");
    }
  }

  async function createUnfiledItem(input: {
    sourceType: string;
    sourceLabel: string;
    rawText: string;
  }) {
    const response = await fetch("/api/unfiled-items", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const payload = await response.json();

    if (!response.ok) {
      const message = getApiErrorMessage(
        payload,
        `Failed to create unfiled item: ${response.status}`
      );
      setError(message);
      throw new Error(message);
    }

    setUnfiledItems((current) => [
      readApiField<UnfiledItem>(payload, "item", {} as UnfiledItem),
      ...current
    ]);
    announce("Imported item added to Unfiled Items for review.");
  }

  async function promoteUnfiledItem(item: UnfiledItem) {
    if (!selectedTrip) {
      setError("Select a trip before promoting an unfiled item.");
      return;
    }

    if (!item.title || !item.date_time) {
      setError("This unfiled item needs a title and date before it can become a plan.");
      return;
    }

    const response = await fetch("/api/itinerary", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tripId: selectedTrip.id,
        title: item.title,
        location: item.location,
        date_time: item.date_time,
        notes: item.notes,
        segment_type: item.segment_type || "activity"
      })
    });
    const itineraryItem = await response.json();

    if (!response.ok) {
      setError(getApiErrorMessage(itineraryItem, "Could not promote this unfiled item."));
      return;
    }
    const promotedItem = readApiField<Record<string, unknown>>(
      itineraryItem,
      "item",
      itineraryItem
    );

    const updateResponse = await fetch(`/api/unfiled-items/${item.id}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tripId: selectedTrip.id,
        parseStatus: "promoted",
        promotedTripSegmentId:
          typeof promotedItem.id === "string" ? promotedItem.id : undefined
      })
    });

    if (!updateResponse.ok) {
      setError("The plan was created, but the unfiled item could not be marked promoted.");
      await refreshTripItinerary(selectedTrip.id);
      return;
    }

    await refreshTripItinerary(selectedTrip.id);
    await loadUnfiledItems();
    announce("Unfiled item promoted into the selected trip.");
  }

  const reorderTimeline = useCallback(
    async (tripId: string, orderedItemIds: string[]) => {
      const previousOrder = timelineOrder;
      setIsReordering(true);
      setTimelineOrder(orderedItemIds);

      try {
        const response = await fetch("/api/itinerary/reorder", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tripId,
            orderedItemIds
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to reorder itinerary: ${response.status}`);
        }

        await response.json();
        await refreshTripItinerary(tripId);
        announce("Timeline order updated successfully.");
        requestAnimationFrame(() => addSegmentButtonRef.current?.focus());
      } catch (error) {
        setTimelineOrder(previousOrder);
        setError("Could not update timeline order.");
        throw error;
      } finally {
        setIsReordering(false);
      }
    },
    [timelineOrder]
  );

  function announce(message: string) {
    setError("");
    setPreviewState(message);
  }

  function updateField(field: keyof TripForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editTrip(trip: Trip) {
    setSelectedTripId(trip.id);
    setPreviewState(`${trip.name} selected.`);
    setEditingId(trip.id);
    setForm({
      name: trip.name,
      destination: trip.destination,
      start_date: trip.start_date || "",
      end_date: trip.end_date || "",
      status: trip.status,
      route: trip.route || "",
      budget: String(trip.budget || ""),
      notes: trip.notes || ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function submitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch(editingId ? `/api/trips/${editingId}` : "/api/trips", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        budget: Number(form.budget || 0)
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not save this trip.");
      setSaving(false);
      return;
    }

    if (editingId) {
      setTrips((current) =>
        current.map((trip) => (trip.id === editingId ? payload.trip : trip))
      );
      setSelectedTripId(payload.trip.id);
      setPreviewState(`${payload.trip.name} selected.`);
    } else {
      setTrips((current) => [payload.trip, ...current]);
      setSelectedTripId(payload.trip.id);
      setPreviewState(`${payload.trip.name} selected.`);
    }

    resetForm();
    setSaving(false);
  }

  async function deleteTrip(id: string) {
    const response = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not delete this trip.");
      return;
    }

    setTrips((current) => current.filter((trip) => trip.id !== id));
    if (editingId === id) {
      resetForm();
    }
    if (selectedTripId === id) {
      setSelectedTripId(null);
      setPreviewState("Select a trip to view details.");
    }
  }

  function selectTrip(tripId: string) {
    const trip = trips.find((item) => item.id === tripId);
    setSelectedTripId(tripId);
    setPreviewState(trip ? `${trip.name} selected.` : "Trip selected.");
  }

  async function shareTrip(trip: Trip) {
    const response = await fetch(`/api/trips/${trip.id}/share`, { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not create a share link.");
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((currentTrip) =>
        currentTrip.id === trip.id ? payload.trip : currentTrip
      )
    );

    const sharedTrip = payload.trip as Trip;
    const tripPath = `/trip/${sharedTrip.slug || sharedTrip.id}`;
    const shareUrl = `${window.location.origin}${tripPath}`;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied!");
        return;
      } catch {
        setError(`Share link ready: ${shareUrl}`);
        return;
      }
    }

    setError(`Share link ready: ${shareUrl}`);
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]" data-testid="dashboard-shell">
      <div
        aria-atomic="true"
        aria-live="assertive"
        className="sr-only"
        data-testid="dashboard-live-region"
      >
        {error || previewState || tripListState}
      </div>
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Trip database
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {editingId ? "Edit trip" : "Create trip"}
            </h2>
          </div>
          {editingId ? (
            <button
              className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          ) : null}
        </div>

        <form className="mt-5 grid gap-4" onSubmit={submitTrip}>
          <label>
            Trip name
            <input
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Tokyo spring launch"
            />
          </label>

          <label>
            Destination
            <LocationAutocomplete
              placeholder="Search destination city, country, airport, hotel..."
              value={form.destination}
              onInputChange={(value) => updateField("destination", value)}
              onSelect={(place) => updateField("destination", place.address)}
            />
            {form.destination ? (
              <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                Selected: {form.destination}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                Type a destination to save with this trip.
              </span>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Start date
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => updateField("start_date", event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => updateField("end_date", event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
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
                step="0.01"
                type="number"
                value={form.budget}
                onChange={(event) => updateField("budget", event.target.value)}
                placeholder="3500"
              />
            </label>
          </div>

          <label>
            Route
            <input
              value={form.route}
              onChange={(event) => updateField("route", event.target.value)}
              placeholder="JFK to HND, Shinjuku, Kyoto"
            />
          </label>

          <label>
            Notes
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Airline confirmation, hotel area, restaurant shortlist..."
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

      <section className="min-w-0">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Traveler" value={userEmail || "Signed in"} />
          <Metric label="Trips saved" value={String(trips.length)} />
          <Metric label="Active plans" value={String(upcomingTrips)} />
        </div>

        <div className="mt-6 grid gap-5 min-[1180px]:grid-cols-[minmax(280px,360px)_1fr]">
          <TripList
            loading={tripsLoading}
            onDeleteTrip={deleteTrip}
            onEditTrip={editTrip}
            onRefresh={loadTrips}
            onSelectTrip={selectTrip}
            onShareTrip={shareTrip}
            selectedTripId={selectedTripId}
            stateMessage={tripListState}
            trips={trips}
          />
          <SelectedTripPreview
            addButtonRef={addSegmentButtonRef}
            isReordering={isReordering}
            loading={tripsLoading || previewLoading}
            onAnnounce={announce}
            onBackToTrips={() => {
              setSelectedTripId(null);
              setPreviewState("Select a trip to view details.");
            }}
            onEditTrip={editTrip}
            onReorderTimeline={reorderTimeline}
            onRefreshFlightStatuses={refreshFlightStatuses}
            onSaveSegment={saveSegment}
            onShareTrip={shareTrip}
            stateMessage={previewState}
            trip={selectedTrip}
            timelineItems={visibleTimelineItems}
          />
        </div>
        <ImportQueue
          importSources={importSources}
          importSourcesLoading={importSourcesLoading}
          items={unfiledItems}
          loading={unfiledLoading}
          onCreateItem={createUnfiledItem}
          onPromoteItem={promoteUnfiledItem}
          onUpdateImportSource={updateImportSource}
          selectedTrip={selectedTrip}
        />
      </section>
    </div>
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

type ImportQueueProps = {
  importSources: ImportSource[];
  importSourcesLoading: boolean;
  items: UnfiledItem[];
  loading: boolean;
  selectedTrip: Trip | null;
  onCreateItem: (input: {
    sourceType: string;
    sourceLabel: string;
    rawText: string;
  }) => Promise<void>;
  onPromoteItem: (item: UnfiledItem) => Promise<void>;
  onUpdateImportSource: (sourceType: string, connected: boolean) => Promise<void>;
};

function ImportSourcesPanel({
  loading,
  sources,
  onUpdateImportSource
}: {
  loading: boolean;
  sources: ImportSource[];
  onUpdateImportSource: (sourceType: string, connected: boolean) => Promise<void>;
}) {
  const orderedSources = mergeImportSources(sources);

  return (
    <div className="mt-5 grid gap-3" data-testid="import-sources">
      <div>
        <h3 className="text-lg font-black">Import Sources</h3>
        <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
          Connect sources that produce itinerary items, then review anything uncertain
          in Unfiled Items before it becomes part of the trip timeline.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {orderedSources.map((source) => {
          const connected = Boolean(source.connected);

          return (
            <article
              className="rounded-2xl border border-black/10 bg-[#f7f6f2] p-4"
              data-testid={`import-source-${source.source_type}`}
              key={source.source_type}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[#6f675c]">
                    {formatSourceType(source.source_type)}
                  </div>
                  <h4 className="mt-1 font-black">{source.source_label || formatSourceType(source.source_type)}</h4>
                </div>
                <span
                  className={
                    connected
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-evergreen"
                      : "rounded-full bg-white px-3 py-1 text-xs font-black text-[#6f675c] ring-1 ring-black/10"
                  }
                >
                  {connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className={`mt-3 text-sm ${tripUi.text.bodyMuted}`}>
                {descriptionForSource(source.source_type)}
              </p>
              <p className="mt-3 text-xs font-bold text-[#6f675c]">
                {source.last_error
                  ? `Last error: ${source.last_error}`
                  : source.last_synced_at
                    ? `Last synced ${formatImportDate(source.last_synced_at)}`
                    : "No sync yet"}
              </p>
              <div className="mt-4">
                <TripButton
                  disabled={loading}
                  onClick={() => onUpdateImportSource(source.source_type, !connected)}
                  variant={connected ? "secondary" : "primaryCompact"}
                >
                  {connected ? "Disconnect" : connectLabelForSource(source.source_type)}
                </TripButton>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ImportQueue({
  importSources,
  importSourcesLoading,
  items,
  loading,
  selectedTrip,
  onCreateItem,
  onPromoteItem,
  onUpdateImportSource
}: ImportQueueProps) {
  const [sourceType, setSourceType] = useState("email");
  const [sourceLabel, setSourceLabel] = useState("");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeItems = items.filter((item) => item.parse_status !== "promoted");

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreateItem({ sourceType, sourceLabel, rawText });
      setSourceLabel("");
      setRawText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TripCard as="section" className="mt-6 p-5" data-testid="unfiled-items">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <TripEyebrow>Import automation</TripEyebrow>
          <h2 className="mt-2 text-2xl font-black">Unfiled Items</h2>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            Paste forwarded email text, PDF/photo extraction, or screenshot notes here.
            Wayline stores the source, parse confidence, and review status before
            promoting it into a trip.
          </p>
        </div>
        <span className="rounded-full bg-[#f7f6f2] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-evergreen ring-1 ring-black/10">
          {activeItems.length} waiting
        </span>
      </div>

      <ImportSourcesPanel
        loading={importSourcesLoading}
        onUpdateImportSource={onUpdateImportSource}
        sources={importSources}
      />

      <form className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr]" onSubmit={submitImport}>
        <label>
          Source
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="email">Forwarded email</option>
            <option value="pdf">PDF import</option>
            <option value="photo">Photo import</option>
            <option value="screenshot">Screenshot import</option>
            <option value="manual">Manual note</option>
          </select>
        </label>
        <label>
          Source label
          <input
            data-testid="import-source-label"
            placeholder="United confirmation, hotel PDF, Apple Intelligence summary..."
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.target.value)}
          />
        </label>
        <label className="lg:col-span-2">
          Confirmation text
          <textarea
            data-testid="import-raw-text"
            rows={5}
            placeholder="Paste the confirmation or extracted text. Lines like Location: and 2026-06-01T14:00 help the parser."
            required
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />
        </label>
        <div className="lg:col-span-2">
          <TripButton disabled={submitting} type="submit" variant="primaryCompact">
            {submitting ? "Importing..." : "Add to Unfiled Items"}
          </TripButton>
        </div>
      </form>

      <div className="mt-6 grid gap-3">
        {loading ? (
          <p className={`rounded-2xl bg-[#f7f6f2] p-4 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
            Loading unfiled items...
          </p>
        ) : activeItems.length === 0 ? (
          <p className={`rounded-2xl border border-dashed border-black/15 p-4 text-sm ${tripUi.text.bodyMuted}`}>
            No unfiled items yet. Imported confirmations that need review will appear here before becoming plans.
          </p>
        ) : (
          activeItems.map((item) => (
            <article
              className="rounded-2xl border border-black/10 bg-[#f7f6f2] p-4"
              data-testid={`unfiled-item-${item.id}`}
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#5f574d] ring-1 ring-black/10">
                      {item.source_type}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-evergreen ring-1 ring-black/10">
                      {formatConfidence(item.parse_confidence)}
                    </span>
                    <span className="text-xs font-bold text-[#6f675c]">{item.parse_status}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black">{item.title || "Untitled import"}</h3>
                  <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                    {item.location || "Location pending"}
                  </p>
                  <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                    {item.date_time ? formatImportDate(item.date_time) : "Date and time pending"}
                  </p>
                  {item.source_label ? (
                    <p className="mt-2 text-xs font-bold text-[#6f675c]">{item.source_label}</p>
                  ) : null}
                </div>
                <TripButton
                  disabled={!selectedTrip || !item.title || !item.date_time}
                  onClick={() => onPromoteItem(item)}
                  variant="primaryCompact"
                >
                  Promote to {selectedTrip?.name || "trip"}
                </TripButton>
              </div>
            </article>
          ))
        )}
      </div>
    </TripCard>
  );
}

type TripListProps = {
  trips: Trip[];
  selectedTripId: string | null;
  onRefresh: () => void;
  onSelectTrip: (tripId: string) => void;
  loading?: boolean;
  stateMessage?: string;
  onShareTrip: (trip: Trip) => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
};

type TripListTab = "upcoming" | "past" | "unfiled" | "other";

const tripListTabs: Array<{ id: TripListTab; label: string }> = [
  { id: "upcoming", label: "Your Upcoming Trips" },
  { id: "past", label: "Past Trips" },
  { id: "unfiled", label: "Unfiled Items" },
  { id: "other", label: "Others' Trips" }
];

function TripList({
  loading,
  trips,
  selectedTripId,
  stateMessage = "Loading trips...",
  onRefresh,
  onSelectTrip,
  onShareTrip,
  onEditTrip,
  onDeleteTrip
}: TripListProps) {
  const [activeTab, setActiveTab] = useState<TripListTab>("upcoming");
  const visibleTrips = useMemo(() => {
    if (activeTab === "past") {
      return trips.filter((trip) => trip.status === "Completed");
    }

    if (activeTab === "unfiled") {
      return trips.filter((trip) => normalizeTimelineItems(trip.itinerary).length === 0);
    }

    if (activeTab === "other") {
      return [];
    }

    return trips.filter((trip) => trip.status !== "Completed");
  }, [activeTab, trips]);
  const emptyTabMessage =
    activeTab === "other"
      ? "Trips shared by other travelers will appear here."
      : activeTab === "unfiled"
        ? "Trips without saved itinerary items will appear here."
        : stateMessage;

  return (
    <TripCard className="p-5" data-testid="trip-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <TripEyebrow>Live itinerary records</TripEyebrow>
          <h2 className="mt-2 text-2xl font-black">Trips</h2>
        </div>
        <TripButton onClick={onRefresh}>Refresh</TripButton>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-black/10" role="tablist" aria-label="Trip views">
        {tripListTabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              aria-selected={selected ? true : undefined}
              className={`shrink-0 border-b-2 px-3 pb-3 text-sm font-black transition ${
                selected
                  ? "border-brand text-brand"
                  : "border-transparent text-[#6f675c] hover:text-ink"
              }`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className={`mt-6 rounded-2xl bg-[#f7f6f2] p-4 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
          {stateMessage}
        </p>
      ) : visibleTrips.length === 0 ? (
        <p className={`mt-6 rounded-2xl bg-[#f7f6f2] p-4 text-sm leading-6 ${tripUi.text.bodyMuted}`}>
          {emptyTabMessage}
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {visibleTrips.map((trip) => {
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
                  <Link
                    className={tripUi.button.secondary}
                    href={`/trip/${trip.slug || trip.id}`}
                  >
                    Open
                  </Link>
                  <TripButton onClick={() => onShareTrip(trip)} variant="primaryCompact">
                    Share Trip
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

type SelectedTripPreviewProps = {
  addButtonRef: RefObject<HTMLButtonElement | null>;
  trip: Trip | null;
  timelineItems: DashboardTimelineItem[];
  isReordering?: boolean;
  loading?: boolean;
  printMode?: boolean;
  stateMessage?: string;
  onAnnounce: (message: string) => void;
  onBackToTrips: () => void;
  onEditTrip: (trip: Trip) => void;
  onReorderTimeline: (tripId: string, orderedItemIds: string[]) => Promise<void>;
  onRefreshFlightStatuses: (tripId: string, items: DashboardTimelineItem[]) => Promise<void>;
  onSaveSegment: (input: SaveSegmentInput) => Promise<void>;
  onShareTrip: (trip: Trip) => void;
};

function SelectedTripPreview({
  addButtonRef,
  trip,
  timelineItems,
  isReordering = false,
  loading = false,
  printMode = false,
  stateMessage = "Select a trip to view details.",
  onAnnounce,
  onBackToTrips,
  onEditTrip,
  onReorderTimeline,
  onRefreshFlightStatuses,
  onSaveSegment,
  onShareTrip
}: SelectedTripPreviewProps) {
  const [activeTab, setActiveTab] = useState<SelectedTripTab>("timeline");
  const [selectedMapItemId, setSelectedMapItemId] = useState<string | null>(null);

  if (loading || !trip) {
    return (
      <TripCard
        className="grid min-h-[420px] place-items-center p-8 text-center"
        data-testid="trip-preview"
      >
        <div>
          <TripEyebrow>Selected itinerary</TripEyebrow>
          <h2 className="mt-2 text-2xl font-black">
            {loading ? "Loading trip preview" : "Choose a trip to preview"}
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm leading-6 ${tripUi.text.bodyMuted}`}>
            {stateMessage}
          </p>
        </div>
      </TripCard>
    );
  }

  return (
    <TripCard
      aria-live="polite"
      as="section"
      className="p-5"
      data-testid="trip-preview"
    >
      <button
        className="mb-5 inline-flex items-center gap-2 text-sm font-black text-brand hover:underline"
        onClick={onBackToTrips}
        type="button"
      >
        Back to Trips
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black">{trip.name}</h2>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">
              {trip.status === "Completed" ? "Archived" : "All Clear"}
            </span>
          </div>
          <p className="mt-3 text-lg font-semibold text-ink">{trip.destination}</p>
          <p className={`mt-2 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
            {formatDates(trip)}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <TripButton onClick={() => onShareTrip(trip)} variant="primaryCompact">
              Manage Sharing
            </TripButton>
            <TripButton onClick={() => onEditTrip(trip)} variant="secondary">
              Edit Trip Info
            </TripButton>
            <TripButton onClick={() => onAnnounce("More trip options are coming soon.")} variant="secondary">
              More Options
            </TripButton>
            {printMode ? null : (
              <>
                <TripButton
                  data-testid="print-itinerary"
                  onClick={() => window.print()}
                  variant="secondary"
                >
                  Print itinerary
                </TripButton>
                <TripButton
                  data-testid="export-pdf"
                  onClick={() => window.print()}
                  variant="secondary"
                >
                  Export PDF
                </TripButton>
              </>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#dfe9ed]">
          <img
            alt=""
            className="h-48 w-full object-cover"
            src={coverImageForDestination(trip.destination)}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-black/10" role="tablist" aria-label="Selected trip views">
        {selectedTripTabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              aria-controls={`trip-tabpanel-${tab.id}`}
              aria-selected={selected ? "true" : "false"}
              className={`shrink-0 border-b-2 px-3 pb-3 text-sm font-black transition ${
                selected
                  ? "border-brand text-brand"
                  : "border-transparent text-[#6f675c] hover:text-ink"
              }`}
              data-testid={`trip-${tab.id}-tab`}
              id={`trip-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                  return;
                }

                event.preventDefault();
                const index = selectedTripTabs.findIndex((currentTab) => currentTab.id === activeTab);
                const delta = event.key === "ArrowRight" ? 1 : -1;
                const next = selectedTripTabs[(index + delta + selectedTripTabs.length) % selectedTripTabs.length];
                setActiveTab(next.id);
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <section
          aria-labelledby="trip-tab-overview"
          className="mt-5"
          id="trip-tabpanel-overview"
          role="tabpanel"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Detail label="Dates" value={formatDates(trip)} />
            <Detail label="Budget" value={formatMoney(trip.budget)} />
            <Detail label="Route" value={trip.route || "Route pending"} />
          </dl>

          {printMode ? null : (
            <div className="mt-5 flex flex-wrap gap-2">
              <TripButton
                data-testid="print-itinerary"
                onClick={() => window.print()}
                variant="primaryCompact"
              >
                Print itinerary
              </TripButton>
              <TripButton
                data-testid="export-pdf"
                onClick={() => window.print()}
                variant="secondary"
              >
                Export PDF
              </TripButton>
            </div>
          )}

          {trip.notes ? (
            <p className={`mt-5 rounded-2xl bg-[#f7f6f2] p-4 text-sm leading-6 ${tripUi.text.bodyMuted}`}>
              {trip.notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {activeTab === "timeline" ? (
        <section
          aria-labelledby="trip-tab-timeline"
          id="trip-tabpanel-timeline"
          role="tabpanel"
        >
          <TimelinePanel
            addButtonRef={addButtonRef}
            isReordering={isReordering}
            onAnnounce={onAnnounce}
            onRefreshFlightStatuses={onRefreshFlightStatuses}
            onReorderTimeline={onReorderTimeline}
            onSaveSegment={onSaveSegment}
            trip={trip}
            timelineItems={timelineItems}
          />
        </section>
      ) : null}

      {activeTab === "map" ? (
        <TripMapTab
          ariaLabelledBy="trip-tab-map"
          items={timelineItems}
          selectedId={selectedMapItemId}
          onSelect={setSelectedMapItemId}
          onOpenDetails={(id) => {
            setSelectedMapItemId(id);
            setActiveTab("timeline");
          }}
          onOpenTransport={(id) => {
            const item = timelineItems.find((currentItem) => currentItem.id === id);
            if (item?.location) {
              window.open(directionsUrl(item.location), "_blank", "noopener,noreferrer");
            }
          }}
        />
      ) : null}
    </TripCard>
  );
}

type TimelinePanelProps = {
  addButtonRef: RefObject<HTMLButtonElement | null>;
  trip: Trip;
  timelineItems: DashboardTimelineItem[];
  isReordering?: boolean;
  onAnnounce: (message: string) => void;
  onRefreshFlightStatuses: (tripId: string, items: DashboardTimelineItem[]) => Promise<void>;
  onReorderTimeline: (tripId: string, orderedItemIds: string[]) => Promise<void>;
  onSaveSegment: (input: SaveSegmentInput) => Promise<void>;
};

function TimelinePanel({
  addButtonRef,
  trip,
  timelineItems,
  isReordering = false,
  onAnnounce,
  onRefreshFlightStatuses,
  onReorderTimeline,
  onSaveSegment
}: TimelinePanelProps) {
  const [activeTemplate, setActiveTemplate] = useState<SegmentTemplate | null>(null);
  const flightItems = timelineItems.filter(isFlightTimelineItem);

  return (
    <section
      aria-busy={isReordering ? true : undefined}
      className="mt-6 grid gap-4 border-t border-black/10 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">Timeline</h3>
          <p className={`text-sm ${tripUi.text.bodyMuted}`}>{trip.destination}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TripButton
            data-testid="add-hotel-segment"
            onClick={() => setActiveTemplate("hotel")}
            variant="secondary"
          >
            Add hotel
          </TripButton>
          <TripButton
            data-testid="add-meeting-segment"
            onClick={() => setActiveTemplate("meeting")}
            variant="secondary"
          >
            Add meeting
          </TripButton>
        </div>
      </div>

      <FlightTruthPanel
        flights={flightItems}
        tripId={trip.id}
        onRefreshFlightStatuses={
          flightItems.length
            ? () => onRefreshFlightStatuses(trip.id, flightItems)
            : undefined
        }
      />

      <div className="relative flex justify-center border-y border-black/10 bg-[#f7f6f2] py-4">
        <TripButton
          className="shadow-panel"
          data-testid="add-plan"
          onClick={() => setActiveTemplate("hotel")}
          ref={addButtonRef}
          variant="primaryCompact"
        >
          Add a Plan
        </TripButton>
      </div>

      {activeTemplate ? (
        <div data-testid="add-plan-form">
          <SegmentQuickForm
            defaultDate={trip.start_date ?? undefined}
            defaultLocation={trip.destination}
            onCancel={() => setActiveTemplate(null)}
            onSave={async (values) => {
              onAnnounce("Saving segment...");
              await onSaveSegment(values);
              setActiveTemplate(null);
              onAnnounce(`${activeTemplate === "hotel" ? "Hotel" : "Meeting"} saved successfully.`);
              requestAnimationFrame(() => addButtonRef.current?.focus());
            }}
            template={activeTemplate}
            tripId={trip.id}
          />
        </div>
      ) : null}

      {timelineItems.length === 0 ? (
        <div className={`rounded-2xl border border-dashed border-black/15 p-4 text-sm ${tripUi.text.bodyMuted}`}>
          No segments yet. Add a hotel or meeting to start the timeline.
        </div>
      ) : (
        <DraggableList
          items={timelineItems}
          onReorder={async (items) => {
            await onReorderTimeline(trip.id, items.map((item) => item.id));
          }}
        />
      )}
    </section>
  );
}

function normalizeTimelineItems(items: unknown[]): DashboardTimelineItem[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = readString(record.id);
      const title = readString(record.title) || readString(record.name);

      if (!id || !title) {
        return null;
      }

      const timelineItem: DashboardTimelineItem = {
        id,
        title,
        location: readString(record.location) || readString(record.address) || null,
        segment_type:
          readString(record.segment_type) ||
          readString(record.kind) ||
          readString(record.type) ||
          null,
        provider: readString(record.provider) || null,
        confirmation_code:
          readString(record.confirmation_code) ||
          readString(record.confirmation) ||
          null,
        date_time:
          readString(record.date_time) ||
          readString(record.start_time) ||
          readString(record.starttime) ||
          null,
        lat: readNumber(record.lat) ?? readNumber(record.latitude),
        lng:
          readNumber(record.lng) ??
          readNumber(record.lon) ??
          readNumber(record.longitude),
        flight_number: readString(record.flight_number) || null,
        airline: readString(record.airline) || null,
        departure_airport: readString(record.departure_airport) || null,
        arrival_airport: readString(record.arrival_airport) || null,
        scheduled_departure: readString(record.scheduled_departure) || null,
        estimated_departure: readString(record.estimated_departure) || null,
        gate: readString(record.gate) || null,
        terminal: readString(record.terminal) || null,
        flight_status: readString(record.flight_status) || null,
        last_status_checked_at: readString(record.last_status_checked_at) || null,
        flight_lat: readNumber(record.flight_lat),
        flight_lng: readNumber(record.flight_lng),
        flight_altitude: readNumber(record.flight_altitude),
        flight_bearing: readNumber(record.flight_bearing),
        flight_speed: readNumber(record.flight_speed),
        flight_position_updated_at: readString(record.flight_position_updated_at) || null,
        departure_airport_lat: readNumber(record.departure_airport_lat),
        departure_airport_lng: readNumber(record.departure_airport_lng),
        arrival_airport_lat: readNumber(record.arrival_airport_lat),
        arrival_airport_lng: readNumber(record.arrival_airport_lng),
        notes: readString(record.notes) || null,
        position: readNumber(record.position)
      };

      return timelineItem;
    })
    .filter(isDashboardTimelineItem)
    .sort((first, second) => {
      const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;
      const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;

      if (firstPosition !== secondPosition) {
        return firstPosition - secondPosition;
      }

      return (first.date_time || "").localeCompare(second.date_time || "");
    });
}

function isDashboardTimelineItem(
  item: DashboardTimelineItem | null | undefined
): item is DashboardTimelineItem {
  return Boolean(item);
}

function isFlightTimelineItem(item: DashboardTimelineItem) {
  const segmentType = item.segment_type?.toLowerCase() ?? "";

  return Boolean(
    item.flight_number ||
      item.flight_status ||
      item.gate ||
      segmentType.includes("air") ||
      segmentType.includes("flight")
  );
}

function replaceItineraryItems(
  itinerary: unknown[],
  updatedItems: Array<Record<string, unknown>>
) {
  const byId = new Map(updatedItems.map((item) => [readString(item.id), item]));

  return (Array.isArray(itinerary) ? itinerary : []).map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const record = item as Record<string, unknown>;
    const updatedItem = byId.get(readString(record.id));

    return updatedItem ? { ...record, ...updatedItem } : item;
  });
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <TripCard className="p-3" variant="nested">
      <dt className={tripUi.text.eyebrow}>{label}</dt>
      <dd className="mt-1 font-bold text-ink">{value}</dd>
    </TripCard>
  );
}

function formatDates(trip: Trip) {
  if (!trip.start_date && !trip.end_date) {
    return "Dates pending";
  }

  return [trip.start_date, trip.end_date].filter(Boolean).join(" to ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatConfidence(value: number | null) {
  if (typeof value !== "number") {
    return "Needs review";
  }

  return `${Math.round(value * 100)}% confidence`;
}

function mergeImportSources(sources: ImportSource[]) {
  const byType = new Map(
    sources.map((source) => [
      source.source_type === "email" ? "email_forwarding" : source.source_type,
      source
    ])
  );

  return defaultImportSources.map((fallback) => {
    const source = byType.get(fallback.source_type);

    return source
      ? {
          ...fallback,
          ...source,
          source_type: fallback.source_type
        }
      : fallback;
  });
}

function formatSourceType(value: string) {
  if (value === "calendar") {
    return "Calendar Sync";
  }

  if (value === "email" || value === "email_forwarding") {
    return "Email Forwarding";
  }

  if (value === "gmail") {
    return "Gmail Sync";
  }

  if (value === "outlook") {
    return "Outlook Sync";
  }

  return value;
}

function descriptionForSource(value: string) {
  if (value === "calendar") {
    return "Sync canonical itinerary plans into calendar apps once trips are stable.";
  }

  if (value === "gmail") {
    return "Scan connected Gmail confirmations and place uncertain matches in Unfiled Items.";
  }

  if (value === "outlook") {
    return "Scan connected Outlook confirmations and place uncertain matches in Unfiled Items.";
  }

  return "Forward confirmations into Wayline so bookings can become itinerary plans.";
}

function connectLabelForSource(value: string) {
  if (value === "calendar") return "Enable Calendar Feed";
  if (value === "gmail") return "Connect Gmail";
  if (value === "outlook") return "Connect Outlook";
  return "Set Up Forwarding";
}

function formatImportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function coverImageForDestination(destination?: string | null) {
  const normalized = destination?.toLowerCase() ?? "";

  if (normalized.includes("miami")) {
    return "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?auto=format&fit=crop&w=900&q=80";
  }

  if (normalized.includes("venice")) {
    return "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=900&q=80";
  }

  if (normalized.includes("new york") || normalized.includes("nyc")) {
    return "https://images.unsplash.com/photo-1534270804882-6b5048b1c1fc?auto=format&fit=crop&w=900&q=80";
  }

  if (normalized.includes("tokyo")) {
    return "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=80";
  }

  return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";
}
