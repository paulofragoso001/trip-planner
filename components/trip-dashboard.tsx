"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ItineraryMap } from "@/components/itinerary-map";
import { ItineraryTimeline } from "@/components/itinerary-timeline";
import type { Trip } from "@/lib/trips";

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

export function TripDashboard({ userEmail }: TripDashboardProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upcomingTrips = useMemo(
    () => trips.filter((trip) => trip.status !== "Completed").length,
    [trips]
  );

  async function loadTrips() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/trips", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not load trips.");
      setLoading(false);
      return;
    }

    setTrips(payload.trips || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTrips();
  }, []);

  function updateField(field: keyof TripForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editTrip(trip: Trip) {
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
    } else {
      setTrips((current) => [payload.trip, ...current]);
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

    await navigator.clipboard.writeText(shareUrl);
    alert("Link copied!");
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
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
            <input
              required
              value={form.destination}
              onChange={(event) => updateField("destination", event.target.value)}
              placeholder="Tokyo, Japan"
            />
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

          <button
            className="rounded-lg bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : editingId ? "Update trip" : "Create trip"}
          </button>
        </form>
      </section>

      <section className="min-w-0">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Traveler" value={userEmail || "Signed in"} />
          <Metric label="Trips saved" value={String(trips.length)} />
          <Metric label="Active plans" value={String(upcomingTrips)} />
        </div>

        <div className="mt-6 rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Live itinerary records
              </p>
              <h2 className="mt-2 text-2xl font-black">Trips</h2>
            </div>
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink transition hover:bg-slate-50"
              type="button"
              onClick={loadTrips}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Loading trips from Supabase...
            </p>
          ) : trips.length === 0 ? (
            <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              No trips saved yet. Create the first one to test the database,
              protected API routes, and responsive dashboard flow.
            </p>
          ) : (
            <div className="mt-6 grid gap-4">
              {trips.map((trip) => (
                <article
                  key={trip.id}
                  className="rounded-lg border border-line bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{trip.name}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-evergreen ring-1 ring-line">
                          {trip.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        {trip.destination}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold transition hover:bg-slate-100"
                        href={`/trip/${trip.slug || trip.id}`}
                      >
                        Open
                      </Link>
                      <button
                        className="rounded-lg bg-black px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                        type="button"
                        onClick={() => shareTrip(trip)}
                      >
                        Share Trip
                      </button>
                      <button
                        className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold transition hover:bg-slate-100"
                        type="button"
                        onClick={() => editTrip(trip)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
                        type="button"
                        onClick={() => deleteTrip(trip.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <Detail label="Dates" value={formatDates(trip)} />
                    <Detail label="Budget" value={formatMoney(trip.budget)} />
                    <Detail label="Route" value={trip.route || "Route pending"} />
                  </dl>

                  {trip.notes ? (
                    <p className="mt-4 text-sm leading-6 text-slate-600">{trip.notes}</p>
                  ) : null}

                  <ItineraryTimeline items={trip.itinerary} />
                  <ItineraryMap items={trip.itinerary} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-line">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-ink">{value}</dd>
    </div>
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
