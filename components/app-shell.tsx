"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { DesktopDashboardShell } from "@/components/dashboard/desktop-dashboard-shell";
import { MobileDashboardShell } from "@/components/dashboard/mobile-dashboard-shell";

type AppShellProps = {
  children: ReactNode;
  notifications?: ReactNode;
  userEmail: string;
  userMenu?: ReactNode;
  workspaceName?: string;
};

export function AppShell({
  children,
  notifications,
  userEmail,
  userMenu,
  workspaceName = "Almidy"
}: AppShellProps) {
  const isDesktop = useIsDesktopDashboardShell();

  if (!isDesktop) {
    return <MobileDashboardShell>{children}</MobileDashboardShell>;
  }

  return (
    <DesktopDashboardShell
      notifications={notifications}
      userEmail={userEmail}
      userMenu={userMenu}
      workspaceName={workspaceName}
    >
      {children}
    </DesktopDashboardShell>
  );
}

function useIsDesktopDashboardShell() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const widthQuery = window.matchMedia("(min-width: 1024px)");
      widthQuery.addEventListener("change", onStoreChange);
      return () => widthQuery.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false
  );
}
