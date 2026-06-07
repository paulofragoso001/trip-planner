import { Mail, Share2, UserPlus, Users } from "lucide-react";
import { InviteCollaboratorForm } from "@/components/trip/invite-collaborator-form";
import type { TripSharingData } from "@/app/dashboard/trips/[tripId]/sharing/types";

type TripSharingPageProps = TripSharingData;

export default function TripSharingPage({ collaborators, error, tripId }: TripSharingPageProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Trip guests
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Share this trip</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
              Invite friends, family, or collaborators to view and help plan this itinerary.
            </p>
          </div>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white">
            <Users className="h-4 w-4" aria-hidden="true" />
            {collaborators.length} guest{collaborators.length === 1 ? "" : "s"}
          </span>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          {collaborators.length ? (
            collaborators.map((collaborator) => (
              <article
                className="grid gap-3 rounded-[1.35rem] bg-slate-50 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                key={collaborator.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-slate-950 text-sm font-black uppercase text-white">
                    {initialsFor(collaborator.name || collaborator.email || "Guest")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{collaborator.name || "Trip guest"}</p>
                    {collaborator.email ? (
                      <p className="truncate text-sm font-semibold text-slate-500">{collaborator.email}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                    {collaborator.role}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                    {collaborator.status}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-blue-700 shadow-sm">
                <UserPlus className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-black text-slate-950">No trip guests yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm font-semibold text-slate-600">
                Invite someone when you are ready to plan together or share the final trip.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-950">Invite guest</h3>
              <p className="text-sm font-semibold text-slate-500">Send access by email.</p>
            </div>
          </div>
          <InviteCollaboratorForm tripId={tripId} />
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-800">
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-950">Share link</h3>
              <p className="text-sm font-semibold text-slate-500">Private link sharing can be added later.</p>
            </div>
          </div>
          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-100 px-4 text-sm font-black text-slate-700 opacity-70"
            disabled
            type="button"
          >
            Link sharing coming soon
          </button>
        </section>
      </section>
    </div>
  );
}

function initialsFor(value: string) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("");
}
