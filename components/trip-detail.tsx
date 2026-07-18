"use client";

import { useEffect, useMemo, useState } from "react";
import DraggableList from "@/components/DraggableList";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { tripUi } from "@/components/trip-ui";
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
  segment_type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  booking_url?: string | null;
};

type TripDetailProps = {
  tripId: string;
  tripName?: string | null;
  tripDestination?: string | null;
  initialItems?: RawItem[];
};

type StopForm = {
  location: string;
  lat: number | null;
  lng: number | null;
  date_time: string;
  notes: string;
  image_url: string;
  segment_type: string;
  provider: string;
  confirmation_code: string;
  booking_url: string;
};

const segmentTypes = [
  { label: "Flight", value: "flight" },
  { label: "Hotel", value: "hotel" },
  { label: "Car", value: "car" },
  { label: "Restaurant", value: "restaurant" },
  { label: "Activity", value: "activity" },
  { label: "Transport", value: "transport" },
  { label: "Meeting", value: "meeting" },
  { label: "Note", value: "note" }
];

const tripDetailSurface = tripUi.card.surfaceSoft;
const tripDetailInset = tripUi.card.inset;
const tripDetailEyebrow = tripUi.text.eyebrow;
const tripDetailPrimaryButton = tripUi.button.primary;

export function TripDetail({
  tripId,
  tripName,
  tripDestination,
  initialItems = []
}: TripDetailProps) {
  const [items, setItems] = useState<RawItem[]>(initialItems);
  const [form, setForm] = useState<StopForm>({
    location: "",
    lat: null,
    lng: null,
    date_time: "",
    notes: "",
    image_url: "",
    segment_type: "activity",
    provider: "",
    confirmation_code: "",
    booking_url: ""
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
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
  const previewLabel = tripDestination?.trim() || tripName?.trim() || "Trip";
  const previewTitle = tripName?.trim()
    ? `${tripName.trim()} preview`
    : "Visual itinerary preview";

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
    if (!form.location.trim()) {
      setError("Add a location before saving this segment.");
      return;
    }

    setSavingPlace(true);
    setError("");

    const coordinates =
      typeof form.lat === "number" && typeof form.lng === "number"
        ? { lat: form.lat, lng: form.lng }
        : await geocodeAddress(form.location);

    if (!coordinates) {
      setError("Could not find coordinates for that location. Try a more specific address.");
      setSavingPlace(false);
      return;
    }

    const response = await fetch(`/api/itinerary?tripId=${tripId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.location,
        location: form.location,
        lat: coordinates.lat,
        lng: coordinates.lng,
        date_time: form.date_time || null,
        notes: form.notes,
        image_url: form.image_url,
        segment_type: form.segment_type,
        provider: form.provider,
        confirmation_code: form.confirmation_code,
        booking_url: form.booking_url
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
      image_url: "",
      segment_type: "activity",
      provider: "",
      confirmation_code: "",
      booking_url: ""
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
      <div className={`${tripDetailSurface} p-5 text-sm font-bold text-[#6f675c]`}>
        Loading itinerary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 min-[1180px]:grid-cols-[minmax(0,0.92fr)_minmax(300px,1fr)] min-[1440px]:gap-6 min-[1440px]:grid-cols-[minmax(0,680px)_minmax(360px,1fr)]">
      <div className="min-w-0 space-y-6">
        <div className={`grid min-w-0 gap-4 overflow-hidden p-4 ${tripDetailSurface}`}>
          <div>
            <p className={tripDetailEyebrow}>
              Itinerary builder
            </p>
            <h2 className="mt-1 text-xl font-black">Add itinerary segment</h2>
          </div>
          <div>
            <p className={`mb-2 ${tripDetailEyebrow}`}>
              Segment type
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {segmentTypes.map((type) => (
                <button
                  key={type.value}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-bold transition ${
                    form.segment_type === type.value
                      ? "border-brand bg-brand text-white"
                      : "border-black/10 bg-white text-[#6f675c] hover:bg-[#faf8f5]"
                  }`}
                  onClick={() =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      segment_type: type.value
                    }))
                  }
                  type="button"
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            Location
            <LocationAutocomplete
              value={form.location}
              placeholder="Search for a place, hotel, restaurant, airport..."
              onInputChange={(value) => {
                setForm((currentForm) => ({
                  ...currentForm,
                  location: value,
                  lat: value === currentForm.location ? currentForm.lat : null,
                  lng: value === currentForm.location ? currentForm.lng : null
                }));
              }}
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
            <div className="mt-1 rounded-2xl bg-[#f7f6f2] px-3 py-2 text-sm font-semibold text-[#6f675c]">
              Selected place: {form.location}
            </div>
          ) : null}
          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label>
              Provider
              <input
                placeholder="Delta, Hilton, Hertz..."
                value={form.provider}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    provider: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Confirmation
              <input
                placeholder="ABC123"
                value={form.confirmation_code}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    confirmation_code: event.target.value
                  }))
                }
              />
            </label>
          </div>
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
            Booking link
            <input
              placeholder="https://airline.com/trips/..."
              type="url"
              value={form.booking_url}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  booking_url: event.target.value
                }))
              }
            />
          </label>
          <label>
            Notes
            <textarea
              className="w-full rounded-2xl border border-black/10 p-3"
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
              className="h-40 w-full rounded-2xl object-cover"
              src={form.image_url}
            />
          ) : null}
          <button
            className={tripDetailPrimaryButton}
            disabled={!form.location || savingPlace}
            onClick={addPlace}
            type="button"
          >
            {savingPlace ? "Adding..." : "Add segment"}
          </button>
        </div>

        {dayOptions.length > 0 ? (
          <div className={`grid min-w-0 gap-3 overflow-hidden p-3 ${tripDetailSurface}`}>
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {dayOptions.map((day) => (
                <button
                  key={day}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    selectedDay === day
                      ? "bg-brand text-white"
                      : "bg-[#f7f6f2] text-[#6f675c] hover:bg-[#f1ede7]"
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
          </div>
        ) : null}

        {Object.entries(grouped).length === 0 ? (
          <div className={`${tripDetailSurface} p-5 text-sm leading-6 text-[#6f675c]`}>
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

      <div className="min-w-0 min-[1180px]:sticky min-[1180px]:top-4">
        <section className={`overflow-hidden ${tripDetailSurface}`}>
          <img
            alt={`${previewLabel} itinerary illustration`}
            className="aspect-[4/3] w-full object-cover"
            src="/itinerary-preview.svg"
          />
          <div className="space-y-3 p-5">
            <p className={tripDetailEyebrow}>
              {previewLabel} trip section
            </p>
            <h2 className="text-xl font-black text-ink sm:text-2xl">
              {previewTitle}
            </h2>
            <p className="text-sm leading-6 text-[#6f675c]">
              A presentation-ready route card for this trip plan. Use the left
              panel to add flights, hotels, restaurants, transport, and notes.
            </p>
            <div className="grid grid-cols-1 gap-2 text-center text-xs font-bold text-[#6f675c] sm:grid-cols-3">
              <div className={`${tripDetailInset} p-3`}>
                <span className="block text-lg text-ink">{items.length}</span>
                Segments
              </div>
              <div className={`${tripDetailInset} p-3`}>
                <span className="block text-lg text-ink">{dayOptions.length}</span>
                Days
              </div>
              <div className={`${tripDetailInset} p-3`}>
                <span className="block text-lg text-ink">
                  {dayItems.filter(hasCoordinates).length}
                </span>
                Places
              </div>
            </div>
          </div>
        </section>
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
