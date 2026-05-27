import { InviteCollaboratorForm } from "@/components/trip/invite-collaborator-form";
import type { TripSharingData } from "@/app/dashboard/trips/[tripId]/sharing/types";

type TripSharingPageProps = TripSharingData;

export default function TripSharingPage({ collaborators, error, tripId }: TripSharingPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Sharing</h2>
        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3">
          {collaborators.length ? (
            collaborators.map((collaborator) => (
            <div
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              key={collaborator.id}
            >
              <div>
                <p className="font-medium">{collaborator.name}</p>
                {collaborator.email ? (
                  <p className="text-xs font-medium text-slate-500">{collaborator.email}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                  {collaborator.role}
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {collaborator.status}
                </span>
              </div>
            </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
              <p className="font-bold text-slate-950">No collaborators yet.</p>
              <p className="mt-1">Invite editors or viewers when the trip is ready to share.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Invite</h3>
        <InviteCollaboratorForm tripId={tripId} />
      </aside>
    </div>
  );
}
