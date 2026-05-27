"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type TravelApp = {
  name: string;
  email: boolean;
  ai: boolean;
  maps: boolean;
  sharing: boolean;
  offline: string;
  pricing: string;
  platforms: string[];
  desktop: boolean;
  ratings: string;
  notes: string;
};

type Trip = {
  id: string;
  name?: string | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type TripSegment = {
  id: string;
  kind: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
};

const apps: TravelApp[] = [
  { name: "TripIt", email: true, ai: false, maps: true, sharing: true, offline: "Partial", pricing: "Free; TripIt Pro $49/year", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "4.7 App Store; Google Play listing", notes: "Auto-import from email, strong flight alerts and airport flow, but limited all-in-one planning." },
  { name: "Wanderlog", email: true, ai: true, maps: true, sharing: true, offline: "Pro only", pricing: "Free; Wanderlog Pro $39.99/year", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "4.9 App Store; 4.7 Google Play", notes: "Broad planning stack with maps and collaboration, but still depends on outside booking flows." },
  { name: "Google Travel", email: false, ai: true, maps: true, sharing: true, offline: "Limited", pricing: "Free", platforms: ["Web"], desktop: true, ratings: "No standalone app rating", notes: "Excellent discovery and Maps connection, but weak as a persistent itinerary OS." },
  { name: "Roadtrippers", email: false, ai: true, maps: true, sharing: true, offline: "Limited", pricing: "Free tier; paid plans", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Widely reviewed", notes: "Strong for road-trip routing, weaker for universal itinerary ingestion." },
  { name: "Kayak Trips", email: true, ai: false, maps: true, sharing: true, offline: "Limited", pricing: "Free", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Widely reviewed", notes: "Useful booking-led trip organization, but not a durable travel memory layer." },
  { name: "Tripsy", email: true, ai: false, maps: true, sharing: true, offline: "Yes", pricing: "Free; premium subscription", platforms: ["iOS", "macOS"], desktop: true, ratings: "Widely reviewed in App Store", notes: "Great Apple ecosystem experience, but no Android or full web parity." },
  { name: "Sygic Travel", email: false, ai: false, maps: true, sharing: true, offline: "Yes", pricing: "Free tier; paid premium maps", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Widely reviewed", notes: "Excellent offline map planning, but little inbox or automation depth." },
  { name: "Polarsteps", email: false, ai: false, maps: true, sharing: true, offline: "Yes", pricing: "Free; paid extras", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Widely reviewed", notes: "Great for travel journaling and route capture, not for booking-centric trip ops." },
  { name: "App in the Air", email: true, ai: false, maps: true, sharing: true, offline: "Partial", pricing: "Subscription", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Widely reviewed", notes: "Flight-heavy power user app, but narrower than a full travel planner." },
  { name: "TripCase", email: true, ai: false, maps: true, sharing: true, offline: "Limited", pricing: "Free / legacy", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "Legacy app-store presence", notes: "Historic itinerary organizer with email import, but dated product depth." },
  { name: "Notion Travel Setup", email: false, ai: true, maps: false, sharing: true, offline: "Partial", pricing: "Free tier; paid plans", platforms: ["iOS", "Android", "Web", "Desktop"], desktop: true, ratings: "Widely reviewed", notes: "Flexible travel workspace, but manual rather than native travel ingestion." },
  { name: "Airtable Travel Ops", email: false, ai: true, maps: false, sharing: true, offline: "Partial", pricing: "Free tier; paid plans", platforms: ["iOS", "Android", "Web", "Desktop"], desktop: true, ratings: "Widely reviewed", notes: "Powerful database-style coordination, but more ops tool than consumer itinerary app." },
  { name: "Maps.me", email: false, ai: false, maps: true, sharing: true, offline: "Yes", pricing: "Free / paid extras", platforms: ["iOS", "Android"], desktop: false, ratings: "Widely reviewed", notes: "Excellent offline maps, but weak booking and itinerary ingestion." },
  { name: "CityMaps2Go", email: false, ai: false, maps: true, sharing: false, offline: "Yes", pricing: "Free / paid tiers", platforms: ["iOS", "Android"], desktop: false, ratings: "Reviewed in travel blogs", notes: "Offline-first map organizer, but not a full itinerary hub." },
  { name: "Google Maps + Docs workflow", email: false, ai: false, maps: true, sharing: true, offline: "Partial", pricing: "Free", platforms: ["iOS", "Android", "Web"], desktop: true, ratings: "N/A combination workflow", notes: "Common DIY stack for planning, but fragmented by design." }
];

const insights = [
  ["Best for inbox automation", "TripIt and Wanderlog stand out when you want confirmations pulled into one place quickly."],
  ["Best for offline travel", "Tripsy, Sygic Travel, Polarsteps, Maps.me, and CityMaps2Go are strongest when internet is unreliable."],
  ["Best for desktop planning", "Wanderlog, TripIt, Google Travel, Notion, and Airtable work better when you want to plan from a larger screen."],
  ["Biggest market gap", "Most apps still separate booking import, AI help, map context, and shared planning instead of unifying them in one persistent system."]
];

function mobileCapable(app: TravelApp) {
  return app.platforms.includes("iOS") || app.platforms.includes("Android");
}

function offlineScore(value: string) {
  return value === "Yes" ? 3 : value === "Pro only" ? 2 : value === "Partial" ? 1 : 0;
}

function formatDateTime(value: string | null) {
  if (!value) return "Time TBA";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDayLabel(value: string | null) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function tripTitle(trip: Trip) {
  return trip.name || trip.destination || "Untitled trip";
}

function KpiSkeleton() {
  return <div className="mt-2 h-7 w-12 animate-pulse rounded-lg bg-[#fcfbf7] opacity-70" />;
}

function TripCardSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-black/5 bg-[#efebe3] p-4 opacity-70">
      <div className="h-3 w-24 rounded bg-[#fcfbf7]" />
      <div className="grid gap-2">
        <div className="h-4 w-4/5 rounded bg-[#fcfbf7]" />
        <div className="h-3 w-1/2 rounded bg-[#fcfbf7]" />
      </div>
      <div className="h-6 w-20 rounded-full bg-[#fcfbf7]" />
    </div>
  );
}

function SegmentSkeleton() {
  return (
    <article className="grid animate-pulse gap-3 sm:grid-cols-[120px_1fr]">
      <div className="mt-3 h-3 w-20 rounded bg-[#efebe3]" />
      <div className="grid gap-2 rounded-2xl border border-black/5 bg-[#efebe3] p-4">
        <div className="h-3 w-16 rounded bg-[#fcfbf7]" />
        <div className="h-4 w-3/4 rounded bg-[#fcfbf7]" />
        <div className="h-3 w-1/2 rounded bg-[#fcfbf7]" />
      </div>
    </article>
  );
}

export default function TravelDashboardPage() {
  const sb = getSupabaseClient();
  const skipNextEditKindReset = useRef(false);
  const autosaveToastTimeout = useRef<number | null>(null);
  const lastAutosaveToastAt = useRef(0);
  const inlineEditorRef = useRef<HTMLDivElement | null>(null);
  const inlineEditorFirstFieldRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);
  const editTitleRef = useRef<HTMLInputElement | null>(null);
  const editTimeRef = useRef<HTMLInputElement | null>(null);
  const editLocationRef = useRef<HTMLInputElement | null>(null);
  const editFlightAirlineRef = useRef<HTMLInputElement | null>(null);
  const editFlightNumberRef = useRef<HTMLInputElement | null>(null);
  const editFlightFromRef = useRef<HTMLInputElement | null>(null);
  const editFlightToRef = useRef<HTMLInputElement | null>(null);
  const editHotelNameRef = useRef<HTMLInputElement | null>(null);
  const editHotelCityRef = useRef<HTMLInputElement | null>(null);
  const editHotelCheckInRef = useRef<HTMLInputElement | null>(null);
  const editHotelCheckOutRef = useRef<HTMLInputElement | null>(null);
  const editMeetingEndRef = useRef<HTMLInputElement | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [filters, setFilters] = useState({ email: false, ai: false, maps: false, sharing: false, offline: false });
  const [offlineSort, setOfflineSort] = useState(false);
  const [tripCount, setTripCount] = useState("--");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripListState, setTripListState] = useState("Sign in to see trips associated with your account.");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [segmentState, setSegmentState] = useState("Select a trip to see flights, stays, meetings, and other itinerary items.");
  const [tripsLoading, setTripsLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripSaveError, setTripSaveError] = useState<string | null>(null);
  const [newSegKind, setNewSegKind] = useState("flight");
  const [newSegTitle, setNewSegTitle] = useState("");
  const [newSegTime, setNewSegTime] = useState("");
  const [newSegLocation, setNewSegLocation] = useState("");
  const [flightAirline, setFlightAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [flightFrom, setFlightFrom] = useState("");
  const [flightTo, setFlightTo] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelCity, setHotelCity] = useState("");
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [meetingEnd, setMeetingEnd] = useState("");
  const [savingSeg, setSavingSeg] = useState(false);
  const [segSaveError, setSegSaveError] = useState<string | null>(null);
  const [segInvalidField, setSegInvalidField] = useState<string | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editSegKind, setEditSegKind] = useState("flight");
  const [editSegTitle, setEditSegTitle] = useState("");
  const [editSegTime, setEditSegTime] = useState("");
  const [editSegLocation, setEditSegLocation] = useState("");
  const [editFlightAirline, setEditFlightAirline] = useState("");
  const [editFlightNumber, setEditFlightNumber] = useState("");
  const [editFlightFrom, setEditFlightFrom] = useState("");
  const [editFlightTo, setEditFlightTo] = useState("");
  const [editHotelName, setEditHotelName] = useState("");
  const [editHotelCity, setEditHotelCity] = useState("");
  const [editHotelCheckIn, setEditHotelCheckIn] = useState("");
  const [editHotelCheckOut, setEditHotelCheckOut] = useState("");
  const [editMeetingEnd, setEditMeetingEnd] = useState("");
  const [editingSegSaving, setEditingSegSaving] = useState(false);
  const [editingSegError, setEditingSegError] = useState<string | null>(null);
  const [editingSegInvalidField, setEditingSegInvalidField] = useState<string | null>(null);
  const [editModeAnnouncement, setEditModeAnnouncement] = useState("");
  const [editModeExitAnnouncement, setEditModeExitAnnouncement] = useState("");
  const [createSegmentAlertMessage, setCreateSegmentAlertMessage] = useState("");
  const [autosaveAnnouncement, setAutosaveAnnouncement] = useState("");
  const [autosaveErrorAnnouncement, setAutosaveErrorAnnouncement] = useState("");
  const [editAutosaveState, setEditAutosaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [editAutosaveError, setEditAutosaveError] = useState<string | null>(null);
  const [autosaveRetryCount, setAutosaveRetryCount] = useState(0);
  const [autosaveRetryNotice, setAutosaveRetryNotice] = useState("");
  const [lastSavedEditSignature, setLastSavedEditSignature] = useState("");
  const [autosaveTick, setAutosaveTick] = useState(0);
  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);
  const [confirmingDeleteSegmentId, setConfirmingDeleteSegmentId] = useState<string | null>(null);
  const [segmentActionMessage, setSegmentActionMessage] = useState<string | null>(null);
  const [autosaveToast, setAutosaveToast] = useState<string | null>(null);
  const [autosaveErrorToast, setAutosaveErrorToast] = useState<{ id: number; message: string } | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const filteredApps = useMemo(() => {
    const q = query.toLowerCase().trim();
    const data = apps.filter((app) => {
      const hay = [app.name, app.pricing, app.notes, app.ratings, app.offline].join(" ").toLowerCase();
      const compat = platform === "all" || (platform === "mobile" && mobileCapable(app)) || (platform === "desktop" && app.desktop);
      return compat &&
        (!filters.email || app.email) &&
        (!filters.ai || app.ai) &&
        (!filters.maps || app.maps) &&
        (!filters.sharing || app.sharing) &&
        (!filters.offline || offlineScore(app.offline) > 0) &&
        (!q || hay.includes(q));
    });
    return offlineSort ? [...data].sort((a, b) => offlineScore(b.offline) - offlineScore(a.offline)) : data;
  }, [filters, offlineSort, platform, query]);

  const groupedSegments = useMemo(() => {
    const groups = new Map<string, TripSegment[]>();

    for (const segment of segments) {
      const key = segment.start_time ? new Date(segment.start_time).toISOString().slice(0, 10) : "unscheduled";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(segment);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: key === "unscheduled" ? "Unscheduled" : formatDayLabel(items[0]?.start_time ?? null),
      items
    }));
  }, [segments]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId]
  );

  const fieldClassName =
    "rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#221d17] outline-none transition placeholder:text-[#9d9589] focus:border-[#ff385c] focus:bg-white";
  const createSegFieldErrorId = "create-segment-field-error";
  const editFieldErrorId = "edit-segment-field-error";

  function getCreateSegFieldErrorProps(field: string): { "aria-invalid"?: true; "aria-errormessage"?: string; "aria-describedby"?: string } {
    return segInvalidField === field
      ? { "aria-invalid": true, "aria-errormessage": createSegFieldErrorId, "aria-describedby": createSegFieldErrorId }
      : {};
  }

  function getEditFieldErrorProps(field: string): { "aria-invalid"?: true; "aria-errormessage"?: string; "aria-describedby"?: string } {
    return editingSegInvalidField === field
      ? { "aria-invalid": true, "aria-errormessage": editFieldErrorId, "aria-describedby": editFieldErrorId }
      : {};
  }

  function clearCreateSegFieldError(field: string) {
    if (segInvalidField === field) {
      setSegInvalidField(null);
      setSegSaveError(null);
    }
  }

  function clearEditSegFieldError(field: string) {
    if (editingSegInvalidField === field) {
      setEditingSegInvalidField(null);
      setEditingSegError(null);
    }
  }

  const segmentFormInvalid = useMemo(() => {
    if (!selectedTripId) return true;

    if (newSegKind === "flight") {
      return !flightAirline.trim() || !flightNumber.trim() || !flightFrom.trim() || !flightTo.trim() || !newSegTime;
    }

    if (newSegKind === "hotel") {
      return !hotelName.trim() || !hotelCity.trim() || !hotelCheckIn || !hotelCheckOut;
    }

    if (newSegKind === "meeting") {
      return !newSegTitle.trim() || !newSegTime;
    }

    return !newSegTitle.trim();
  }, [
    selectedTripId,
    newSegKind,
    newSegTitle,
    newSegTime,
    flightAirline,
    flightNumber,
    flightFrom,
    flightTo,
    hotelName,
    hotelCity,
    hotelCheckIn,
    hotelCheckOut
  ]);

  function getEditSignature() {
    return JSON.stringify({
      editingSegmentId,
      editSegKind,
      editSegTitle: editSegTitle.trim(),
      editSegTime,
      editSegLocation: editSegLocation.trim(),
      editFlightAirline: editFlightAirline.trim(),
      editFlightNumber: editFlightNumber.trim(),
      editFlightFrom: editFlightFrom.trim(),
      editFlightTo: editFlightTo.trim(),
      editHotelName: editHotelName.trim(),
      editHotelCity: editHotelCity.trim(),
      editHotelCheckIn,
      editHotelCheckOut,
      editMeetingEnd
    });
  }

  const editSegmentValid = useMemo(() => {
    if (!editingSegmentId) return false;

    if (editSegKind === "flight") {
      return !!(
        editFlightAirline.trim() &&
        editFlightNumber.trim() &&
        editFlightFrom.trim() &&
        editFlightTo.trim() &&
        editSegTime
      );
    }

    if (editSegKind === "hotel") {
      return !!(
        editHotelName.trim() &&
        editHotelCity.trim() &&
        editHotelCheckIn &&
        editHotelCheckOut
      );
    }

    if (editSegKind === "meeting") {
      return !!(editSegTitle.trim() && editSegTime);
    }

    return !!editSegTitle.trim();
  }, [
    editingSegmentId,
    editSegKind,
    editSegTitle,
    editSegTime,
    editFlightAirline,
    editFlightNumber,
    editFlightFrom,
    editFlightTo,
    editHotelName,
    editHotelCity,
    editHotelCheckIn,
    editHotelCheckOut
  ]);

  function toDateInputValue(value: string | null | undefined) {
    return value ? value.slice(0, 10) : "";
  }

  function toDateTimeLocalValue(value: string | null | undefined, hour = 9, minute = 0) {
    if (!value) return "";
    const d = new Date(value);
    d.setHours(hour, minute, 0, 0);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  async function loadTripsKpi() {
    setTripCount("...");
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      setTripCount("0");
      return;
    }
    const { data, error } = await sb.from("trips").select("id");
    if (error) {
      console.error("Error loading trips", error);
      setTripCount("-");
      return;
    }
    setTripCount(String(data.length));
  }

  async function loadTripSegments(tripId: string | null) {
    if (!tripId) {
      setSegments([]);
      setTimelineLoading(false);
      setSegmentState("Select a trip to see flights, stays, meetings, and other itinerary items.");
      return;
    }
    setTimelineLoading(true);
    setSegmentState("Loading itinerary...");
    setSegments([]);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      setTimelineLoading(false);
      setSegmentState("Sign in with email and password to see itinerary items.");
      return;
    }
    const { data, error } = await sb
      .from("trip_segments")
      .select("id, kind, title, start_time, end_time, location")
      .eq("trip_id", tripId)
      .order("start_time", { ascending: true });
    setTimelineLoading(false);
    if (error) {
      console.error("Error loading trip segments", error);
      setSegmentState("Could not load itinerary items.");
      return;
    }
    if (!data || data.length === 0) {
      setSegmentState("No itinerary items yet for this trip.");
      return;
    }
    setSegments(data as TripSegment[]);
    setSegmentState("");
  }

  async function loadTripsList() {
    setTripsLoading(true);
    setTripListState("Loading your trips...");
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      setTrips([]);
      setSelectedTripId(null);
      setSegments([]);
      setSegmentState("Select a trip to see flights, stays, meetings, and other itinerary items.");
      setTripListState("Sign in with email and password to see your trips.");
      setTripsLoading(false);
      return;
    }
    const { data, error } = await sb
      .from("trips")
      .select("id, name, destination, start_date, end_date")
      .order("start_date", { ascending: true });
    if (error) {
      console.error("Error loading trips", error);
      setTripListState("Could not load trips.");
      setTripsLoading(false);
      return;
    }
    const nextTrips = (data || []) as Trip[];
    setTrips(nextTrips);
    if (nextTrips.length === 0) {
      setSelectedTripId(null);
      setTripListState("No trips yet. Create one below to test Supabase inserts and RLS.");
      setTripsLoading(false);
      setSegments([]);
      setSegmentState("Select a trip to see flights, stays, meetings, and other itinerary items.");
      return;
    }
    const nextSelected = selectedTripId && nextTrips.some((trip) => trip.id === selectedTripId) ? selectedTripId : nextTrips[0].id;
    setSelectedTripId(nextSelected);
    setTripListState("");
    setTripsLoading(false);
  }

  function resetAuthedData() {
    setTripCount("0");
    setTrips([]);
    setSelectedTripId(null);
    setTripListState("Sign in with email and password to see your trips.");
    setSegments([]);
    setTimelineLoading(false);
    setTripSaveError(null);
    setSegSaveError(null);
    resetEditSegmentState(editingSegmentId ? "Inline edit mode closed." : undefined);
    setDeletingSegmentId(null);
    setConfirmingDeleteSegmentId(null);
    setSegmentActionMessage(null);
    setFeedbackOpen(false);
    setFeedbackRating(null);
    setFeedbackComment("");
    setFeedbackSaving(false);
    setFeedbackMessage(null);
    setSegmentState("Select a trip to see flights, stays, meetings, and other itinerary items.");
  }

  async function handleCreateTrip() {
    setTripSaveError(null);
    if (!newTripName.trim()) {
      setTripSaveError("Trip name is required.");
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      setTripSaveError("You need to be signed in to create a trip.");
      return;
    }
    setSavingTrip(true);
    const name = newTripName.trim();
    const { error } = await sb.from("trips").insert({
      user_id: session.user.id,
      name,
      destination: name,
      start_date: newTripStart || null,
      end_date: newTripEnd || null
    });
    setSavingTrip(false);
    if (error) {
      console.error("Error creating trip", error);
      setTripSaveError("Could not create trip.");
      return;
    }
    setNewTripName("");
    setNewTripStart("");
    setNewTripEnd("");
    await loadTripsKpi();
    await loadTripsList();
  }

  function announceCreateSegmentValidationError(message: string) {
    setCreateSegmentAlertMessage("");
    window.setTimeout(() => {
      setCreateSegmentAlertMessage(`Please fix the following error. ${message}`);
    }, 50);
  }

  function handleCreateSegmentValidationError(field: string, message: string) {
    setSegInvalidField(field);
    setSegSaveError(message);
    announceCreateSegmentValidationError(message);
    return false;
  }

  async function handleCreateSegment() {
    setSegInvalidField(null);
    setSegSaveError(null);
    setCreateSegmentAlertMessage("");
    if (!selectedTripId) {
      setSegSaveError("Select a trip first.");
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      setSegSaveError("You need to be signed in to add itinerary items.");
      return;
    }

    const kind = newSegKind;
    let title = newSegTitle.trim();
    let location = newSegLocation.trim() || null;
    let startTime: string | null = newSegTime || null;
    let endTime: string | null = null;

    if (kind === "flight") {
      if (!flightAirline.trim()) { handleCreateSegmentValidationError("flightAirline", "Airline is required."); return; }
      if (!flightNumber.trim()) { handleCreateSegmentValidationError("flightNumber", "Flight number is required."); return; }
      if (!flightFrom.trim()) { handleCreateSegmentValidationError("flightFrom", "Origin is required."); return; }
      if (!flightTo.trim()) { handleCreateSegmentValidationError("flightTo", "Destination is required."); return; }
      if (!newSegTime) { handleCreateSegmentValidationError("time", "Departure time is required."); return; }
      title = `${flightAirline.trim()} ${flightNumber.trim()} ${flightFrom.trim()} → ${flightTo.trim()}`;
      location = `${flightFrom.trim()} → ${flightTo.trim()}`;
      startTime = newSegTime;
    } else if (kind === "hotel") {
      if (!hotelName.trim()) { handleCreateSegmentValidationError("hotelName", "Hotel name is required."); return; }
      if (!hotelCity.trim()) { handleCreateSegmentValidationError("hotelCity", "City is required."); return; }
      if (!hotelCheckIn) { handleCreateSegmentValidationError("hotelCheckIn", "Check-in date is required."); return; }
      if (!hotelCheckOut) { handleCreateSegmentValidationError("hotelCheckOut", "Check-out date is required."); return; }
      title = hotelName.trim();
      location = hotelCity.trim();
      startTime = hotelCheckIn;
      endTime = hotelCheckOut || null;
    } else if (kind === "meeting") {
      if (!title) { handleCreateSegmentValidationError("title", "Meeting title is required."); return; }
      if (!newSegTime) { handleCreateSegmentValidationError("time", "Start time is required."); return; }
      startTime = newSegTime;
      endTime = meetingEnd || null;
    } else if (!title) {
      handleCreateSegmentValidationError("title", "Segment title is required.");
      return;
    }

    setSavingSeg(true);
    const { error } = await sb.from("trip_segments").insert({
      trip_id: selectedTripId,
      user_id: session.user.id,
      kind,
      title,
      start_time: startTime,
      end_time: endTime,
      location
    });
    setSavingSeg(false);
    if (error) {
      console.error("Error creating segment", error);
      setSegSaveError("Could not create itinerary item.");
      return;
    }
    setNewSegTitle("");
    setNewSegTime("");
    setNewSegLocation("");
    setSegInvalidField(null);
    setFlightAirline("");
    setFlightNumber("");
    setFlightFrom("");
    setFlightTo("");
    setHotelName("");
    setHotelCity("");
    setHotelCheckIn("");
    setHotelCheckOut("");
    setMeetingEnd("");
    await loadTripSegments(selectedTripId);
  }

  function announceEditModeExit(message: string) {
    setEditModeExitAnnouncement("");
    window.setTimeout(() => {
      setEditModeExitAnnouncement(message);
    }, 50);
  }

  function announceAutosaveSuccess(message = "Changes were automatically saved.") {
    setAutosaveAnnouncement("");
    window.setTimeout(() => {
      setAutosaveAnnouncement(message);
    }, 50);
  }

  function announceAutosaveError(message = "Automatic save failed. Your latest changes were not saved.") {
    setAutosaveErrorAnnouncement("");
    window.setTimeout(() => {
      setAutosaveErrorAnnouncement(message);
    }, 50);
  }

  function resetEditSegmentState(exitAnnouncement?: string) {
    const returnTarget = editTriggerRef.current;

    setEditingSegmentId(null);
    setEditSegKind("flight");
    setEditSegTitle("");
    setEditSegTime("");
    setEditSegLocation("");
    setEditFlightAirline("");
    setEditFlightNumber("");
    setEditFlightFrom("");
    setEditFlightTo("");
    setEditHotelName("");
    setEditHotelCity("");
    setEditHotelCheckIn("");
    setEditHotelCheckOut("");
    setEditMeetingEnd("");
    setEditingSegSaving(false);
    setEditingSegError(null);
    setEditingSegInvalidField(null);
    setEditModeAnnouncement("");
    setEditAutosaveState("idle");
    setEditAutosaveError(null);
    setAutosaveRetryCount(0);
    setAutosaveRetryNotice("");
    setAutosaveToast(null);
    setAutosaveErrorToast(null);
    if (autosaveToastTimeout.current) {
      window.clearTimeout(autosaveToastTimeout.current);
      autosaveToastTimeout.current = null;
    }
    setLastSavedEditSignature("");
    editTriggerRef.current = null;

    if (exitAnnouncement) {
      announceEditModeExit(exitAnnouncement);
    }

    window.requestAnimationFrame(() => {
      if (returnTarget && document.contains(returnTarget)) {
        returnTarget.focus();
      }
    });
  }

  function startEditingSegment(segment: TripSegment, trigger?: HTMLElement | null) {
    setEditingSegError(null);
    setEditingSegInvalidField(null);
    setEditModeAnnouncement("");
    setEditModeExitAnnouncement("");
    editTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setConfirmingDeleteSegmentId(null);
    setSegmentActionMessage(null);
    setEditAutosaveState("idle");
    setEditAutosaveError(null);
    setAutosaveRetryCount(0);
    setAutosaveRetryNotice("");
    setAutosaveToast(null);
    setAutosaveErrorToast(null);
    if (autosaveToastTimeout.current) {
      window.clearTimeout(autosaveToastTimeout.current);
      autosaveToastTimeout.current = null;
    }
    setEditingSegmentId(segment.id);
    skipNextEditKindReset.current = true;

    const kind = segment.kind || "activity";
    const title = segment.title || "";
    const time = segment.start_time ? segment.start_time.slice(0, 16) : "";
    const location = segment.location || "";
    let flightAirlineValue = "";
    let flightNumberValue = "";
    let flightFromValue = "";
    let flightToValue = "";
    let hotelNameValue = "";
    let hotelCityValue = "";
    let hotelCheckInValue = "";
    let hotelCheckOutValue = "";
    let meetingEndValue = "";

    if (kind === "flight") {
      const routeParts = location.split(" → ");
      const titleSansRoute = title.replace(location, "").trim();
      const titleParts = titleSansRoute.split(" ");
      flightAirlineValue = titleParts[0] || "";
      flightNumberValue = titleParts[1] || "";
      flightFromValue = routeParts[0] || "";
      flightToValue = routeParts[1] || "";
    } else if (kind === "hotel") {
      hotelNameValue = title;
      hotelCityValue = location;
      hotelCheckInValue = segment.start_time ? segment.start_time.slice(0, 10) : "";
      hotelCheckOutValue = segment.end_time ? segment.end_time.slice(0, 10) : "";
    } else if (kind === "meeting") {
      meetingEndValue = segment.end_time ? segment.end_time.slice(0, 16) : "";
    }

    setEditSegKind(kind);
    setEditSegTitle(title);
    setEditSegTime(time);
    setEditSegLocation(location);
    setEditFlightAirline(flightAirlineValue);
    setEditFlightNumber(flightNumberValue);
    setEditFlightFrom(flightFromValue);
    setEditFlightTo(flightToValue);
    setEditHotelName(hotelNameValue);
    setEditHotelCity(hotelCityValue);
    setEditHotelCheckIn(hotelCheckInValue);
    setEditHotelCheckOut(hotelCheckOutValue);
    setEditMeetingEnd(meetingEndValue);

    setLastSavedEditSignature(JSON.stringify({
      editingSegmentId: segment.id,
      editSegKind: kind,
      editSegTitle: title.trim(),
      editSegTime: time,
      editSegLocation: location.trim(),
      editFlightAirline: flightAirlineValue.trim(),
      editFlightNumber: flightNumberValue.trim(),
      editFlightFrom: flightFromValue.trim(),
      editFlightTo: flightToValue.trim(),
      editHotelName: hotelNameValue.trim(),
      editHotelCity: hotelCityValue.trim(),
      editHotelCheckIn: hotelCheckInValue,
      editHotelCheckOut: hotelCheckOutValue,
      editMeetingEnd: meetingEndValue
    }));
    setEditAutosaveState("saved");

    const label = title.trim() || "itinerary item";
    window.setTimeout(() => {
      setEditModeAnnouncement(`Editing ${label}. Inline edit mode is active.`);
    }, 50);
  }

  function dismissAutosaveToast() {
    setAutosaveToast(null);
    if (autosaveToastTimeout.current) {
      window.clearTimeout(autosaveToastTimeout.current);
      autosaveToastTimeout.current = null;
    }
  }

  function dismissAutosaveErrorToast() {
    setAutosaveErrorToast(null);
  }

  function rememberFocusedElement() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      lastFocusedElementRef.current = active;
    }
  }

  function restoreFocusAfterToastDismiss() {
    const target = lastFocusedElementRef.current;

    if (target && document.contains(target)) {
      window.requestAnimationFrame(() => {
        target.focus();
      });
      return;
    }

    const fallback = document.querySelector(
      "[data-segment-editor] input, [data-segment-editor] button, [data-segment-editor] select, [data-segment-editor] textarea"
    ) as HTMLElement | null;
    fallback?.focus();
  }

  function scrollAndFocusInvalidField(el: HTMLInputElement | null) {
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    window.setTimeout(() => {
      el.focus({ preventScroll: true });
    }, 180);
  }

  function focusFirstInvalidEditField() {
    if (editSegKind === "flight") {
      if (!editFlightAirline.trim()) return scrollAndFocusInvalidField(editFlightAirlineRef.current);
      if (!editFlightNumber.trim()) return scrollAndFocusInvalidField(editFlightNumberRef.current);
      if (!editFlightFrom.trim()) return scrollAndFocusInvalidField(editFlightFromRef.current);
      if (!editFlightTo.trim()) return scrollAndFocusInvalidField(editFlightToRef.current);
      if (!editSegTime) return scrollAndFocusInvalidField(editTimeRef.current);
      return;
    }

    if (editSegKind === "hotel") {
      if (!editHotelName.trim()) return scrollAndFocusInvalidField(editHotelNameRef.current);
      if (!editHotelCity.trim()) return scrollAndFocusInvalidField(editHotelCityRef.current);
      if (!editHotelCheckIn) return scrollAndFocusInvalidField(editHotelCheckInRef.current);
      if (!editHotelCheckOut) return scrollAndFocusInvalidField(editHotelCheckOutRef.current);
      return;
    }

    if (editSegKind === "meeting") {
      if (!editSegTitle.trim()) return scrollAndFocusInvalidField(editTitleRef.current);
      if (!editSegTime) return scrollAndFocusInvalidField(editTimeRef.current);
      return;
    }

    if (!editSegTitle.trim()) {
      scrollAndFocusInvalidField(editTitleRef.current);
    }
  }

  function handleEditValidationError(field: string, message: string, silent: boolean) {
    setEditingSegInvalidField(field);
    setEditingSegError(message);

    if (silent) {
      setEditAutosaveState("dirty");
      announceAutosaveError(`Automatic save failed. ${message}`);
      window.requestAnimationFrame(() => {
        focusFirstInvalidEditField();
      });
    }

    return false;
  }

  function dismissVisibleToasts({ restoreFocus = false } = {}) {
    dismissAutosaveToast();
    dismissAutosaveErrorToast();

    if (restoreFocus) {
      restoreFocusAfterToastDismiss();
    }
  }

  function showAutosaveToast(message: string) {
    setAutosaveToast(message);
    if (autosaveToastTimeout.current) {
      window.clearTimeout(autosaveToastTimeout.current);
    }
    autosaveToastTimeout.current = window.setTimeout(() => {
      dismissAutosaveToast();
    }, 2400);
  }

  async function handleUpdateSegment(options?: { silent?: boolean }) {
    if (!editingSegmentId) return false;

    const silent = options?.silent ?? false;

    setEditingSegError(null);
    setEditingSegInvalidField(null);

    if (!silent) {
      setSegmentActionMessage(null);
    }

    setEditAutosaveError(null);

    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      const message = "You need to be signed in to edit itinerary items.";
      if (silent) {
        setEditAutosaveState("error");
        setEditAutosaveError(message);
      } else {
        setEditingSegError(message);
      }
      return false;
    }

    const kind = editSegKind;
    let title = editSegTitle.trim();
    let location = editSegLocation.trim() || null;
    let startTime: string | null = editSegTime || null;
    let endTime: string | null = null;

    if (kind === "flight") {
      if (!editFlightAirline.trim()) return handleEditValidationError("flightAirline", "Airline is required.", silent);
      if (!editFlightNumber.trim()) return handleEditValidationError("flightNumber", "Flight number is required.", silent);
      if (!editFlightFrom.trim()) return handleEditValidationError("flightFrom", "Origin is required.", silent);
      if (!editFlightTo.trim()) return handleEditValidationError("flightTo", "Destination is required.", silent);
      if (!editSegTime) return handleEditValidationError("time", "Departure time is required.", silent);
      title = `${editFlightAirline.trim()} ${editFlightNumber.trim()} ${editFlightFrom.trim()} → ${editFlightTo.trim()}`;
      location = `${editFlightFrom.trim()} → ${editFlightTo.trim()}`;
      startTime = editSegTime;
    } else if (kind === "hotel") {
      if (!editHotelName.trim()) return handleEditValidationError("hotelName", "Hotel name is required.", silent);
      if (!editHotelCity.trim()) return handleEditValidationError("hotelCity", "City is required.", silent);
      if (!editHotelCheckIn) return handleEditValidationError("hotelCheckIn", "Check-in date is required.", silent);
      if (!editHotelCheckOut) return handleEditValidationError("hotelCheckOut", "Check-out date is required.", silent);
      title = editHotelName.trim();
      location = editHotelCity.trim();
      startTime = editHotelCheckIn;
      endTime = editHotelCheckOut;
    } else if (kind === "meeting") {
      if (!title) return handleEditValidationError("title", "Meeting title is required.", silent);
      if (!editSegTime) return handleEditValidationError("time", "Start time is required.", silent);
      startTime = editSegTime;
      endTime = editMeetingEnd || null;
    } else if (!title) {
      return handleEditValidationError("title", "Segment title is required.", silent);
    }

    const submittedSignature = getEditSignature();
    setEditingSegSaving(true);
    if (silent) setEditAutosaveState("saving");

    const { error } = await sb
      .from("trip_segments")
      .update({
        kind,
        title,
        start_time: startTime,
        end_time: endTime,
        location
      })
      .eq("id", editingSegmentId)
      .eq("user_id", session.user.id);

    setEditingSegSaving(false);

    if (error) {
      console.error("Error updating segment", error);

      if (silent) {
        const message = "Autosave failed. Retrying in the background.";
        setEditAutosaveState("error");
        setEditAutosaveError("Autosave failed. Your changes are still here.");
        announceAutosaveError("Automatic save failed. Your latest changes were not saved.");
        setAutosaveErrorToast({
          id: Date.now(),
          message
        });
        window.setTimeout(() => setAutosaveErrorToast(null), 4000);
      } else {
        setEditingSegError("Could not save changes.");
      }

      return false;
    }

    setLastSavedEditSignature(submittedSignature);

    if (silent) {
      const recoveredFromFailure = editAutosaveState === "error" || autosaveRetryCount > 0;

      setEditAutosaveState("saved");
      setEditAutosaveError(null);
      setAutosaveRetryCount(0);
      setAutosaveRetryNotice("");

      announceAutosaveSuccess();

      const now = Date.now();
      if (recoveredFromFailure || now - lastAutosaveToastAt.current > 10000) {
        showAutosaveToast(recoveredFromFailure ? "Autosave recovered. Changes saved." : "Changes saved");
        lastAutosaveToastAt.current = now;
      }

      await loadTripSegments(selectedTripId);
      return true;
    }

    resetEditSegmentState("Inline edit mode closed. Changes saved.");
    setSegmentActionMessage("Itinerary item updated.");
    await loadTripSegments(selectedTripId);
    return true;
  }

  async function handleDeleteSegment(segmentId: string) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;

    setSegmentActionMessage(null);
    setConfirmingDeleteSegmentId(null);
    setDeletingSegmentId(segmentId);

    const { error } = await sb
      .from("trip_segments")
      .delete()
      .eq("id", segmentId)
      .eq("user_id", session.user.id);

    setDeletingSegmentId(null);

    if (error) {
      console.error("Error deleting segment", error);
      return;
    }

    if (editingSegmentId === segmentId) {
      resetEditSegmentState("Inline edit mode closed. Itinerary item deleted.");
    }

    setSegmentActionMessage("Itinerary item deleted.");
    await loadTripSegments(selectedTripId);
  }

  async function handleSubmitFeedback() {
    setFeedbackMessage(null);

    if (!selectedTripId) {
      setFeedbackMessage("Select a trip before sending feedback.");
      return;
    }
    if (feedbackRating == null) {
      setFeedbackMessage("Pick a quick rating first.");
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      setFeedbackMessage("You need to be signed in to send feedback.");
      return;
    }

    setFeedbackSaving(true);
    const { error } = await sb.from("feedback").insert({
      user_id: session.user.id,
      trip_id: selectedTripId,
      rating: feedbackRating,
      comment: feedbackComment.trim() || null,
      context: "timeline"
    });
    setFeedbackSaving(false);

    if (error) {
      console.error("Error saving feedback", error);
      setFeedbackMessage("Could not send feedback. Please try again.");
      return;
    }

    setFeedbackRating(null);
    setFeedbackComment("");
    setFeedbackOpen(false);
    setFeedbackMessage("Thanks - feedback saved!");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("Email and password are required.");
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setSignedIn(true);
    await loadTripsKpi();
    await loadTripsList();
  }

  async function handleLogout() {
    setAuthError("");
    const { error } = await sb.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    setSignedIn(false);
    setPassword("");
    resetAuthedData();
  }

  useEffect(() => {
    const hasToast = Boolean(autosaveToast || autosaveErrorToast);
    if (!hasToast) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      rememberFocusedElement();

      event.preventDefault();
      event.stopPropagation();
      dismissVisibleToasts({ restoreFocus: true });
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [autosaveToast, autosaveErrorToast]);

  useEffect(() => {
    let active = true;
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      setSessionReady(true);
      if (session) {
        await loadTripsKpi();
        await loadTripsList();
      }
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      if (!session) {
        resetAuthedData();
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedTripId && signedIn) {
      loadTripSegments(selectedTripId);
    }
  }, [selectedTripId, signedIn]);

  useEffect(() => {
    if (!editingSegmentId) return;

    window.requestAnimationFrame(() => {
      inlineEditorFirstFieldRef.current?.focus();
    });
  }, [editingSegmentId]);

  useEffect(() => {
    setFeedbackOpen(false);
    setFeedbackRating(null);
    setFeedbackComment("");
    setFeedbackMessage(null);
    setSegmentActionMessage(null);
    resetEditSegmentState(editingSegmentId ? "Inline edit mode closed." : undefined);
    setDeletingSegmentId(null);
    setConfirmingDeleteSegmentId(null);
  }, [selectedTripId]);

  useEffect(() => {
    setSegSaveError(null);
    setSegInvalidField(null);
    setCreateSegmentAlertMessage("");

    setNewSegTitle("");
    setNewSegTime("");
    setNewSegLocation("");

    setFlightAirline("");
    setFlightNumber("");
    setFlightFrom("");
    setFlightTo("");

    setHotelName("");
    setHotelCity("");
    setHotelCheckIn("");
    setHotelCheckOut("");

    setMeetingEnd("");
  }, [newSegKind]);

  useEffect(() => {
    if (!editingSegmentId) return;
    if (skipNextEditKindReset.current) {
      skipNextEditKindReset.current = false;
      return;
    }

    setEditingSegError(null);

    setEditSegTitle("");
    setEditSegTime("");
    setEditSegLocation("");

    setEditFlightAirline("");
    setEditFlightNumber("");
    setEditFlightFrom("");
    setEditFlightTo("");

    setEditHotelName("");
    setEditHotelCity("");
    setEditHotelCheckIn("");
    setEditHotelCheckOut("");

    setEditMeetingEnd("");
  }, [editSegKind, editingSegmentId]);

  useEffect(() => {
    if (!segmentActionMessage) return;

    const timeout = window.setTimeout(() => {
      setSegmentActionMessage(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [segmentActionMessage]);

  useEffect(() => {
    if (!editingSegmentId) return;

    const nextSignature = getEditSignature();

    if (!editSegmentValid) {
      setEditAutosaveState("dirty");
      return;
    }

    if (nextSignature === lastSavedEditSignature) return;

    setEditAutosaveState("dirty");

    const timeout = window.setTimeout(async () => {
      const currentSignature = getEditSignature();
      if (currentSignature !== nextSignature) return;

      const ok = await handleUpdateSegment({ silent: true });
      if (ok) {
        setAutosaveTick((value) => value + 1);
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [
    editingSegmentId,
    editSegKind,
    editSegTitle,
    editSegTime,
    editSegLocation,
    editFlightAirline,
    editFlightNumber,
    editFlightFrom,
    editFlightTo,
    editHotelName,
    editHotelCity,
    editHotelCheckIn,
    editHotelCheckOut,
    editMeetingEnd,
    editSegmentValid,
    lastSavedEditSignature,
    selectedTripId
  ]);

  useEffect(() => {
    if (editAutosaveState !== "error") return;
    if (!editingSegmentId) return;
    if (autosaveRetryCount >= 3) {
      const message = "Autosave failed after multiple attempts. Please retry manually.";
      setAutosaveRetryNotice(message);
      setEditAutosaveError("Autosave failed after multiple attempts. Your changes are still here.");
      announceAutosaveError("Automatic save failed after multiple attempts. Please retry manually.");
      setAutosaveErrorToast({
        id: Date.now(),
        message
      });
      return;
    }

    const nextAttempt = autosaveRetryCount + 2;
    const totalAttempts = 4;
    const delay = autosaveRetryCount === 0 ? 800 : Math.min(800 * 2 ** autosaveRetryCount, 5000);

    setAutosaveRetryNotice(`Autosave failed. Retrying ${nextAttempt}/${totalAttempts} in ${Math.ceil(delay / 1000)}s...`);

    const timeout = window.setTimeout(async () => {
      setAutosaveRetryNotice(`Retrying autosave ${nextAttempt}/${totalAttempts}...`);

      const ok = await handleUpdateSegment({ silent: true });

      if (ok) {
        setAutosaveRetryNotice("Autosave recovered and changes were saved.");
        window.setTimeout(() => {
          setAutosaveRetryNotice("");
          setEditAutosaveState("saved");
        }, 1200);
        return;
      }

      setAutosaveRetryCount((count) => count + 1);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [editAutosaveState, autosaveRetryCount, editingSegmentId]);

  useEffect(() => {
    if (!editingSegmentId) return;
    if (editAutosaveState === "error" || editAutosaveState === "saved") {
      setAutosaveRetryCount(0);
    }
  }, [
    editingSegmentId,
    editSegKind,
    editSegTitle,
    editSegTime,
    editSegLocation,
    editFlightAirline,
    editFlightNumber,
    editFlightFrom,
    editFlightTo,
    editHotelName,
    editHotelCity,
    editHotelCheckIn,
    editHotelCheckOut,
    editMeetingEnd
  ]);

  useEffect(() => {
    if (!selectedTrip) return;

    if (newSegKind === "flight" && !newSegTime) {
      setNewSegTime(toDateTimeLocalValue(selectedTrip.start_date, 9, 0));
    }

    if (newSegKind === "meeting" && !newSegTime) {
      setNewSegTime(toDateTimeLocalValue(selectedTrip.start_date, 10, 0));
    }

    if (newSegKind === "hotel") {
      if (!hotelCheckIn) setHotelCheckIn(toDateInputValue(selectedTrip.start_date));
      if (!hotelCheckOut) setHotelCheckOut(toDateInputValue(selectedTrip.end_date));
    }
  }, [newSegKind, selectedTrip, newSegTime, hotelCheckIn, hotelCheckOut]);

  if (!sessionReady) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-[#221d17]">Loading...</main>;
  }

  if (!signedIn) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#221d17]">
        <div className="grid w-full max-w-sm gap-3">
          <DevBanner />
          <form className="grid gap-3 rounded-2xl border border-[#d7d0c2] bg-[#fcfbf7] p-6 shadow-panel" onSubmit={handleLogin}>
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="text-sm text-[#6f675c]">Use a Supabase Auth user to view your trips.</p>
          <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-bold" type="submit">Sign in</button>
            {authError ? <p className="text-sm font-semibold text-red-700">{authError}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {editModeAnnouncement}
    </div>
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {editModeExitAnnouncement}
    </div>
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {autosaveAnnouncement}
    </div>
    <div
      className="sr-only"
      role="alert"
      aria-atomic="true"
    >
      {createSegmentAlertMessage}
    </div>
    <div
      className="sr-only"
      role="alert"
      aria-atomic="true"
    >
      {autosaveErrorAnnouncement}
    </div>
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#221d17] md:px-6">
      <div className="mx-auto grid max-w-[1460px] gap-5">
        <DevBanner />
        <section className="grid gap-5 rounded-[28px] border border-black/10 bg-[#fcfbf7] p-6 shadow-panel lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid content-start gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">Interactive comparison dashboard</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">Choose the right travel itinerary app for planning, organizing, and using trips offline.</h1>
            <p className="max-w-3xl text-[#6f675c]">Compare travel planning apps side by side on email parsing, AI suggestions, maps, sharing, offline support, pricing, ratings, and mobile or desktop compatibility.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Trips in database" loading={tripsLoading} value={tripCount} />
              <Metric label="Email parsing" value={String(apps.filter((app) => app.email).length)} />
              <Metric label="AI suggestions" value={String(apps.filter((app) => app.ai).length)} />
              <Metric label="Offline-ready" value={String(apps.filter((app) => offlineScore(app.offline) > 0).length)} />
              <Metric label="Desktop compatible" value={String(apps.filter((app) => app.desktop).length)} />
            </div>
          </div>
          <div className="rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">How to use</p>
            <h2 className="mt-2 text-xl font-black">Filter by platform and must-have features</h2>
            <p className="mt-2 text-sm text-[#6f675c]">Use the controls to narrow the list to apps that fit your workflow.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold" type="button" onClick={() => setOfflineSort((value) => !value)}>Sort by offline strength</button>
              <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold" type="button" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="self-start rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel lg:sticky lg:top-4">
            <h2 className="text-xl font-black">Filters</h2>
            <div className="mt-4 grid gap-4">
              <label>Search<input type="search" placeholder="Search app, pricing, or notes" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <label>Compatibility<select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">All</option><option value="mobile">Mobile</option><option value="desktop">Desktop/Web</option></select></label>
              {([
                ["email", "Email parsing"],
                ["ai", "AI suggestions"],
                ["maps", "Maps"],
                ["sharing", "Sharing"],
                ["offline", "Offline support"]
              ] as const).map(([key, label]) => (
                <label className="flex items-center gap-3 rounded-2xl bg-[#efebe3] p-3" key={key}>
                  <input className="w-auto" type="checkbox" checked={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="overflow-auto rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel">
              <h2 className="text-xl font-black">Side-by-side table</h2>
              <p className="mt-1 text-sm text-[#6f675c]">{filteredApps.length} apps shown.</p>
              <table className="mt-4 min-w-[980px] text-sm">
                <thead><tr className="text-left"><th>App</th><th>Email</th><th>AI</th><th>Maps</th><th>Sharing</th><th>Offline</th><th>Pricing</th><th>Platforms</th><th>Ratings</th><th>Notes</th></tr></thead>
                <tbody>{filteredApps.map((app) => <tr className="border-t border-black/10" key={app.name}><td className="py-3 font-bold">{app.name}</td><BoolCell value={app.email} /><BoolCell value={app.ai} /><BoolCell value={app.maps} /><BoolCell value={app.sharing} /><td>{app.offline}</td><td>{app.pricing}</td><td>{app.platforms.join(", ")}</td><td>{app.ratings}</td><td>{app.notes}</td></tr>)}</tbody>
              </table>
            </section>

            <section className="rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel">
              <h2 className="text-xl font-black">Selection guidance</h2>
              <div className="mt-4 grid gap-3">{insights.map(([title, body]) => <article className="rounded-2xl border border-black/5 bg-[#efebe3] p-4" key={title}><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">Recommendation</p><h3 className="mt-1 font-black">{title}</h3><p className="mt-2 text-sm text-[#6f675c]">{body}</p></article>)}</div>
            </section>

            <section className="rounded-[28px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel">
              <h2 className="text-xl font-black">Your trips</h2>
              {tripListState ? <p className="mt-1 text-sm text-[#6f675c]">{tripListState}</p> : null}

              {selectedTrip ? (
                <section className="mt-4 overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <div className="relative h-44 bg-[linear-gradient(135deg,#ff385c_0%,#ff7a59_45%,#ffd3c8_100%)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_35%)]" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="inline-flex rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6a6158] backdrop-blur">
                        Current trip
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a8175]">
                        Selected itinerary
                      </p>
                      <h3 className="text-3xl font-black leading-tight text-[#221d17]">
                        {tripTitle(selectedTrip)}
                      </h3>
                      <p className="text-sm text-[#6f675c]">
                        {selectedTrip.start_date && selectedTrip.end_date
                          ? `${selectedTrip.start_date} → ${selectedTrip.end_date}`
                          : selectedTrip.start_date || selectedTrip.end_date || "Dates to be confirmed"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f6f3ee] px-3 py-2 text-xs font-semibold text-[#5f574d]">
                        {segments.length} plan{segments.length === 1 ? "" : "s"}
                      </span>
                      <button
                        className="rounded-full bg-[#ff385c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#e31c5f]"
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("add-plan-form");
                          el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Add plan
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="mt-4 grid max-w-md gap-3 rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Trip name</span>
                  <input className={fieldClassName} type="text" placeholder="e.g., Barcelona work trip" value={newTripName} onChange={(event) => setNewTripName(event.target.value)} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Start date</span>
                    <input className={fieldClassName} type="date" value={newTripStart} onChange={(event) => setNewTripStart(event.target.value)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">End date</span>
                    <input className={fieldClassName} type="date" value={newTripEnd} onChange={(event) => setNewTripEnd(event.target.value)} />
                  </label>
                </div>
                <button className="rounded-full bg-[#ff385c] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#e31c5f] disabled:cursor-not-allowed disabled:bg-[#f3b8c4]" disabled={savingTrip} type="button" onClick={handleCreateTrip}>
                  {savingTrip ? "Saving..." : "Add trip"}
                </button>
                {tripSaveError ? (
                  <p className="rounded-2xl bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b42346]">
                    {tripSaveError}
                  </p>
                ) : null}
              </div>

              {!tripsLoading && trips.length === 0 ? (
                <div className="mt-4 rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center shadow-[0_4px_18px_rgba(0,0,0,0.03)]">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f3ee] text-2xl">
                    🧳
                  </div>
                  <h3 className="text-lg font-black text-[#221d17]">Create your first trip</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#6f675c]">
                    Add a destination and dates to start building a clearer travel plan.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {tripsLoading && trips.length === 0 ? <><TripCardSkeleton /><TripCardSkeleton /></> : null}
                {!tripsLoading && trips.map((trip) => {
                  const selected = trip.id === selectedTripId;
                  const dateLabel = trip.start_date && trip.end_date ? `${trip.start_date} → ${trip.end_date}` : trip.start_date || trip.end_date || "Dates TBA";
                  return (
                    <button className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] border bg-white p-4 text-left shadow-[0_4px_18px_rgba(0,0,0,0.04)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${selected ? "border-[#ff385c]/30 ring-2 ring-[#ff385c]/10" : "border-black/5"}`} key={trip.id} type="button" onClick={() => setSelectedTripId(trip.id)}>
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">{dateLabel}</span>
                      <span><span className="block font-bold">{tripTitle(trip)}</span><span className="text-sm text-[#6f675c]">Tap to see full itinerary.</span></span>
                      {selected ? (
                        <span className="rounded-full bg-[#fff1f2] px-3 py-1 text-xs font-black text-[#d12f52]">
                          Current trip
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6">
                <h3 className="font-black">Itinerary timeline</h3>
                {segmentState && !(!timelineLoading && selectedTripId && segments.length === 0) ? (
                  <p className="mt-1 text-sm text-[#6f675c]">{segmentState}</p>
                ) : null}
                {segmentActionMessage ? (
                  <p className="mt-3 rounded-2xl bg-[#eef8f5] px-4 py-3 text-sm font-semibold text-[#0e6971]">
                    {segmentActionMessage}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-4">
                  {timelineLoading && segments.length === 0 ? (
                    <>
                      <SegmentSkeleton />
                      <SegmentSkeleton />
                    </>
                  ) : null}

                  {!timelineLoading && selectedTripId && segments.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center shadow-[0_4px_18px_rgba(0,0,0,0.03)]">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f2] text-2xl">
                        ✈️
                      </div>
                      <h4 className="text-lg font-black text-[#221d17]">No plans yet</h4>
                      <p className="mx-auto mt-2 max-w-md text-sm text-[#6f675c]">
                        Start building this trip with a flight, hotel, meeting, or activity.
                      </p>
                      <button
                        className="mt-4 rounded-full bg-[#ff385c] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e31c5f]"
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("add-plan-form");
                          el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Add first plan
                      </button>
                    </div>
                  ) : null}

                  {!timelineLoading && groupedSegments.map((group) => (
                    <div className="grid gap-3" key={group.key}>
                      <div className="sticky top-0 z-10 w-fit rounded-full bg-[#f1ede7] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#7a7166]">
                        {group.label}
                      </div>

                      <div className="grid gap-3">
                        {group.items.map((segment) => (
                          <article className="grid gap-3 sm:grid-cols-[108px_1fr]" key={segment.id}>
                            <div className="pt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">
                              {formatDateTime(segment.start_time)}
                              {segment.end_time ? (
                                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[#6f675c]">
                                  Ends {formatDateTime(segment.end_time)}
                                </span>
                              ) : null}
                            </div>

                            <div className="grid gap-3">
                              <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="grid gap-1">
                                    <span className="inline-flex w-fit rounded-full bg-[#fff1f2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d12f52]">
                                      {segment.kind || "item"}
                                    </span>
                                    <h4 className="text-base font-black text-[#221d17]">
                                      {segment.title || "Untitled segment"}
                                    </h4>
                                    {segment.location ? (
                                      <p className="text-sm text-[#6f675c]">{segment.location}</p>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="rounded-full border border-black/5 bg-[#faf7f2] px-3 py-1.5 text-xs font-semibold text-[#5f574d] transition hover:bg-[#f3eee7]"
                                      type="button"
                                      onClick={(event) => startEditingSegment(segment, event.currentTarget)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="rounded-full border border-[#ffd6dd] bg-[#fff1f2] px-3 py-1.5 text-xs font-semibold text-[#b42346] transition hover:bg-[#ffe4e8] disabled:cursor-not-allowed disabled:opacity-70"
                                      type="button"
                                      onClick={() => {
                                        resetEditSegmentState(editingSegmentId ? "Inline edit mode closed." : undefined);
                                        setConfirmingDeleteSegmentId(segment.id);
                                      }}
                                      disabled={deletingSegmentId === segment.id}
                                    >
                                      {deletingSegmentId === segment.id ? "Deleting..." : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {confirmingDeleteSegmentId === segment.id ? (
                                <div className="grid gap-3 rounded-[24px] border border-[#ffd6dd] bg-[#fffafb] p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b42346]">Confirm delete</p>
                                      <p className="mt-1 text-sm text-[#6f675c]">Delete this itinerary item?</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[#5f574d]"
                                        type="button"
                                        onClick={() => setConfirmingDeleteSegmentId(null)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="rounded-full border border-[#ffd6dd] bg-[#fff1f2] px-3 py-1.5 text-xs font-semibold text-[#b42346] transition hover:bg-[#ffe4e8] disabled:cursor-not-allowed disabled:opacity-70"
                                        type="button"
                                        onClick={() => handleDeleteSegment(segment.id)}
                                        disabled={deletingSegmentId === segment.id}
                                      >
                                        {deletingSegmentId === segment.id ? "Deleting..." : "Delete item"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {editingSegmentId === segment.id ? (
                                <div
                                  ref={inlineEditorRef}
                                  role="region"
                                  aria-labelledby={`segment-editor-title-${segment.id}`}
                                  data-segment-editor
                                  className="grid gap-3 rounded-[24px] border border-[#ffd6dd] bg-[#fffafb] p-4"
                                >
                                  <h3 id={`segment-editor-title-${segment.id}`} className="sr-only">
                                    Edit itinerary item
                                  </h3>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b42346]">
                                      Editing itinerary item
                                    </p>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                                    <label className="grid gap-1.5">
                                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Plan type</span>
                                      <select ref={(node) => { inlineEditorFirstFieldRef.current = node; }} className={fieldClassName} value={editSegKind} onChange={(event) => setEditSegKind(event.target.value)}>
                                        <option value="flight">Flight</option>
                                        <option value="hotel">Hotel</option>
                                        <option value="train">Train</option>
                                        <option value="meeting">Meeting</option>
                                        <option value="activity">Activity</option>
                                      </select>
                                    </label>

                                    {editSegKind === "flight" || editSegKind === "meeting" ? (
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">
                                          {editSegKind === "flight" ? "Departure time" : "Start time"}
                                        </span>
                                        <input ref={editTimeRef} className={fieldClassName} type="datetime-local" value={editSegTime} {...getEditFieldErrorProps("time")} onChange={(event) => { setEditSegTime(event.target.value); clearEditSegFieldError("time"); }} />
                                      </label>
                                    ) : editSegKind === "hotel" ? (
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Stay timing</span>
                                        <input className="rounded-2xl border border-black/10 bg-[#f6f1ea] px-4 py-3 text-sm text-[#8a8175]" disabled type="text" value="Use check-in/out dates below" />
                                      </label>
                                    ) : (
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Location</span>
                                        <input ref={editLocationRef} className={fieldClassName} type="text" value={editSegLocation} onChange={(event) => setEditSegLocation(event.target.value)} />
                                      </label>
                                    )}
                                  </div>

                                  {editSegKind === "flight" ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Airline</span>
                                        <input ref={editFlightAirlineRef} className={fieldClassName} type="text" value={editFlightAirline} {...getEditFieldErrorProps("flightAirline")} onChange={(event) => { setEditFlightAirline(event.target.value); clearEditSegFieldError("flightAirline"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Flight #</span>
                                        <input ref={editFlightNumberRef} className={fieldClassName} type="text" value={editFlightNumber} {...getEditFieldErrorProps("flightNumber")} onChange={(event) => { setEditFlightNumber(event.target.value); clearEditSegFieldError("flightNumber"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">From</span>
                                        <input ref={editFlightFromRef} className={fieldClassName} type="text" value={editFlightFrom} {...getEditFieldErrorProps("flightFrom")} onChange={(event) => { setEditFlightFrom(event.target.value); clearEditSegFieldError("flightFrom"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">To</span>
                                        <input ref={editFlightToRef} className={fieldClassName} type="text" value={editFlightTo} {...getEditFieldErrorProps("flightTo")} onChange={(event) => { setEditFlightTo(event.target.value); clearEditSegFieldError("flightTo"); }} />
                                      </label>
                                    </div>
                                  ) : null}

                                  {editSegKind === "hotel" ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Hotel name</span>
                                        <input ref={editHotelNameRef} className={fieldClassName} type="text" value={editHotelName} {...getEditFieldErrorProps("hotelName")} onChange={(event) => { setEditHotelName(event.target.value); clearEditSegFieldError("hotelName"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">City</span>
                                        <input ref={editHotelCityRef} className={fieldClassName} type="text" value={editHotelCity} {...getEditFieldErrorProps("hotelCity")} onChange={(event) => { setEditHotelCity(event.target.value); clearEditSegFieldError("hotelCity"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Check-in</span>
                                        <input ref={editHotelCheckInRef} className={fieldClassName} type="date" value={editHotelCheckIn} {...getEditFieldErrorProps("hotelCheckIn")} onChange={(event) => { setEditHotelCheckIn(event.target.value); clearEditSegFieldError("hotelCheckIn"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Check-out</span>
                                        <input ref={editHotelCheckOutRef} className={fieldClassName} type="date" value={editHotelCheckOut} {...getEditFieldErrorProps("hotelCheckOut")} onChange={(event) => { setEditHotelCheckOut(event.target.value); clearEditSegFieldError("hotelCheckOut"); }} />
                                      </label>
                                    </div>
                                  ) : null}

                                  {editSegKind === "meeting" ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="grid gap-1.5 md:col-span-2">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Meeting title</span>
                                        <input ref={editTitleRef} className={fieldClassName} type="text" value={editSegTitle} {...getEditFieldErrorProps("title")} onChange={(event) => { setEditSegTitle(event.target.value); clearEditSegFieldError("title"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Location</span>
                                        <input ref={editLocationRef} className={fieldClassName} type="text" value={editSegLocation} onChange={(event) => setEditSegLocation(event.target.value)} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">End time</span>
                                        <input ref={editMeetingEndRef} className={fieldClassName} type="datetime-local" value={editMeetingEnd} onChange={(event) => setEditMeetingEnd(event.target.value)} />
                                      </label>
                                    </div>
                                  ) : null}

                                  {editSegKind !== "flight" && editSegKind !== "hotel" && editSegKind !== "meeting" ? (
                                    <div className="grid gap-3">
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Title</span>
                                        <input ref={editTitleRef} className={fieldClassName} type="text" value={editSegTitle} {...getEditFieldErrorProps("title")} onChange={(event) => { setEditSegTitle(event.target.value); clearEditSegFieldError("title"); }} />
                                      </label>
                                      <label className="grid gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Location</span>
                                        <input ref={editLocationRef} className={fieldClassName} type="text" value={editSegLocation} onChange={(event) => setEditSegLocation(event.target.value)} />
                                      </label>
                                    </div>
                                  ) : null}

                                  {editingSegError ? (
                                    <p id={editFieldErrorId} className="rounded-2xl bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b42346]">
                                      {editingSegError}
                                    </p>
                                  ) : null}

                                  <div
                                    className="flex min-h-[20px] items-center gap-2 text-xs text-[#7d7468]"
                                    role="status"
                                    aria-live="polite"
                                    aria-atomic="true"
                                    key={autosaveTick}
                                  >
                                    {editAutosaveState === "saving" ? (
                                      <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d7d0c4] border-t-[#ff385c]" />
                                        <span>Saving...</span>
                                      </>
                                    ) : null}
                                    {editAutosaveState === "saved" ? <span>{autosaveRetryNotice || "Saved"}</span> : null}
                                    {editAutosaveState === "dirty" ? <span>Unsaved changes</span> : null}
                                    {editAutosaveState === "error" ? (
                                      <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#f1c7cd] border-t-[#b42318]" />
                                        <span>{autosaveRetryNotice || editAutosaveError || "Autosave failed. Retrying..."}</span>
                                      </>
                                    ) : null}
                                  </div>

                                  {editAutosaveState === "error" && autosaveRetryCount >= 3 ? (
                                    <div
                                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f1c7cd] bg-[#fff4f6] px-3 py-2 text-xs text-[#8a2230]"
                                    >
                                      <span>{editAutosaveError || "Autosave failed after multiple attempts. Your changes are still here."}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAutosaveRetryCount(0);
                                          setAutosaveRetryNotice("Retrying autosave 1/4...");
                                          void handleUpdateSegment({ silent: true });
                                        }}
                                        className="rounded-full border border-[#e7a8b3] bg-white px-3 py-1 font-semibold text-[#8a2230]"
                                        disabled={editingSegSaving}
                                      >
                                        {editingSegSaving ? "Retrying..." : "Retry save"}
                                      </button>
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className="rounded-full bg-[#ff385c] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e31c5f] disabled:cursor-not-allowed disabled:bg-[#f3b8c4]"
                                      type="button"
                                      onClick={() => handleUpdateSegment()}
                                      disabled={editingSegSaving}
                                    >
                                      {editingSegSaving ? "Saving..." : "Save changes"}
                                    </button>
                                    <button
                                      className="rounded-full border border-black/5 bg-white px-4 py-2.5 text-sm font-semibold text-[#5f574d]"
                                      type="button"
                                      onClick={() => resetEditSegmentState("Inline edit mode closed. Changes discarded.")}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  id="add-plan-form"
                  className="mt-6 grid max-w-2xl gap-4 rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
                >
                  <div className="grid gap-1">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">
                      Add to itinerary
                    </p>
                    <h4 className="text-xl font-black text-[#221d17]">Create a new plan</h4>
                    <p className="text-sm text-[#6f675c]">
                      Add flights, stays, meetings, and activities to the selected trip.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Segment type</span>
                      <select className={fieldClassName} value={newSegKind} onChange={(event) => setNewSegKind(event.target.value)}>
                        <option value="flight">Flight</option>
                        <option value="hotel">Hotel</option>
                        <option value="train">Train</option>
                        <option value="meeting">Meeting</option>
                        <option value="activity">Activity</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">
                        {newSegKind === "flight" ? "Departure" : newSegKind === "meeting" ? "Meeting start" : "Start time"}
                      </span>
                      {newSegKind === "hotel" ? (
                        <input className="rounded-2xl border border-black/10 bg-[#f6f1ea] px-4 py-3 text-sm text-[#8a8175]" disabled type="text" value="Use check-in/out dates below" />
                      ) : (
                        <input className={fieldClassName} type="datetime-local" value={newSegTime} {...getCreateSegFieldErrorProps("time")} onChange={(event) => { setNewSegTime(event.target.value); clearCreateSegFieldError("time"); }} />
                      )}
                    </label>
                  </div>

                  {newSegKind === "flight" ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Airline</span>
                          <input className={fieldClassName} type="text" placeholder="e.g., AA" value={flightAirline} {...getCreateSegFieldErrorProps("flightAirline")} onChange={(event) => { setFlightAirline(event.target.value); clearCreateSegFieldError("flightAirline"); }} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Flight number</span>
                          <input className={fieldClassName} type="text" placeholder="e.g., 1123" value={flightNumber} {...getCreateSegFieldErrorProps("flightNumber")} onChange={(event) => { setFlightNumber(event.target.value); clearCreateSegFieldError("flightNumber"); }} />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">From</span>
                          <input className={fieldClassName} type="text" placeholder="e.g., MIA" value={flightFrom} {...getCreateSegFieldErrorProps("flightFrom")} onChange={(event) => { setFlightFrom(event.target.value); clearCreateSegFieldError("flightFrom"); }} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">To</span>
                          <input className={fieldClassName} type="text" placeholder="e.g., BCN" value={flightTo} {...getCreateSegFieldErrorProps("flightTo")} onChange={(event) => { setFlightTo(event.target.value); clearCreateSegFieldError("flightTo"); }} />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {newSegKind === "hotel" ? (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Hotel name</span>
                        <input className={fieldClassName} type="text" placeholder="e.g., Hotel Alma" value={hotelName} {...getCreateSegFieldErrorProps("hotelName")} onChange={(event) => { setHotelName(event.target.value); clearCreateSegFieldError("hotelName"); }} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">City</span>
                        <input className={fieldClassName} type="text" placeholder="e.g., Barcelona" value={hotelCity} {...getCreateSegFieldErrorProps("hotelCity")} onChange={(event) => { setHotelCity(event.target.value); clearCreateSegFieldError("hotelCity"); }} />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Check-in</span>
                          <input className={fieldClassName} type="date" value={hotelCheckIn} {...getCreateSegFieldErrorProps("hotelCheckIn")} onChange={(event) => { setHotelCheckIn(event.target.value); clearCreateSegFieldError("hotelCheckIn"); }} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Check-out</span>
                          <input className={fieldClassName} type="date" value={hotelCheckOut} {...getCreateSegFieldErrorProps("hotelCheckOut")} onChange={(event) => { setHotelCheckOut(event.target.value); clearCreateSegFieldError("hotelCheckOut"); }} />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {newSegKind === "meeting" ? (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Meeting title</span>
                        <input className={fieldClassName} type="text" placeholder="e.g., Client kickoff" value={newSegTitle} {...getCreateSegFieldErrorProps("title")} onChange={(event) => { setNewSegTitle(event.target.value); clearCreateSegFieldError("title"); }} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Meeting location</span>
                        <input className={fieldClassName} type="text" placeholder="e.g., Eixample office or Zoom link" value={newSegLocation} onChange={(event) => setNewSegLocation(event.target.value)} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Meeting end</span>
                        <input className={fieldClassName} type="datetime-local" value={meetingEnd} onChange={(event) => setMeetingEnd(event.target.value)} />
                      </label>
                    </>
                  ) : null}

                  {newSegKind !== "flight" && newSegKind !== "hotel" && newSegKind !== "meeting" ? (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Segment title</span>
                        <input className={fieldClassName} type="text" placeholder="e.g., Dinner reservation" value={newSegTitle} {...getCreateSegFieldErrorProps("title")} onChange={(event) => { setNewSegTitle(event.target.value); clearCreateSegFieldError("title"); }} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a7974]">Location</span>
                        <input className={fieldClassName} type="text" placeholder="Optional" value={newSegLocation} onChange={(event) => setNewSegLocation(event.target.value)} />
                      </label>
                    </>
                  ) : null}

                  <button className="mt-2 rounded-full bg-[#ff385c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e31c5f] disabled:cursor-not-allowed disabled:bg-[#f3b8c4]" disabled={savingSeg || segmentFormInvalid} type="button" onClick={handleCreateSegment}>
                    {savingSeg ? "Saving..." : "Add plan"}
                  </button>
                  {segSaveError ? (
                    <p id={segInvalidField ? createSegFieldErrorId : undefined} className="rounded-2xl bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b42346]">
                      {segSaveError}
                    </p>
                  ) : null}
                </div>

                <hr className="mt-6 border-t border-black/5" />

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className="self-start rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#01696f] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedTripId}
                    type="button"
                    onClick={() => setFeedbackOpen((value) => !value)}
                  >
                    {selectedTripId ? "Help us improve this trip" : "Select a trip to leave feedback"}
                  </button>

                  {feedbackOpen && selectedTripId ? (
                    <div className="max-w-md rounded-2xl border border-black/5 bg-[#f9f6f0] p-3 text-sm">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#7a7974]">Quick feedback</p>
                      <p className="mb-3 text-sm text-[#49463b]">How well did this timeline help you understand your trip?</p>

                      <div className="mb-3 flex gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            className={`h-7 w-7 rounded-full border text-xs font-medium transition ${feedbackRating === rating ? "border-[#01696f] bg-[#01696f] text-white" : "border-black/10 bg-white text-[#49463b]"}`}
                            key={rating}
                            type="button"
                            onClick={() => setFeedbackRating(rating)}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>

                      <textarea
                        className="w-full rounded-xl border border-black/10 bg-white p-2 text-sm"
                        placeholder="Optional: what felt confusing or missing?"
                        rows={3}
                        value={feedbackComment}
                        onChange={(event) => setFeedbackComment(event.target.value)}
                      />

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={feedbackSaving}
                          type="button"
                          onClick={handleSubmitFeedback}
                        >
                          {feedbackSaving ? "Sending..." : "Send feedback"}
                        </button>
                        {feedbackMessage ? <p className="text-xs text-[#7a7974]">{feedbackMessage}</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {!feedbackOpen && feedbackMessage ? <p className="text-xs text-[#7a7974]">{feedbackMessage}</p> : null}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
    {autosaveToast ? (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div
          className="rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm text-[#1f5133] shadow-lg backdrop-blur"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p>{autosaveToast}</p>
            </div>
            <button
              type="button"
              onClick={dismissAutosaveToast}
              className="rounded-full p-1 text-emerald-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Dismiss autosave success notification (Escape)"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {autosaveErrorToast ? (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div
          className="rounded-2xl border border-rose-200 bg-white/95 px-4 py-3 text-sm text-[#7a1022] shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
              !
            </span>
            <div className="min-w-0 flex-1">
              <p>{autosaveErrorToast.message}</p>
            </div>
            <button
              type="button"
              onClick={dismissAutosaveErrorToast}
              className="rounded-full p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
              aria-label="Dismiss autosave error notification (Escape)"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function DevBanner() {
  return (
    <aside className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Dev-only Supabase prototype. Use /dashboard for the main Wayline dashboard.
    </aside>
  );
}

function Metric({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return <article className="rounded-2xl border border-black/5 bg-[#efebe3] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">{label}</p>{loading ? <KpiSkeleton /> : <p className="mt-1 text-2xl font-black">{value}</p>}</article>;
}

function BoolCell({ value }: { value: boolean }) {
  return <td className={value ? "font-bold text-green-700" : "font-bold text-orange-700"}>{value ? "Yes" : "No"}</td>;
}
