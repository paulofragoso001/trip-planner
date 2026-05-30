type TripRoutePlaceholderProps = {
  section: "Overview" | "Itinerary" | "Map" | "Budget" | "Sharing";
};

export function TripRoutePlaceholder({ section }: TripRoutePlaceholderProps) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-panel">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Current trip
      </p>
      <h1 className="mt-2 text-3xl font-black">{section}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        This section is not ready yet.
      </p>
    </section>
  );
}
