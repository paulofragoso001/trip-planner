"use client";

import { useEffect } from "react";
import { reportPanelError } from "@/lib/panel-error-reporting";

export function DashboardPanelErrorListener() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const message = event.message || event.error?.message || "";

      if (!looksLikeChunkOrPanelError(message, event.filename)) return;

      reportPanelError({
        message: message || "Dashboard chunk failed to load.",
        name: event.error?.name,
        panelName: inferPanelName(event.filename, message),
        source: "global-error",
        stack: event.error?.stack,
        url: event.filename || window.location.href
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled dashboard panel rejection.";

      if (!looksLikeChunkOrPanelError(message)) return;

      reportPanelError({
        message,
        name: reason instanceof Error ? reason.name : undefined,
        panelName: inferPanelName(undefined, message),
        source: "unhandled-rejection",
        stack: reason instanceof Error ? reason.stack : undefined
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

function looksLikeChunkOrPanelError(message: string, filename?: string) {
  const value = `${message} ${filename || ""}`.toLowerCase();

  return (
    value.includes("chunk") ||
    value.includes("loading css chunk") ||
    value.includes("failed to fetch dynamically imported module") ||
    value.includes("locationautocomplete") ||
    value.includes("timeline-import") ||
    value.includes("flight-status") ||
    value.includes("trip-map") ||
    value.includes("tripmap")
  );
}

function inferPanelName(filename?: string, message = "") {
  const value = `${filename || ""} ${message}`.toLowerCase();

  if (value.includes("locationautocomplete") || value.includes("location-autocomplete")) {
    return "Location autocomplete";
  }

  if (value.includes("timeline-import")) {
    return "Itinerary and import panel";
  }

  if (value.includes("flight-status") || value.includes("flight-panel")) {
    return "Flight status panel";
  }

  if (value.includes("trip-map") || value.includes("tripmap") || value.includes("map-panel")) {
    return "Trip map panel";
  }

  return "Dashboard panel chunk";
}
