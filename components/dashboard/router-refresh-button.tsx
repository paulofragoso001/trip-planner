"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function RouterRefreshButton({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <button
      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold transition hover:bg-slate-200"
      onClick={() => router.refresh()}
      type="button"
    >
      {children}
    </button>
  );
}
