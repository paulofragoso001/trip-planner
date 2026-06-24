"use client";

import { useEffect, useMemo, useState } from "react";

type RecoverableRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
};

const CHUNK_RELOAD_KEY = "wayline:chunk-reload-attempt";

export function RecoverableRouteError({
  error,
  reset,
  title
}: RecoverableRouteErrorProps) {
  const [refreshing, setRefreshing] = useState(false);
  const isChunkLoadError = useMemo(() => isRecoverableChunkError(error), [error]);

  useEffect(() => {
    if (!isChunkLoadError) return;

    const key = `${CHUNK_RELOAD_KEY}:${window.location.pathname}`;
    const alreadyTried = window.sessionStorage.getItem(key);

    if (!alreadyTried) {
      window.sessionStorage.setItem(key, String(Date.now()));
      setRefreshing(true);
      window.location.reload();
    }
  }, [isChunkLoadError]);

  const heading = isChunkLoadError ? "Almidy was updated" : title;
  const message = isChunkLoadError
    ? "Refresh to load the latest version. Your trip data is safe."
    : "This page is temporarily unavailable. Try again in a moment.";

  return (
    <div
      className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-amber-950 shadow-sm"
      data-testid="recoverable-route-error"
    >
      <h2 className="text-lg font-black">{heading}</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6">{message}</p>
      <button
        className="mt-4 min-h-11 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
        onClick={() => {
          if (isChunkLoadError) {
            setRefreshing(true);
            window.location.reload();
            return;
          }
          reset();
        }}
        type="button"
      >
        {refreshing ? "Refreshing..." : isChunkLoadError ? "Refresh Almidy" : "Retry"}
      </button>
      {!isChunkLoadError && error.digest ? (
        <p className="mt-3 font-mono text-xs text-amber-800/70">{error.digest}</p>
      ) : null}
    </div>
  );
}

function isRecoverableChunkError(error: Error) {
  return /ChunkLoadError|Loading chunk|Failed to load chunk|_next\/static\/chunks|module \d+/i.test(
    error.message || ""
  );
}
