import {
  Bell,
  CircleDollarSign,
  CalendarDays,
  Compass,
  Inbox,
  LayoutDashboard,
  Map,
  Plane,
  Sparkles,
  Users
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type NavItem = {
  anchor?: string;
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
      },
      {
        href: "/dashboard/imports#saved-inspiration",
        icon: Inbox,
        label: "Saved Inspiration",
        match: (pathname, view) =>
          pathname.startsWith("/dashboard/imports") ||
          (pathname === "/dashboard" && view === "imports")
      },
      {
        href: "/dashboard/trips",
        icon: Map,
        label: "Map",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/map", tripId),
        match: (pathname, view) =>
          pathname.includes("/map") ||
          (pathname === "/dashboard" && view === "map")
      }
    ]
  },
  {
    title: "Trip Workspace",
    items: [
      {
        href: "/dashboard/trips",
        icon: CalendarDays,
        label: "Timeline",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/timeline", tripId),
        match: (pathname, view) =>
          pathname.includes("/timeline") ||
          (pathname === "/dashboard" && view === "itinerary")
      },
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
        icon: Sparkles,
        label: "Suggestions",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/map#smart-suggestions", tripId),
        match: () => false
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
        label: "Share",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/sharing", tripId),
        match: (pathname, view) =>
          pathname.includes("/sharing") ||
          (pathname === "/dashboard" && view === "sharing")
      }
    ]
  },
  {
    title: "Signals",
    items: [
      {
        href: "/dashboard?view=alerts",
        icon: Bell,
        label: "Notifications",
        match: (pathname, view) => pathname === "/dashboard" && view === "alerts"
      }
    ]
  }
];

export const mobileNavItems: NavItem[] = [
  navSections[0].items[0],
  navSections[0].items[1],
  navSections[0].items[2],
  navSections[0].items[4],
  navSections[0].items[3]
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
