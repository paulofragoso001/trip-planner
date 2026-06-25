"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
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
      className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 p-4 text-white shadow-[0_24px_80px_rgba(2,6,23,0.28)]"
      data-testid="first-run-onboarding"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_12%,rgba(249,115,22,0.24),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.16),transparent_26%),linear-gradient(135deg,#020617,#111827)]" />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/12 text-orange-200 ring-1 ring-white/14">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-orange-200/90">
              First run
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white">
              New to Almidy?
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/68">
              Start with a sample note or drop in your own idea. Almidy will turn it into places to review.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            href={dashboardActionRoutes.plan.sampleMiami}
          >
            Try sample
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white/12 px-4 text-sm font-black text-white ring-1 ring-white/14 transition hover:bg-white/16"
            href={dashboardActionRoutes.plan.addIdea}
          >
            Add my own idea
          </Link>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-black text-white/58 transition hover:bg-white/10 hover:text-white"
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
