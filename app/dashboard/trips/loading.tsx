export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="h-[420px] animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-[360px] animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}
