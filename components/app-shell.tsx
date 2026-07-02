"use client";

import { type ReactNode, useEffect, useState } from "react";
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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const widthQuery = window.matchMedia("(min-width: 1024px)");
    const hoverQuery = window.matchMedia("(hover: hover)");
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const sync = () => {
      setIsDesktop(widthQuery.matches && hoverQuery.matches && pointerQuery.matches);
    };

    sync();
    widthQuery.addEventListener("change", sync);
    hoverQuery.addEventListener("change", sync);
    pointerQuery.addEventListener("change", sync);
    return () => {
      widthQuery.removeEventListener("change", sync);
      hoverQuery.removeEventListener("change", sync);
      pointerQuery.removeEventListener("change", sync);
    };
  }, []);

  return isDesktop;
}
