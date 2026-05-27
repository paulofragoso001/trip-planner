"use client";

import { type ReactNode, useEffect, useState } from "react";
import { navSections } from "./nav-data";
import { SidebarNav } from "./sidebar-nav";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "wayline:sidebar-collapsed";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedLoaded, setCollapsedLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);

    if (saved) {
      setCollapsed(saved === "true");
    }

    setCollapsedLoaded(true);
  }, []);

  useEffect(() => {
    if (!collapsedLoaded) {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(collapsed)
    );
  }, [collapsed, collapsedLoaded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          aria-label="Open navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          =
        </button>
        <span className="font-black">Wayline</span>
        <div className="w-10" />
      </header>

      <div className="mx-auto grid max-w-screen-2xl lg:grid-cols-[auto_minmax(0,1fr)]">
        <aside
          className={[
            "sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex",
            "transition-all duration-200",
            collapsed ? "w-[88px] px-2 py-4" : "w-[280px] px-4 py-5"
          ].join(" ")}
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className={collapsed ? "sr-only" : "text-lg font-black"}>
              Wayline
            </span>
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>

          <SidebarNav collapsed={collapsed} sections={navSections} />
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      {mobileOpen ? (
        <>
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] border-r border-slate-200 bg-white px-4 py-5 shadow-2xl lg:hidden">
            <div className="mb-6 flex items-center justify-between gap-3">
              <span className="text-lg font-black">Wayline</span>
              <button
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <SidebarNav
              onNavigate={() => setMobileOpen(false)}
              sections={navSections}
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}
