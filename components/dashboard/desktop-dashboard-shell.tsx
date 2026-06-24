"use client";

import { MessageSquare, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { navSections, resolveNavTitle } from "@/components/sidebar/nav-data";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { cn } from "@/components/trip-ui";

type DesktopDashboardShellProps = {
  children: ReactNode;
  notifications?: ReactNode;
  userEmail: string;
  userMenu?: ReactNode;
  workspaceName: string;
};

type ShellDensity = "compact" | "comfortable";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "wayline:sidebar-collapsed";

export function DesktopDashboardShell({
  children,
  notifications,
  userEmail,
  userMenu,
  workspaceName
}: DesktopDashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedLoaded, setCollapsedLoaded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [density, setDensity] = useState<ShellDensity>("comfortable");

  const page = useMemo(
    () => ({ title: resolveNavTitle(pathname, view) }),
    [pathname, view]
  );
  const tripWorkspaceContent = /^\/dashboard\/trips\/[^/]+/.test(pathname);
  const fullBleedContent =
    tripWorkspaceContent || pathname.includes("/map") || pathname.startsWith("/dashboard/layout-simulator");
  const isDashboardLaunch = pathname === "/dashboard" && (!view || view === "trips");

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);

    if (stored) {
      setCollapsed(stored === "true");
    }

    setCollapsedLoaded(true);
  }, []);

  useEffect(() => {
    if (!collapsedLoaded) {
      return;
    }

    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed, collapsedLoaded]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div
      className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,0.24),transparent_28%),radial-gradient(circle_at_92%_8%,rgba(20,184,166,0.14),transparent_34%),linear-gradient(180deg,#020617,#08111f_48%,#0f172a)] text-slate-100"
      data-density={density}
      data-shell-variant="desktop"
      data-wallet-shell="true"
      data-testid="app-shell-root"
    >
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-brand focus:shadow-panel"
        href="#main-content"
      >
        Skip to main content
      </a>

      <div className="flex h-dvh">
        <aside
          className={cn(
            "sticky top-0 flex h-dvh shrink-0 border-r border-white/10 bg-slate-950/82 shadow-[18px_0_70px_rgba(2,6,23,0.28)] backdrop-blur-2xl transition-[width] duration-300 ease-out",
            collapsed ? "w-[88px]" : "w-[280px]"
          )}
          data-wallet-sidebar="true"
          data-testid="app-shell-sidebar"
          aria-label="Primary navigation"
        >
          <SidebarContent
            collapsed={collapsed}
            onCollapse={() => setCollapsed((current) => !current)}
            workspaceName={workspaceName}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/72 text-slate-100 shadow-[0_10px_45px_rgba(2,6,23,0.18)] backdrop-blur-2xl"
            data-wallet-topbar="true"
            data-testid="app-shell-topbar"
          >
            <div
              className={cn(
                "flex items-center gap-3 px-6",
                density === "compact" ? "min-h-[60px]" : "min-h-[72px]"
              )}
            >
              <div className="min-w-0 flex-1">
                <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400" aria-label="Breadcrumbs">
                  <Link className="rounded-md text-slate-400 outline-none transition hover:text-white focus:ring-4 focus:ring-blue-400/20" href="/dashboard">
                    Home
                  </Link>
                  {page.title !== "Home" ? (
                    <>
                      <span aria-hidden="true">/</span>
                      <span className="truncate">{page.title}</span>
                    </>
                  ) : null}
                </nav>
                <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">{page.title}</h1>
              </div>

              <Link
                aria-label="Open search"
                className="flex h-11 min-w-[240px] max-w-sm flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-400 shadow-inner shadow-black/10 backdrop-blur transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-400/15"
                href="/dashboard/search"
              >
                <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">Search trips and saved ideas...</span>
              </Link>

              {notifications}

              <button
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/10 text-sm font-black text-white shadow-sm backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-blue-400/20"
                onClick={() => setDarkMode((current) => !current)}
                type="button"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              <div className="relative">
                <button
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex h-11 min-w-11 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-blue-400/20"
                  onClick={() => setUserMenuOpen((current) => !current)}
                  type="button"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-xs font-black text-white">
                    {initials(userEmail)}
                  </span>
                  <span className="hidden max-w-32 truncate xl:inline">{userEmail}</span>
                </button>
                {userMenuOpen ? (
                  <div
                    className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 p-3 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl"
                    role="menu"
                  >
                    {userMenu}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main
            className={cn(
              "min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_72%_8%,rgba(59,130,246,0.1),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.46),rgba(15,23,42,0.08)_42%,rgba(2,6,23,0.38))] pb-6 text-slate-950",
              isDashboardLaunch ? "px-8 pt-6" : "px-8",
              fullBleedContent ? "px-6" : "px-8",
              density === "compact" ? "py-4" : "py-6",
              tripWorkspaceContent && "pb-0"
            )}
            data-testid="app-shell-main"
            id="main-content"
          >
            <div
              className={cn(
                "mx-auto w-full",
                fullBleedContent ? "max-w-none" : "max-w-[1440px]"
              )}
              data-testid="app-shell-content"
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  onCollapse,
  workspaceName
}: {
  collapsed: boolean;
  onCollapse?: () => void;
  workspaceName: string;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col px-4 py-5">
      <div className="flex min-h-14 items-center gap-3 px-2">
        <Link
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus:ring-4 focus:ring-blue-400/20"
          href="/dashboard"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)]">
            W
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-black uppercase tracking-[0.2em] text-white">
                {workspaceName}
              </span>
              <span className="block truncate text-xs font-semibold text-slate-400">
                Travel wallet
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        <SidebarNav
          collapsed={collapsed}
          sections={navSections}
        />
      </div>

      <div className="border-t border-white/10 pt-3">
        <a
          className={cn(
            "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3.5 text-sm font-semibold text-slate-300 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            collapsed && "justify-center px-0"
          )}
          data-testid="app-shell-workspace-switcher"
          href="mailto:feedback@almidy.app?subject=Almidy%20feedback"
          aria-label={collapsed ? "Send feedback" : undefined}
          title={collapsed ? "Send feedback" : undefined}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold text-slate-200 transition group-hover:bg-white/15 group-hover:text-white">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate">Send feedback</span>
              <span className="block truncate text-xs text-slate-500">
                Report an issue
              </span>
            </span>
          ) : null}
        </a>
        {onCollapse ? (
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-sm font-semibold text-slate-300 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              collapsed && "justify-center px-0"
            )}
            onClick={onCollapse}
            type="button"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sm font-bold text-slate-200">
              {collapsed ? ">" : "<"}
            </span>
            <span className={cn(collapsed && "sr-only")}>Collapse sidebar</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function initials(value: string) {
  const [first = "W", second = ""] = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase());

  return `${first}${second}`.slice(0, 2);
}
