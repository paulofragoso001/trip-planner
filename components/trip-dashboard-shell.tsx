"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardPanelErrorListener } from "@/components/dashboard-panel-error-listener";
import {
  DashboardMetricsPanel,
  SelectedTripPanel,
  TripEditorPanel,
  TripListPanel,
  type TripFormState
} from "@/components/trip-dashboard-panels";
import type { Trip } from "@/lib/trips";

type TripDashboardShellProps = {
  userEmail: string;
};

const emptyForm: TripFormState = {
  budget: "",
  destination: "",
  end_date: "",
  name: "",
  notes: "",
  route: "",
  start_date: "",
  status: "Planning"
};

export function TripDashboardShell({ userEmail }: TripDashboardShellProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState<TripFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stateMessage, setStateMessage] = useState("Loading trips...");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips]
  );

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    setLoading(true);
    setStateMessage("Loading trips...");
    setError("");

    try {
      const response = await fetch("/api/trips", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load trips.");
      }

      const nextTrips = Array.isArray(payload.trips) ? payload.trips : [];
      setTrips(nextTrips);
      setSelectedTripId((current) =>
        current && nextTrips.some((trip: Trip) => trip.id === current)
          ? current
          : nextTrips[0]?.id ?? null
      );
      setStateMessage(
        nextTrips.length
          ? "Select a trip to view details."
          : "No trips saved yet. Create the first one to test the dashboard shell."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load trips.";
      setError(message);
      setStateMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof TripFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editTrip(trip: Trip) {
    setSelectedTripId(trip.id);
    setEditingId(trip.id);
    setForm({
      budget: String(trip.budget || ""),
      destination: trip.destination,
      end_date: trip.end_date || "",
      name: trip.name,
      notes: trip.notes || "",
      route: trip.route || "",
      start_date: trip.start_date || "",
      status: trip.status
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

    try {
      const response = await fetch(editingId ? `/api/trips/${editingId}` : "/api/trips", {
        body: JSON.stringify({
          ...form,
          budget: Number(form.budget || 0)
        }),
        headers: { "Content-Type": "application/json" },
        method: editingId ? "PATCH" : "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not save this trip.");
      }

      setTrips((current) =>
        editingId
          ? current.map((trip) => (trip.id === editingId ? payload.trip : trip))
          : [payload.trip, ...current]
      );
      setSelectedTripId(payload.trip.id);
      setStateMessage(`${payload.trip.name} selected.`);
      resetForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this trip.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrip(id: string) {
    const response = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not delete this trip.");
      return;
    }

    setTrips((current) => current.filter((trip) => trip.id !== id));
    if (editingId === id) resetForm();
    if (selectedTripId === id) {
      setSelectedTripId(null);
      setStateMessage("Select a trip to view details.");
    }
  }

  function selectTrip(tripId: string) {
    const trip = trips.find((item) => item.id === tripId);
    setSelectedTripId(tripId);
    setStateMessage(trip ? `${trip.name} selected.` : "Trip selected.");
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]" data-testid="dashboard-shell">
      <DashboardPanelErrorListener />

      <div
        aria-atomic="true"
        aria-live="assertive"
        className="sr-only"
        data-testid="dashboard-live-region"
      >
        {error || stateMessage}
      </div>

      <TripEditorPanel
        editingId={editingId}
        error={error}
        form={form}
        onCancel={resetForm}
        onSubmit={submitTrip}
        onUpdateField={updateField}
        saving={saving}
      />

      <section className="min-w-0">
        <DashboardMetricsPanel trips={trips} userEmail={userEmail} />

        <div className="mt-6 grid gap-5 min-[1180px]:grid-cols-[minmax(280px,360px)_1fr]">
          <TripListPanel
            loading={loading}
            onDeleteTrip={deleteTrip}
            onEditTrip={editTrip}
            onRefresh={loadTrips}
            onShareTrip={shareTrip}
            onSelectTrip={selectTrip}
            selectedTripId={selectedTripId}
            stateMessage={stateMessage}
            trips={trips}
          />
          <SelectedTripPanel
            onShareTrip={shareTrip}
            stateMessage={stateMessage}
            trip={selectedTrip}
          />
        </div>
      </section>
    </div>
  );

  async function shareTrip(trip: Trip) {
    setError("");

    try {
      const response = await fetch(`/api/trips/${trip.id}/share`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not create a share link.");
      }

      const sharedTrip = payload.trip as Trip;
      const shareUrl = `${window.location.origin}/trip/${sharedTrip.slug || sharedTrip.id}`;

      setTrips((currentTrips) =>
        currentTrips.map((currentTrip) =>
          currentTrip.id === trip.id ? sharedTrip : currentTrip
        )
      );
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setStateMessage(`Share link copied for ${sharedTrip.name}.`);
        } catch {
          setStateMessage(`Share link ready for ${sharedTrip.name}: ${shareUrl}`);
        }
      } else {
        setStateMessage(`Share link ready for ${sharedTrip.name}: ${shareUrl}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create a share link.");
    }
  }
}
