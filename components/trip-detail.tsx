"use client";

import { useEffect, useMemo, useState } from "react";
import DraggableList from "@/components/DraggableList";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import TripMap, { type TripTravelMode } from "@/components/TripMap";
import { geocodeAddress } from "@/lib/geocode";
import { uploadImage } from "@/lib/upload-image";

type RawItem = {
  id: string;
  title: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  position: number | null;
  notes?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  date_time?: string | null;
};

type TripDetailProps = {
  tripId: string;
  initialItems?: RawItem[];
};

type StopForm = {
  location: string;
  lat: number | null;
  lng: number | null;
  date_time: string;
  notes: string;
  image_url: string;
};

const travelModes: Array<{ label: string; value: TripTravelMode }> = [
  { label: "Drive", value: "DRIVING" },
  { label: "Walk", value: "WALKING" },
  { label: "Bike", value: "BICYCLING" },
  { label: "Transit", value: "TRANSIT" }
];

export function TripDetail({ tripId, initialItems = [] }: TripDetailProps) {
  const [items, setItems] = useState<RawItem[]>(initialItems);
  const [form, setForm] = useState<StopForm>({
    location: "",
    lat: null,
    lng: null,
    date_time: "",
    notes: "",
    image_url: ""
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [travelMode, setTravelMode] = useState<TripTravelMode>("DRIVING");
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [savingPlace, setSavingPlace] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialItems.length > 0) {
      return;
    }

    async function loadItems() {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/itinerary?tripId=${tripId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load itinerary.");
        setLoading(false);
        return;
      }

      setItems(data);
      setLoading(false);
    }

    loadItems();
  }, [initialItems.length, tripId]);

  useEffect(() => {
    async function geocodeMissingLocations() {
      const needs = items.filter((item) => !hasCoordinates(item) && item.location);

      if (needs.length === 0) {
        return;
      }

      const updates = await Promise.all(
        needs.map(async (item) => {
          const location = await geocodeAddress(item.location!);
          return location ? { id: item.id, ...location } : null;
        })
      );
      const valid = updates.filter(Boolean) as Array<{
        id: string;
        lat: number;
        lng: number;
      }>;

      if (valid.length === 0) {
        return;
      }

      await fetch("/api/itinerary/bulk-latlng", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid)
      });

      setItems((currentItems) =>
        currentItems.map((item) => {
          const update = valid.find((currentUpdate) => currentUpdate.id === item.id);
          return update ? { ...item, lat: update.lat, lng: update.lng } : item;
        })
      );
    }

    geocodeMissingLocations();
  }, [items]);

  const grouped = useMemo(() => {
    const byDay: Record<string, RawItem[]> = {};
    const sortedItems = [...items].sort(
      (first, second) => (first.position ?? 0) - (second.position ?? 0)
    );

    sortedItems.forEach((item) => {
      const key = getItemDay(item);
      byDay[key] = byDay[key] || [];
      byDay[key].push(item);
    });

    return byDay;
  }, [items]);
  const dayOptions = useMemo(() => Object.keys(grouped), [grouped]);
  const dayItems = useMemo(
    () => {
      if (!selectedDay) {
        return [];
      }

      return grouped[selectedDay] || [];
    },
    [selectedDay, grouped]
  );
  const mapItems = useMemo(
    () =>
      dayItems.filter(hasCoordinates).map((item) => ({
        id: item.id,
        title: item.title,
        lat: item.lat,
        lng: item.lng
      })),
    [dayItems]
  );

  async function updateOrder(newItems: RawItem[]) {
    let persistedOrder: Array<{ id: string; position: number }> = [];

    setItems((currentItems) => {
      const reorderedIds = new Set(newItems.map((item) => item.id));
      const nextItems = currentItems.filter((item) => !reorderedIds.has(item.id));
      const insertAt = currentItems.findIndex((item) => item.id === newItems[0]?.id);

      if (insertAt === -1) {
        return currentItems;
      }

      nextItems.splice(insertAt, 0, ...newItems);
      const positionedItems = nextItems.map((item, index) => ({
        ...item,
        position: index
      }));
      persistedOrder = positionedItems.map((item) => ({
        id: item.id,
        position: item.position || 0
      }));

      return positionedItems;
    });

    await fetch("/api/itinerary/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persistedOrder)
    });
  }

  async function addPlace() {
    if (!form.location || typeof form.lat !== "number" || typeof form.lng !== "number") {
      setError("Choose a place from the Google suggestions before adding it.");
      return;
    }

    setSavingPlace(true);
    setError("");

    const response = await fetch(`/api/itinerary?tripId=${tripId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.location,
        location: form.location,
        lat: form.lat,
        lng: form.lng,
        date_time: form.date_time || null,
        notes: form.notes,
        image_url: form.image_url
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not add this place.");
      setSavingPlace(false);
      return;
    }

    setItems((currentItems) => [...currentItems, data]);
    setSelectedId(data.id);
    setForm({
      location: "",
      lat: null,
      lng: null,
      date_time: "",
      notes: "",
      image_url: ""
    });
    setSavingPlace(false);
  }

  async function handleImageUpload(file: File) {
    setSavingPlace(true);
    setError("");

    try {
      const imageUrl = await uploadImage(file);
      setForm((currentForm) => ({
        ...currentForm,
        image_url: imageUrl
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload image.");
    } finally {
      setSavingPlace(false);
    }
  }

  useEffect(() => {
    if (dayOptions.length && !selectedDay) {
      setSelectedDay(dayOptions[0]);
      return;
    }

    if (selectedDay && selectedDay !== "All days" && !dayOptions.includes(selectedDay)) {
      setSelectedDay(dayOptions[0] || "");
    }
  }, [dayOptions, selectedDay]);

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-5 text-sm font-bold text-slate-600">
        Loading itinerary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Google Places
            </p>
            <h2 className="mt-1 text-xl font-black">Add itinerary stop</h2>
          </div>
          <label>
            Location
            <LocationAutocomplete
              onSelect={(place) => {
                setForm((currentForm) => ({
                  ...currentForm,
                  location: place.address,
                  lat: place.lat,
                  lng: place.lng
                }));
              }}
            />
          </label>
          {form.location ? (
            <div className="mt-1 text-sm text-gray-500">Pin: {form.location}</div>
          ) : null}
          <label>
            Date and time
            <input
              type="datetime-local"
              value={form.date_time}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  date_time: event.target.value
                }))
              }
            />
          </label>
          <label>
            Notes
            <textarea
              className="w-full rounded-lg border border-line p-3"
              placeholder="Add notes (tips, reservations, reminders...)"
              value={form.notes}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  notes: event.target.value
                }))
              }
            />
          </label>
          <label>
            Image
            <input
              accept="image/*"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  handleImageUpload(file);
                }
              }}
            />
          </label>
          {form.image_url ? (
            <img
              alt="Uploaded trip stop"
              className="h-40 w-full rounded-lg object-cover"
              src={form.image_url}
            />
          ) : null}
          <button
            className="rounded-lg bg-brand px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!form.location || savingPlace}
            onClick={addPlace}
            type="button"
          >
            {savingPlace ? "Adding..." : "Add stop"}
          </button>
        </div>

        {dayOptions.length > 0 ? (
          <div className="grid gap-3 rounded-lg border border-line bg-white p-3">
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {dayOptions.map((day) => (
                <button
                  key={day}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    selectedDay === day
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedDay(day);
                    setSelectedId(null);
                  }}
                  type="button"
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {travelModes.map((mode) => (
                <button
                  key={mode.value}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    travelMode === mode.value
                      ? "bg-black text-white"
                      : "bg-white text-gray-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setTravelMode(mode.value)}
                  type="button"
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {Object.entries(grouped).length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-5 text-sm leading-6 text-slate-600">
            No itinerary items found for this trip yet.
          </div>
        ) : (
          Object.entries(grouped).map(([day, list]) => (
            <section key={day}>
              <button
                className={`mb-2 text-left font-black transition ${
                  selectedDay === day ? "text-brand" : "text-ink hover:text-brand"
                }`}
                onClick={() => {
                  setSelectedDay(day);
                  setSelectedId(null);
                }}
                type="button"
              >
                {day}
              </button>
              <DraggableList
                items={list}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={updateOrder}
              />
            </section>
          ))
        )}
      </div>

      <div className="h-fit lg:sticky lg:top-4">
        <TripMap
          items={mapItems}
          selectedId={selectedId}
          travelMode={travelMode}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}

function hasCoordinates(item: RawItem): item is RawItem & { lat: number; lng: number } {
  return typeof item.lat === "number" && typeof item.lng === "number";
}

function getItemDay(item: RawItem) {
  return item.date_time ? new Date(item.date_time).toDateString() : "No date";
}
