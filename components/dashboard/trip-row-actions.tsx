"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type TripRowActionsProps = {
  destination: string;
  endDate: string | null;
  id: string;
  name: string;
  startDate: string | null;
};

export function TripRowActions({
  destination,
  endDate,
  id,
  name,
  startDate
}: TripRowActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nextDestination, setNextDestination] = useState(destination);
  const [nextEndDate, setNextEndDate] = useState(endDate || "");
  const [nextName, setNextName] = useState(name);
  const [nextStartDate, setNextStartDate] = useState(startDate || "");
  const { isPending, run, state } = useWaylineAction();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await run({
      body: {
        destination: nextDestination,
        end_date: nextEndDate,
        name: nextName,
        start_date: nextStartDate
      },
      method: "PATCH",
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(id)}`
    });

    if (result.status === "success") {
      setEditing(false);
      router.refresh();
    }
  }

  async function deleteTrip() {
    const result = await run({
      method: "DELETE",
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(id)}`
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
          onClick={() => setEditing((current) => !current)}
          type="button"
        >
          {editing ? "Close edit" : "Edit"}
        </button>
        <button
          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"
          disabled={isPending}
          onClick={deleteTrip}
          type="button"
        >
          {isPending ? "Working..." : "Delete"}
        </button>
      </div>
      {editing ? (
        <form className="grid gap-2 rounded-2xl bg-slate-50 p-3" onSubmit={save}>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setNextName(event.target.value)}
            required
            value={nextName}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setNextDestination(event.target.value)}
            required
            value={nextDestination}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setNextStartDate(event.target.value)}
              type="date"
              value={nextStartDate}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setNextEndDate(event.target.value)}
              type="date"
              value={nextEndDate}
            />
          </div>
          <button
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
