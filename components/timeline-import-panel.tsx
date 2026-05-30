"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import DraggableList, { type DashboardTimelineItem } from "@/components/DraggableList";
import { FlightPanelLoader } from "@/components/flight-panel-loader";
import { MapPanelLoader } from "@/components/map-panel-loader";
import { PanelErrorBoundary } from "@/components/panel-error-boundary";
import { TripButton, TripCard, TripEyebrow, tripUi } from "@/components/trip-ui";
import {
  getApiErrorMessage,
  readApiField,
  readLegacyArrayOrField
} from "@/lib/api/client";
import type { Trip } from "@/lib/trips";

type TimelineImportPanelProps = {
  trip: Trip;
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

const defaultImportSources: ImportSource[] = [
  {
    connected: false,
    last_error: null,
    last_synced_at: null,
    source_label: "Forwarded email",
    source_type: "email_forwarding"
  },
  {
    connected: false,
    last_error: null,
    last_synced_at: null,
    source_label: "Gmail inbox sync",
    source_type: "gmail"
  },
  {
    connected: false,
    last_error: null,
    last_synced_at: null,
    source_label: "Outlook inbox sync",
    source_type: "outlook"
  },
  {
    connected: false,
    last_error: null,
    last_synced_at: null,
    source_label: "Calendar feed",
    source_type: "calendar"
  }
];

export function TimelineImportPanel({ trip }: TimelineImportPanelProps) {
  const [timelineItems, setTimelineItems] = useState<DashboardTimelineItem[]>(() =>
    normalizeTimelineItems(trip.itinerary)
  );
  const [unfiledItems, setUnfiledItems] = useState<UnfiledItem[]>([]);
  const [importSources, setImportSources] = useState<ImportSource[]>(defaultImportSources);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingImports, setLoadingImports] = useState(false);
  const [refreshingFlights, setRefreshingFlights] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [sourceType, setSourceType] = useState("email");
  const [sourceLabel, setSourceLabel] = useState("");
  const [rawText, setRawText] = useState("");
  const [message, setMessage] = useState("Itinerary ready.");
  const [error, setError] = useState("");
  const [selectedMapItemId, setSelectedMapItemId] = useState<string | null>(null);

  const activeUnfiledItems = useMemo(
    () => unfiledItems.filter((item) => item.parse_status !== "promoted"),
    [unfiledItems]
  );
  const flightItems = useMemo(
    () => timelineItems.filter(isFlightTimelineItem),
    [timelineItems]
  );

  useEffect(() => {
    setTimelineItems(normalizeTimelineItems(trip.itinerary));
    setSelectedMapItemId(null);
    void loadTimeline();
    void loadImports();
  }, [trip.id]);

  async function loadTimeline() {
    setLoadingTimeline(true);
    setError("");

    try {
      const response = await fetch(`/api/itinerary?tripId=${encodeURIComponent(trip.id)}`, {
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not load itinerary timeline."));
      }

      const nextItems = normalizeTimelineItems(
        readLegacyArrayOrField<Record<string, unknown>>(payload, "itinerary", [])
      );
      setTimelineItems(nextItems);
      setSelectedMapItemId((current) =>
        current && nextItems.some((item) => item.id === current)
          ? current
          : null
      );
      setMessage("Itinerary refreshed.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load itinerary timeline.");
    } finally {
      setLoadingTimeline(false);
    }
  }

  async function loadImports() {
    setLoadingImports(true);
    setError("");

    try {
      const [unfiledResponse, sourcesResponse] = await Promise.all([
        fetch(`/api/unfiled-items?tripId=${encodeURIComponent(trip.id)}`, {
          cache: "no-store"
        }),
        fetch("/api/import-sources", { cache: "no-store" })
      ]);
      const unfiledPayload = await unfiledResponse.json();
      const sourcesPayload = await sourcesResponse.json();

      if (!unfiledResponse.ok) {
        throw new Error(getApiErrorMessage(unfiledPayload, "Could not load unfiled items."));
      }

      setUnfiledItems(readApiField<UnfiledItem[]>(unfiledPayload, "items", []));

      if (sourcesResponse.ok) {
        setImportSources(
          mergeImportSources(
            readApiField<ImportSource[]>(sourcesPayload, "sources", defaultImportSources)
          )
        );
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load import queue.");
    } finally {
      setLoadingImports(false);
    }
  }

  async function reorderTimeline(items: DashboardTimelineItem[]) {
    const previousItems = timelineItems;
    setTimelineItems(items);

    try {
      const response = await fetch("/api/itinerary/reorder", {
        body: JSON.stringify({
          orderedItemIds: items.map((item) => item.id),
          tripId: trip.id
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Failed to reorder itinerary: ${response.status}`);
      }

      setMessage("Itinerary order updated.");
    } catch (error) {
      setTimelineItems(previousItems);
      setError(error instanceof Error ? error.message : "Could not update itinerary order.");
      throw error;
    }
  }

  async function updateImportSource(source: ImportSource) {
    const connected = !source.connected;
    const previousSources = importSources;
    setImportSources((current) =>
      mergeImportSources(
        current.map((item) =>
          item.source_type === source.source_type ? { ...item, connected } : item
        )
      )
    );

    try {
      const response = await fetch("/api/import-sources", {
        body: JSON.stringify({
          connected,
          sourceLabel: source.source_label,
          sourceType: source.source_type
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not update import source."));
      }

      setImportSources((current) =>
        mergeImportSources([...current, readApiField<ImportSource>(payload, "source", source)])
      );
      setMessage(`${source.source_label || formatSourceType(source.source_type)} updated.`);
    } catch (error) {
      setImportSources(previousSources);
      setError(error instanceof Error ? error.message : "Could not update import source.");
    }
  }

  async function refreshFlightStatuses() {
    if (!flightItems.length) {
      setMessage("No flights to refresh.");
      return;
    }

    setRefreshingFlights(true);
    setError("");

    try {
      const results = await Promise.all(
        flightItems.map(async (item) => {
          const response = await fetch("/api/itinerary/flight-status", {
            body: JSON.stringify({
              airline: item.airline || item.provider || null,
              arrivalAirport: item.arrival_airport || null,
              departureAirport: item.departure_airport || null,
              estimatedDeparture: item.estimated_departure || item.date_time || null,
              flightNumber: item.flight_number || item.confirmation_code || null,
              gate: item.gate || null,
              itemId: item.id,
              scheduledDeparture: item.scheduled_departure || item.date_time || null,
              status: item.flight_status || "scheduled",
              terminal: item.terminal || null,
              tripId: trip.id
            }),
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            method: "POST"
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

      setTimelineItems((current) =>
        replaceTimelineItems(
          current,
          results.map((result) => result.item)
        )
      );
      setMessage(results.find((result) => result.alert)?.alert || "Flight statuses updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not refresh flight status.");
    } finally {
      setRefreshingFlights(false);
    }
  }

  async function createUnfiledItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingImport(true);
    setError("");

    try {
      const response = await fetch("/api/unfiled-items", {
        body: JSON.stringify({
          rawText,
          sourceLabel,
          sourceType,
          tripId: trip.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Could not add unfiled item."));
      }

      setUnfiledItems((current) => [
        readApiField<UnfiledItem>(payload, "item", {} as UnfiledItem),
        ...current
      ]);
      setSourceLabel("");
      setRawText("");
      setMessage("Imported item added to Unfiled Items.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add unfiled item.");
    } finally {
      setSavingImport(false);
    }
  }

  async function promoteUnfiledItem(item: UnfiledItem) {
    if (!item.title || !item.date_time) return;
    setError("");

    try {
      const createResponse = await fetch("/api/itinerary", {
        body: JSON.stringify({
          date_time: item.date_time,
          location: item.location,
          notes: item.notes,
          segment_type: item.segment_type || "activity",
          title: item.title,
          tripId: trip.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const itineraryItem = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(getApiErrorMessage(itineraryItem, "Could not promote unfiled item."));
      }
      const promotedItem = readApiField<Record<string, unknown>>(
        itineraryItem,
        "item",
        itineraryItem
      );

      const updateResponse = await fetch(`/api/unfiled-items/${item.id}`, {
        body: JSON.stringify({
          parseStatus: "promoted",
          promotedTripSegmentId:
            typeof promotedItem.id === "string" ? promotedItem.id : undefined,
          tripId: trip.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const updatePayload = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(getApiErrorMessage(updatePayload, "Could not mark item promoted."));
      }
      const updatedItem = readApiField<UnfiledItem>(updatePayload, "item", item);

      setTimelineItems((current) => normalizeTimelineItems([...current, promotedItem]));
      setUnfiledItems((current) =>
        current.map((currentItem) => (currentItem.id === item.id ? updatedItem : currentItem))
      );
      setMessage(`${item.title} promoted to the itinerary.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not promote unfiled item.");
    }
  }

  return (
    <div className="mt-6 grid gap-5" data-testid="timeline-import-panel">
      <TripCard as="section" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <TripEyebrow>Itinerary</TripEyebrow>
            <h3 className="mt-2 text-2xl font-black">Itinerary sequence</h3>
            <p className={`mt-2 text-sm ${tripUi.text.bodyMuted}`}>{trip.destination}</p>
          </div>
          <TripButton disabled={loadingTimeline} onClick={loadTimeline}>
            {loadingTimeline ? "Refreshing..." : "Refresh itinerary"}
          </TripButton>
        </div>

        {timelineItems.length === 0 ? (
          <div className={`mt-5 rounded-2xl border border-dashed border-black/15 p-4 text-sm ${tripUi.text.bodyMuted}`}>
            No itinerary items yet. Import a confirmation below, then promote it into this trip.
          </div>
        ) : (
          <div className="mt-5">
            <DraggableList items={timelineItems} onReorder={reorderTimeline} />
          </div>
        )}

        <PanelErrorBoundary fallbackTitle="Flight status panel">
          <FlightPanelLoader
            flights={flightItems}
            onRefreshFlightStatuses={refreshFlightStatuses}
            refreshing={refreshingFlights}
          />
        </PanelErrorBoundary>

        <PanelErrorBoundary fallbackTitle="Trip map panel">
          <MapPanelLoader
            items={timelineItems}
            selectedId={selectedMapItemId}
            onSelect={setSelectedMapItemId}
          />
        </PanelErrorBoundary>
      </TripCard>

      <TripCard as="section" className="p-5" data-testid="unfiled-items">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <TripEyebrow>Import automation</TripEyebrow>
            <h3 className="mt-2 text-2xl font-black">Unfiled Items</h3>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${tripUi.text.bodyMuted}`}>
              Paste confirmation text here. Items stay in review until promoted into the itinerary.
            </p>
          </div>
          <span className="rounded-full bg-[#f7f6f2] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-evergreen ring-1 ring-black/10">
            {activeUnfiledItems.length} waiting
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2" data-testid="import-sources">
          {importSources.map((source) => (
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
                  <h4 className="mt-1 font-black">
                    {source.source_label || formatSourceType(source.source_type)}
                  </h4>
                </div>
                <span
                  className={
                    source.connected
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-evergreen"
                      : "rounded-full bg-white px-3 py-1 text-xs font-black text-[#6f675c] ring-1 ring-black/10"
                  }
                >
                  {source.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-[#6f675c]">
                {source.last_error
                  ? `Last error: ${source.last_error}`
                  : source.last_synced_at
                    ? `Last synced ${formatDate(source.last_synced_at)}`
                    : "No sync yet"}
              </p>
              <TripButton
                className="mt-4"
                disabled={loadingImports}
                onClick={() => updateImportSource(source)}
                variant={source.connected ? "secondary" : "primaryCompact"}
              >
                {source.connected ? "Disconnect" : "Connect"}
              </TripButton>
            </article>
          ))}
        </div>

        <form className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr]" onSubmit={createUnfiledItem}>
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
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="United confirmation, hotel PDF, receipt..."
              value={sourceLabel}
            />
          </label>
          <label className="lg:col-span-2">
            Confirmation text
            <textarea
              data-testid="import-raw-text"
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Paste confirmation text. Lines like Location: and 2026-06-01T14:00 help the parser."
              required
              rows={5}
              value={rawText}
            />
          </label>
          <div className="lg:col-span-2">
            <TripButton disabled={savingImport} type="submit" variant="primaryCompact">
              {savingImport ? "Importing..." : "Add to Unfiled Items"}
            </TripButton>
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          {loadingImports ? (
            <p className={`rounded-2xl bg-[#f7f6f2] p-4 text-sm font-semibold ${tripUi.text.bodyMuted}`}>
              Loading unfiled items...
            </p>
          ) : activeUnfiledItems.length === 0 ? (
            <p className={`rounded-2xl border border-dashed border-black/15 p-4 text-sm ${tripUi.text.bodyMuted}`}>
              No unfiled items yet.
            </p>
          ) : (
            activeUnfiledItems.map((item) => (
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
                      <span className="text-xs font-bold text-[#6f675c]">
                        {item.parse_status}
                      </span>
                    </div>
                    <h4 className="mt-3 text-lg font-black">{item.title || "Untitled import"}</h4>
                    <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                      {item.location || "Location pending"}
                    </p>
                    <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                      {item.date_time ? formatDate(item.date_time) : "Date and time pending"}
                    </p>
                  </div>
                  <TripButton
                    disabled={!item.title || !item.date_time}
                    onClick={() => promoteUnfiledItem(item)}
                    variant="primaryCompact"
                  >
                    Promote
                  </TripButton>
                </div>
              </article>
            ))
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : (
          <p className={`mt-4 text-xs font-bold ${tripUi.text.bodyMuted}`}>{message}</p>
        )}
      </TripCard>
    </div>
  );
}

function normalizeTimelineItems(items: unknown): DashboardTimelineItem[] {
  return (Array.isArray(items) ? items : [])
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];

      const record = item as Record<string, unknown>;
      const id = readString(record.id);
      const title = readString(record.title) || readString(record.name);

      if (!id || !title) return [];

      const timelineItem: DashboardTimelineItem = {
        airline: readString(record.airline) || null,
        arrival_airport: readString(record.arrival_airport) || null,
        arrival_airport_lat: readNumber(record.arrival_airport_lat),
        arrival_airport_lng: readNumber(record.arrival_airport_lng),
        confirmation_code:
          readString(record.confirmation_code) || readString(record.confirmation) || null,
        date_time:
          readString(record.date_time) ||
          readString(record.start_time) ||
          readString(record.starttime) ||
          null,
        departure_airport: readString(record.departure_airport) || null,
        departure_airport_lat: readNumber(record.departure_airport_lat),
        departure_airport_lng: readNumber(record.departure_airport_lng),
        estimated_departure: readString(record.estimated_departure) || null,
        flight_altitude: readNumber(record.flight_altitude),
        flight_bearing: readNumber(record.flight_bearing),
        flight_lat: readNumber(record.flight_lat),
        flight_lng: readNumber(record.flight_lng),
        flight_number: readString(record.flight_number) || null,
        flight_position_updated_at: readString(record.flight_position_updated_at) || null,
        flight_speed: readNumber(record.flight_speed),
        flight_status: readString(record.flight_status) || null,
        gate: readString(record.gate) || null,
        id,
        last_status_checked_at: readString(record.last_status_checked_at) || null,
        lat: readNumber(record.lat) ?? readNumber(record.latitude),
        lng: readNumber(record.lng) ?? readNumber(record.lon) ?? readNumber(record.longitude),
        location: readString(record.location) || readString(record.address) || null,
        notes: readString(record.notes) || null,
        position: readNumber(record.position),
        provider: readString(record.provider) || null,
        scheduled_departure: readString(record.scheduled_departure) || null,
        segment_type:
          readString(record.segment_type) ||
          readString(record.kind) ||
          readString(record.type) ||
          null,
        terminal: readString(record.terminal) || null,
        title
      };

      return [timelineItem];
    })
    .sort((first, second) => {
      const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;
      const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;

      if (firstPosition !== secondPosition) return firstPosition - secondPosition;

      return (first.date_time || "").localeCompare(second.date_time || "");
    });
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

    return source ? { ...fallback, ...source, source_type: fallback.source_type } : fallback;
  });
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

function replaceTimelineItems(
  currentItems: DashboardTimelineItem[],
  updatedItems: Array<Record<string, unknown>>
) {
  const byId = new Map(updatedItems.map((item) => [readString(item.id), item]));

  return normalizeTimelineItems(
    currentItems.map((item) => {
      const updatedItem = byId.get(item.id);

      return updatedItem ? { ...item, ...updatedItem } : item;
    })
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSourceType(value: string) {
  if (value === "calendar") return "Calendar Sync";
  if (value === "email" || value === "email_forwarding") return "Email Forwarding";
  if (value === "gmail") return "Gmail Sync";
  if (value === "outlook") return "Outlook Sync";

  return value;
}

function formatConfidence(value: number | null) {
  if (typeof value !== "number") return "Needs review";

  return `${Math.round(value * 100)}% confidence`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
