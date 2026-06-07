export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-[520px] animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}
