type EmptyStateProps = {
  title?: string;
  body?: string;
};

export function EmptyState({
  title = "No plans yet",
  body = "Add flights, stays, meetings, and activities to build this itinerary."
}: EmptyStateProps) {
  return (
    <div
      className="rounded-3xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-[#6f675c]"
      data-testid="trip-preview-empty-state"
    >
      <h2 className="text-lg font-black text-[#221d17]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md">{body}</p>
    </div>
  );
}
