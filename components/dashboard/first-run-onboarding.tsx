"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { FirstRunState } from "@/lib/wayline-onboarding";

type FirstRunOnboardingProps = {
  firstRun: FirstRunState;
};

const dismissalKey = "wayline:first-run-dismissed";

export function FirstRunOnboarding({ firstRun }: FirstRunOnboardingProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(dismissalKey) === "true");
  }, []);

  if (!firstRun.isNewUser || dismissed) {
    return null;
  }

  return (
    <section
      className="rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-4 shadow-sm"
      data-testid="first-run-onboarding"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight text-slate-950">
              New to Wayline?
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Try a sample travel note or add your own.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
            href="/dashboard/plan?sample=miami#saved-inspiration"
          >
            Try sample
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
            href="/dashboard/plan#saved-inspiration"
          >
            Add my own idea
          </Link>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-black text-slate-600 transition hover:bg-white/70"
            onClick={() => {
              sessionStorage.setItem(dismissalKey, "true");
              setDismissed(true);
            }}
            type="button"
          >
            Skip for now
          </button>
        </div>
      </div>
    </section>
  );
}
