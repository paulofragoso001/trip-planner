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
        "grid min-h-[3.9rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] px-3 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-orange-300/20",
        primary
          ? "bg-white text-slate-950 shadow-[0_16px_44px_rgba(255,255,255,0.12)]"
          : "bg-white/[0.075] text-white ring-1 ring-white/10 hover:bg-white/12"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          primary ? "bg-slate-950 text-orange-300" : "bg-orange-500/16 text-orange-300"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.95rem] font-black">{label}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs font-bold",
            primary ? "text-slate-600" : "text-slate-400"
          )}
        >
          {meta}
        </span>
      </span>
      <ArrowRight
        className={cn("h-4 w-4", primary ? "text-slate-400" : "text-white/42")}
        aria-hidden="true"
      />
    </Link>
  );
}

export function MobileHomeTile({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className="grid min-h-[4.15rem] place-items-center gap-1 rounded-[1.25rem] bg-white/[0.075] px-3 py-2 text-center text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/12 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={href}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/16 text-orange-300">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
