type TripRoutePlaceholderProps = {
  section: "Overview" | "Timeline" | "Map" | "Budget" | "Sharing";
};

export function TripRoutePlaceholder({ section }: TripRoutePlaceholderProps) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-panel">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Trip workspace
      </p>
      <h1 className="mt-2 text-3xl font-black">{section}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Route scaffold for the App Router split. The next slice should move the
        corresponding traveler-facing panel out of the dashboard monolith and
        into this route.
      </p>
    </section>
  );
}
