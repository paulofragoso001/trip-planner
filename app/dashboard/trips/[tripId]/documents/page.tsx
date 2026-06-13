import Link from "next/link";
import { FileImage, FileText, Link as LinkIcon, Mail, MoreHorizontal, Plus, X } from "lucide-react";
import { loadTripWorkspaceData } from "@/app/dashboard/trips/[tripId]/loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

const compactDocumentTypes = [
  { icon: <LinkIcon className="h-4 w-4" aria-hidden="true" />, label: "Links" },
  { icon: <FileText className="h-4 w-4" aria-hidden="true" />, label: "Notes" },
  { icon: <FileImage className="h-4 w-4" aria-hidden="true" />, label: "Screenshots" },
  { icon: <Mail className="h-4 w-4" aria-hidden="true" />, label: "Emails" }
];

export default async function DocumentsPage({ params }: PageProps) {
  const { tripId } = await params;
  const trip = await loadTripWorkspaceData(tripId);
  const base = `/dashboard/trips/${encodeURIComponent(tripId)}`;

  return (
    <div
      className="min-h-[100svh] bg-[#05070f] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 text-white lg:min-h-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0"
      data-testid="trip-documents-page"
    >
      <section className="mx-auto grid max-w-xl gap-5 lg:max-w-none lg:grid-cols-[1fr_0.8fr]">
        <div className="lg:hidden">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/42" aria-hidden="true" />
          <div className="grid grid-cols-[44px_1fr_44px_44px] items-center gap-2">
            <button
              aria-label="More document options"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white/76"
              type="button"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-xl font-black leading-tight text-white">{trip.name}</h1>
              <p className="truncate text-sm font-semibold text-white/48">{trip.dateRange}</p>
            </div>
            <button
              aria-label="Add document"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-orange-300 opacity-70"
              disabled
              title="Document upload is coming soon"
              type="button"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              aria-label="Close documents"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white/76"
              href={base}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <section className="grid gap-5">
          <article className="overflow-hidden rounded-[1.55rem] bg-[#1c1c1f] text-white shadow-[0_18px_50px_rgba(0,0,0,0.24)] ring-1 ring-white/8 lg:rounded-[1.75rem]">
            <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/68">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-base font-black text-white">Documents</h2>
              <button
                aria-label="Add document"
                className="grid h-9 w-9 place-items-center rounded-full text-orange-300 opacity-70"
                disabled
                title="Document upload is coming soon"
                type="button"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-4 py-5">
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-5 text-sm text-white/62">
                <p className="font-black text-white">No documents yet</p>
                <p className="mt-1 font-semibold">
                  Add reservations, notes, links, and screenshots when document upload is available.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-5">
          <article className="rounded-[1.55rem] bg-[#1c1c1f] p-4 text-white ring-1 ring-white/8">
            <h2 className="text-base font-black">What belongs here</h2>
            <div className="mt-3 overflow-hidden rounded-lg bg-white/[0.06]">
              {compactDocumentTypes.map((item) => (
                <div
                  className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                  key={item.label}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/18 text-indigo-200">
                    {item.icon}
                  </span>
                  <span className="text-sm font-semibold text-white/84">{item.label}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
