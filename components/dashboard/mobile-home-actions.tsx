import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/trip-ui";

export function MobileHomeAction({
  href,
  icon,
  label,
  meta,
  primary = false
}: {
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={cn(
        "grid min-h-[3.05rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[1rem] px-3 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-orange-300/20 min-[390px]:min-h-[3.45rem] min-[390px]:gap-2.5 min-[390px]:rounded-[1.15rem] min-[390px]:py-2.5",
        primary
          ? "bg-slate-950 text-white shadow-[0_16px_44px_rgba(15,23,42,0.16)]"
          : "bg-slate-100 text-slate-950 ring-1 ring-slate-200 hover:bg-slate-200/80"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full min-[390px]:h-7 min-[390px]:w-7",
          primary ? "bg-white text-orange-500" : "bg-white text-orange-500 shadow-sm"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.88rem] font-black min-[390px]:text-[0.95rem]">{label}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[0.68rem] font-bold min-[390px]:text-xs",
            primary ? "text-white/66" : "text-slate-500"
          )}
        >
          {meta}
        </span>
      </span>
      <ArrowRight
        className={cn("h-4 w-4", primary ? "text-white/48" : "text-slate-400")}
        aria-hidden="true"
      />
    </Link>
  );
}

export function MobileHomeTile({
  compact = false,
  href,
  icon,
  label,
  primary = false
}: {
  compact?: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={cn(
        "grid place-items-center rounded-[1rem] px-2 text-center text-[0.78rem] font-black transition focus:outline-none focus:ring-4 focus:ring-orange-300/20 min-[390px]:rounded-[1.15rem]",
        compact ? "hidden min-h-[3.85rem]" : "min-h-[4.1rem] min-[390px]:min-h-[4.35rem]",
        primary
          ? "bg-orange-500 text-white shadow-[0_18px_38px_rgba(249,115,22,0.24)] hover:bg-orange-600"
          : "bg-white text-slate-950 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 hover:bg-slate-50",
        compact && "min-[460px]:grid"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full min-[390px]:h-9 min-[390px]:w-9",
          primary ? "bg-white/16 text-white" : "bg-orange-50 text-orange-500"
        )}
      >
        {icon}
      </span>
      <span className="mt-1 max-w-full truncate">{label}</span>
    </Link>
  );
}
