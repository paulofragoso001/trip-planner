import {
  BarChart3,
  Bell,
  CircleDollarSign,
  CalendarDays,
  History,
  Inbox,
  LayoutDashboard,
  Map,
  PanelLeft,
  Plane,
  Radar,
  Settings,
  Users
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type NavItem = {
  href: string;
  icon: NavIcon;
  label: string;
  badge?: string;
  match?: (pathname: string, view: string | null) => boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "Operations",
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        label: "Overview",
        match: (pathname, view) => pathname === "/dashboard" && !view
      },
      {
        href: "/dashboard/trips",
        icon: Plane,
        label: "Trips",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/trips") ||
          (pathname === "/dashboard" && view === "trips")
      },
      {
        href: "/dashboard/trips",
        icon: CalendarDays,
        label: "Itinerary",
        match: (pathname, view) =>
          pathname.includes("/timeline") ||
          (pathname === "/dashboard" && view === "itinerary")
      },
      {
        href: "/dashboard/trips",
        icon: CircleDollarSign,
        label: "Budget",
        match: (pathname, view) =>
          pathname.includes("/budget") ||
          (pathname === "/dashboard" && view === "budget")
      },
      {
        href: "/dashboard/imports",
        icon: Inbox,
        label: "Imports",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/imports") ||
          (pathname === "/dashboard" && view === "imports")
      },
      {
        href: "/dashboard?view=flight-status",
        icon: Radar,
        label: "Flight Status",
        match: (pathname, view) => pathname === "/dashboard" && view === "flight-status"
      },
      {
        href: "/dashboard/trips",
        icon: Map,
        label: "Map",
        match: (pathname, view) =>
          pathname.includes("/map") ||
          (pathname === "/dashboard" && view === "map")
      }
    ]
  },
  {
    title: "Signals",
    items: [
      {
        href: "/dashboard?view=alerts",
        icon: Bell,
        label: "Alerts",
        match: (pathname, view) => pathname === "/dashboard" && view === "alerts"
      },
      {
        href: "/dashboard/trips",
        icon: History,
        label: "Activity",
        match: (pathname, view) =>
          (pathname.startsWith("/dashboard/trips/") &&
            !pathname.includes("/timeline") &&
            !pathname.includes("/map") &&
            !pathname.includes("/budget") &&
            !pathname.includes("/sharing")) ||
          (pathname === "/dashboard" && view === "activity")
      },
      {
        href: "/dashboard/trips",
        icon: Users,
        label: "Sharing",
        match: (pathname, view) =>
          pathname.includes("/sharing") ||
          (pathname === "/dashboard" && view === "sharing")
      },
      {
        href: "/dashboard/api-transition",
        icon: BarChart3,
        label: "Reports",
        match: (pathname) => pathname.startsWith("/dashboard/api-transition")
      },
      {
        href: "/dashboard/layout-simulator",
        icon: PanelLeft,
        label: "Layout Simulator",
        match: (pathname) => pathname.startsWith("/dashboard/layout-simulator")
      }
    ]
  },
  {
    title: "Admin",
    items: [
      {
        href: "/dashboard/admin",
        icon: Settings,
        label: "Admin",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/admin") ||
          (pathname === "/dashboard" && view === "settings")
      }
    ]
  }
];

export function resolveNavTitle(pathname: string, view: string | null) {
  if (pathname.startsWith("/dashboard/api-transition")) {
    return "API Transition";
  }

  if (pathname.startsWith("/dashboard/layout-simulator")) {
    return "Layout Simulator";
  }

  const match = navSections
    .flatMap((section) => section.items)
    .find((item) => item.match?.(pathname, view));

  return match?.label ?? "Overview";
}
