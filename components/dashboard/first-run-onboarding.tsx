"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { FirstRunState, FirstRunStep } from "@/lib/wayline-onboarding";
import { cn } from "@/components/trip-ui";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type FirstRunOnboardingProps = {
  firstRun: FirstRunState;
};

const dismissalKey = "wayline:first-run-dismissed";

const steps: Array<{ key: FirstRunStep; label: string; shortLabel: string }> =
  waylineCopy.onboardingSteps.map((step, index) => ({
    key: ["add_inspiration", "review_places", "create_trip_plan"][index] as FirstRunStep,
    label: step.label,
    shortLabel: step.label
  }));

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
      className="rounded-[1.5rem] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
      data-testid="first-run-onboarding"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            First trip
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Plan your first trip with Wayline
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Add one idea, review the places, then create your first mapped trip.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
            href="/dashboard/imports?sample=miami#saved-inspiration"
          >
            Try sample inspiration
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
            href="/dashboard/imports#saved-inspiration"
          >
            Add my own idea
          </Link>
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-sm font-black text-slate-600 transition hover:bg-white/70"
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

type FirstRunProgressProps = {
  firstRun: FirstRunState;
};

export function FirstRunProgress({ firstRun }: FirstRunProgressProps) {
  if (firstRun.currentStep === "complete") {
    return null;
  }

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === firstRun.currentStep)
  );

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
      <div className="grid gap-2 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            First plan guide
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            Add, review, create.
          </h2>
        </div>
        <Link className="text-sm font-black text-blue-700" href="/dashboard/imports">
          Plan
        </Link>
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="First trip progress">
        {steps.map((step, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;

          return (
            <li
              className={cn(
                "grid min-h-24 content-between rounded-2xl border p-3 text-sm shadow-sm",
                complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : active
                    ? "border-blue-200 bg-blue-50 text-blue-950"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              )}
              key={step.key}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl text-xs font-black",
                  complete
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-200"
                )}
              >
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="font-black">
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
