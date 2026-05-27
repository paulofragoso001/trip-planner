export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[520px] animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-[320px] animate-pulse rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}
