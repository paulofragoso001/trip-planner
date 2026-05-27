"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/trip-ui";
import type { NavSection } from "./nav-data";

type SidebarNavProps = {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function SidebarNav({
  sections,
  collapsed = false,
  onNavigate
}: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  return (
    <nav aria-label="Primary" className="space-y-6" data-testid="app-shell-nav">
      {sections.map((section) => (
        <section className="space-y-3" key={section.title}>
          <h2
            className={cn(
              "px-2 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400",
              collapsed && "sr-only"
            )}
          >
            {section.title}
          </h2>

          <ul className="space-y-2">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.match?.(pathname, view) ??
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const itemKey = `${section.title}:${item.label}:${item.href}`;

              return (
                <li key={itemKey}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827]",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-blue-600 text-white shadow-sm hover:bg-blue-600"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                    )}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold transition",
                        active
                          ? "bg-blue-500/90 text-white"
                          : "bg-slate-100 text-slate-700 group-hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:group-hover:bg-white/15"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.4} />
                    </span>

                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        collapsed && "sr-only"
                      )}
                    >
                      {item.label}
                    </span>

                    {item.badge && !collapsed ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-inherit">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
