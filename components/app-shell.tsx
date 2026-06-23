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
  workspaceName = "Wayline"
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
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}
