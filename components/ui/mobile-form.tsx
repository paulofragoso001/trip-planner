"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/trip-ui";

type MobileFormShellProps = {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
};

type MobileFormHeaderProps = {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
};

type MobileFormSectionProps = {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
};

type MobileFieldProps = {
  children: ReactNode;
  helper?: ReactNode;
  label: ReactNode;
};

export function MobileFormShell({
  children,
  className,
  "data-testid": testId
}: MobileFormShellProps) {
  return (
    <div
      className={cn(
        "rounded-[1.55rem] border border-white/10 bg-[#1f1f21] text-white shadow-[0_22px_60px_rgba(0,0,0,0.32)]",
        "lg:border-slate-200 lg:bg-white lg:text-slate-950 lg:shadow-sm",
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function MobileFormHeader({
  leftAction,
  rightAction,
  subtitle,
  title
}: MobileFormHeaderProps) {
  return (
    <div className="grid grid-cols-[minmax(44px,auto)_minmax(0,1fr)_minmax(44px,auto)] items-start gap-3 border-b border-white/10 px-4 py-3 lg:border-slate-200">
      <div className="flex justify-start">{leftAction}</div>
      <div className="min-w-0 text-center">
        <h2 className="truncate text-base font-black leading-tight text-white lg:text-slate-950">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs font-semibold text-white/48 lg:text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end">{rightAction}</div>
    </div>
  );
}

export function MobileFormSection({
  children,
  className,
  title
}: MobileFormSectionProps) {
  return (
    <section className={cn("px-4 py-3", className)}>
      {title ? (
        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/42 lg:text-slate-500">
          {title}
        </h3>
      ) : null}
      <div className="overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/8 lg:bg-slate-50 lg:ring-slate-200">
        {children}
      </div>
    </section>
  );
}

export function MobileField({ children, helper, label }: MobileFieldProps) {
  return (
    <div className="grid min-h-14 gap-1 border-b border-white/8 px-4 py-3 last:border-b-0 lg:border-slate-200">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42 lg:text-slate-500">
        {label}
      </span>
      {children}
      {helper ? (
        <span className="text-xs font-semibold leading-5 text-orange-200/76 lg:text-amber-700">
          {helper}
        </span>
      ) : null}
    </div>
  );
}

export const mobileInputClassName =
  "min-h-9 w-full border-0 bg-transparent p-0 text-[17px] font-semibold leading-tight text-white outline-none placeholder:text-white/32 focus:ring-0 lg:text-slate-950 lg:placeholder:text-slate-400";

export const mobileSelectClassName =
  "min-h-9 w-full border-0 bg-transparent p-0 text-[17px] font-semibold leading-tight text-white outline-none focus:ring-0 lg:text-slate-950";

export const mobileTextareaClassName =
  "min-h-24 w-full resize-none border-0 bg-transparent p-0 text-[17px] font-semibold leading-6 text-white outline-none placeholder:text-white/32 focus:ring-0 lg:text-slate-950 lg:placeholder:text-slate-400";

export const mobilePrimaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-45";

export const mobileSecondaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-black text-orange-300 transition hover:text-orange-200 disabled:opacity-45 lg:text-slate-600";
