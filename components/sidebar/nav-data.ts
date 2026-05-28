import {
  BarChart3,
  Bell,
  CircleDollarSign,
  CalendarDays,
  Compass,
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
  getHref?: (pathname: string, tripId?: string | null) => string;
  match?: (pathname: string, view: string | null) => boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

function currentTripHref(pathname: string, suffix = "", fallbackTripId?: string | null) {
  const match = pathname.match(/^\/dashboard\/trips\/([^/]+)/);
  const tripId = match?.[1] || fallbackTripId;

  if (!tripId) {
    return "/dashboard/trips";
  }

  return `/dashboard/trips/${tripId}${suffix}`;
}

export const navSections: NavSection[] = [
  {
    title: "Wayline",
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        label: "Home",
        match: (pathname, view) => pathname === "/dashboard" && !view
      },
      {
        href: "/dashboard/imports",
        icon: Compass,
        label: "Plan with AI",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/imports") ||
          (pathname === "/dashboard" && view === "imports")
      },
      {
        href: "/dashboard/trips",
        icon: Plane,
        label: "My Trips",
        match: (pathname, view) =>
          pathname === "/dashboard/trips" ||
          (pathname === "/dashboard" && view === "trips")
      }
    ]
  },
  {
    title: "Trip Plan",
    items: [
      {
        href: "/dashboard/trips",
        icon: Map,
        label: "Map",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/map", tripId),
        match: (pathname, view) =>
          pathname.includes("/map") ||
          (pathname === "/dashboard" && view === "map")
      },
      {
        href: "/dashboard/trips",
        icon: CalendarDays,
        label: "Itinerary",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/timeline", tripId),
        match: (pathname, view) =>
          pathname.includes("/timeline") ||
          (pathname === "/dashboard" && view === "itinerary")
      },
      {
        href: "/dashboard/trips",
        icon: CircleDollarSign,
        label: "Budget",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/budget", tripId),
        match: (pathname, view) =>
          pathname.includes("/budget") ||
          (pathname === "/dashboard" && view === "budget")
      },
      {
        href: "/dashboard/trips",
        icon: Users,
        label: "Sharing",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/sharing", tripId),
        match: (pathname, view) =>
          pathname.includes("/sharing") ||
          (pathname === "/dashboard" && view === "sharing")
      },
      {
        href: "/dashboard?view=flight-status",
        icon: Radar,
        label: "Flight Status",
        match: (pathname, view) => pathname === "/dashboard" && view === "flight-status"
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
        getHref: (pathname, tripId) => currentTripHref(pathname, "", tripId),
        match: (pathname, view) =>
          (pathname.startsWith("/dashboard/trips/") &&
            !pathname.includes("/timeline") &&
            !pathname.includes("/map") &&
            !pathname.includes("/budget") &&
            !pathname.includes("/sharing")) ||
          (pathname === "/dashboard" && view === "activity")
      },
      {
        href: "/dashboard/imports",
        icon: Inbox,
        label: "Saved Inspiration",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/imports") ||
          (pathname === "/dashboard" && view === "imports")
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

  return match?.label ?? "Home";
}
