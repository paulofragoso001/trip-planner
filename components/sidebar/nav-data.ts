import {
  CircleDollarSign,
  CalendarDays,
  Compass,
  LayoutDashboard,
  Map,
  Plane,
  User,
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
  match?: (pathname: string, view: string | null, hash?: string) => boolean;
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
        label: "Plan",
        match: (pathname, view, hash) =>
          (pathname.startsWith("/dashboard/imports") && hash !== "#saved-inspiration") ||
          (pathname === "/dashboard" && view === "imports")
      },
      {
        href: "/dashboard/trips",
        icon: Plane,
        label: "Trips",
        match: (pathname, view) =>
          pathname === "/dashboard/trips" || (pathname === "/dashboard" && view === "trips")
      },
      {
        href: "/dashboard/map",
        icon: Map,
        label: "Map",
        getHref: (pathname, tripId) => {
          const currentTrip = pathname.match(/^\/dashboard\/trips\/([^/]+)/)?.[1] || tripId;
          return currentTrip ? `/dashboard/trips/${currentTrip}/map` : "/dashboard/map";
        },
        match: (pathname, view) =>
          pathname === "/dashboard/map" || (pathname === "/dashboard" && view === "map")
      },
      {
        href: "/dashboard/account",
        icon: User,
        label: "Profile",
        match: (pathname, view) =>
          pathname === "/dashboard/account" ||
          (pathname === "/dashboard" && view === "account")
      }
    ]
  },
  {
    title: "Trip Workspace",
    items: [
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
        label: "Ideas",
        getHref: (pathname, tripId) => currentTripHref(pathname, "/ideas", tripId),
        match: (pathname, view) =>
          pathname.includes("/ideas") ||
          (pathname === "/dashboard" && view === "ideas")
      },
      {
        href: "/dashboard/trips",
        icon: CircleDollarSign,
        label: "Expenses",
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
  }
];

export const mobileNavItems: NavItem[] = [
  navSections[0].items[2],
  navSections[0].items[1],
  navSections[0].items[3],
  navSections[0].items[4]
];

export function resolveNavTitle(pathname: string, view: string | null) {
  if (pathname === "/dashboard" && view === "alerts") {
    return "Notifications";
  }

  const match = navSections
    .flatMap((section) => section.items)
    .find((item) => item.match?.(pathname, view));

  return match?.label ?? "Home";
}
