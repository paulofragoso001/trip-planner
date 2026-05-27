"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-red-800">
      <h2 className="text-lg font-black">Could not load trip workspace</h2>
      <p className="mt-2 text-sm font-semibold">{error.message}</p>
      <button
        className="mt-4 rounded-2xl bg-red-700 px-4 py-3 text-sm font-bold text-white"
        onClick={reset}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}
