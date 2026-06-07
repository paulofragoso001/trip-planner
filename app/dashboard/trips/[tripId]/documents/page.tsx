import { FileImage, FileText, Link as LinkIcon, Mail, Plus, Search } from "lucide-react";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

const filters = ["All", "Images", "Notes", "Files", "Links", "Emails"];

const sampleTypes = [
  { icon: <LinkIcon className="h-5 w-5" aria-hidden="true" />, label: "Links" },
  { icon: <FileText className="h-5 w-5" aria-hidden="true" />, label: "Notes" },
  { icon: <FileImage className="h-5 w-5" aria-hidden="true" />, label: "Screenshots" },
  { icon: <Mail className="h-5 w-5" aria-hidden="true" />, label: "Email import coming soon" }
];

export default async function DocumentsPage({ params }: PageProps) {
  await params;

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Travel wallet
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Documents</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
              Keep reservations, confirmations, screenshots, notes, files, and useful links for this trip in one place.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white opacity-70"
            disabled
            title="Document upload is coming soon"
            type="button"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add document
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <label className="relative block">
            <span className="sr-only">Search documents</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="min-h-12 w-full rounded-full border border-slate-200 bg-slate-50 px-11 text-sm font-semibold text-slate-700 outline-none ring-blue-200 transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4"
              disabled
              placeholder="Search documents"
              type="search"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter, index) => (
              <span
                className={[
                  "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-xs font-black ring-1",
                  index === 0
                    ? "bg-slate-950 text-white ring-slate-950"
                    : "bg-slate-50 text-slate-700 ring-slate-200"
                ].join(" ")}
                key={filter}
              >
                {filter}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-blue-700 shadow-sm">
            <FileText className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-xl font-black text-slate-950">No documents yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">
            Add reservations, notes, links, and screenshots to keep your trip details organized. Uploads and email import are coming soon.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-black text-slate-950">What belongs here</h3>
        <div className="mt-4 grid gap-3">
          {sampleTypes.map((item) => (
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3" key={item.label}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700">
                {item.icon}
              </span>
              <span className="text-sm font-black text-slate-800">{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
