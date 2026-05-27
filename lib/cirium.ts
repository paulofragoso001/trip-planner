import "server-only";

export type NormalizedFlightStatus = {
  id: string;
  airline: string | null;
  flightNumber: string | null;
  status: string;
  scheduledDeparture: string | null;
  estimatedDeparture: string | null;
  actualDeparture: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  currentPosition: FlightMapPoint | null;
  departurePosition: FlightMapPoint | null;
  arrivalPosition: FlightMapPoint | null;
  lastUpdated: string;
};

export type FlightMapPoint = {
  lat: number;
  lng: number;
  altitude: number | null;
  bearing: number | null;
  speed: number | null;
  timestamp: string | null;
  label: string | null;
};

export type NormalizedFlightAlert = {
  type: "delay" | "gate_change" | "terminal_change" | "schedule_change" | "cancellation";
  message: string;
};

export type NormalizedCiriumStatus = {
  flight: NormalizedFlightStatus | null;
  alerts: NormalizedFlightAlert[];
};

export type NormalizedCiriumTrack = {
  position: FlightMapPoint | null;
  route: FlightMapPoint[];
  lastUpdated: string;
};

type CiriumLookupInput = {
  carrier: string;
  flightNumber: string;
  year: string;
  month: string;
  day: string;
};

const ciriumCache = new Map<
  string,
  { expiresAt: number; status: NormalizedCiriumStatus }
>();
const ciriumTrackCache = new Map<
  string,
  { expiresAt: number; track: NormalizedCiriumTrack }
>();
const ciriumCacheTtlMs = 60_000;
const ciriumTrackCacheTtlMs = 15_000;

export async function fetchCiriumFlightStatus({
  carrier,
  flightNumber,
  year,
  month,
  day
}: CiriumLookupInput): Promise<NormalizedCiriumStatus> {
  const appId = process.env.CIRIUM_APP_ID;
  const appKey = process.env.CIRIUM_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("Cirium credentials are not configured.");
  }

  const cacheKey = [carrier, flightNumber, year, month, day].join(":").toUpperCase();
  const cached = ciriumCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }

  const statusUrl = buildCiriumFlightUrl("status", {
    appId,
    appKey,
    carrier,
    flightNumber,
    year,
    month,
    day
  });
  const trackUrl = buildCiriumFlightUrl("track", {
    appId,
    appKey,
    carrier,
    flightNumber,
    year,
    month,
    day
  });

  const [statusResponse, trackResponse] = await Promise.all([
    fetch(statusUrl, { cache: "no-store" }),
    fetch(trackUrl, { cache: "no-store" })
  ]);
  const data = await statusResponse.json();
  const trackData = trackResponse.ok ? await trackResponse.json() : null;

  if (!statusResponse.ok) {
    throw new Error(data?.error?.errorMessage || `Cirium lookup failed: ${statusResponse.status}`);
  }

  const status = normalizeCiriumStatus(data, trackData);
  ciriumCache.set(cacheKey, {
    expiresAt: Date.now() + ciriumCacheTtlMs,
    status
  });

  return status;
}

export async function fetchCiriumFlightTrack({
  carrier,
  flightNumber,
  year,
  month,
  day
}: CiriumLookupInput): Promise<NormalizedCiriumTrack> {
  const appId = process.env.CIRIUM_APP_ID;
  const appKey = process.env.CIRIUM_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("Cirium credentials are not configured.");
  }

  const cacheKey = [carrier, flightNumber, year, month, day, "track"]
    .join(":")
    .toUpperCase();
  const cached = ciriumTrackCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.track;
  }

  const url = buildCiriumFlightUrl("track", {
    appId,
    appKey,
    carrier,
    flightNumber,
    year,
    month,
    day
  });
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.errorMessage || `Cirium track lookup failed: ${response.status}`);
  }

  const track = normalizeCiriumTrack(data);
  ciriumTrackCache.set(cacheKey, {
    expiresAt: Date.now() + ciriumTrackCacheTtlMs,
    track
  });

  return track;
}

function buildCiriumFlightUrl(
  mode: "status" | "track",
  {
    appId,
    appKey,
    carrier,
    flightNumber,
    year,
    month,
    day
  }: CiriumLookupInput & { appId: string; appKey: string }
) {
  const url = new URL(
    `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/${mode}/${encodeURIComponent(
      carrier
    )}/${encodeURIComponent(flightNumber)}/dep/${encodeURIComponent(year)}/${encodeURIComponent(
      month
    )}/${encodeURIComponent(day)}`
  );

  url.searchParams.set("appId", appId);
  url.searchParams.set("appKey", appKey);
  url.searchParams.set("utc", "false");

  return url;
}

export function normalizeCiriumStatus(
  data: unknown,
  trackData: unknown = null
): NormalizedCiriumStatus {
  const root = asRecord(data);
  const trackRoot = asRecord(trackData);
  const flight = Array.isArray(root.flightStatuses)
    ? asRecord(root.flightStatuses[0])
    : null;

  if (!flight) {
    return { flight: null, alerts: [] };
  }

  const operationalTimes = asRecord(flight.operationalTimes);
  const airportResources = asRecord(flight.airportResources);
  const departureAirport = readString(flight.departureAirportFsCode);
  const arrivalAirport = readString(flight.arrivalAirportFsCode);
  const airline = readString(flight.carrierFsCode);
  const flightNumberOnly = readString(flight.flightNumber);
  const scheduledDeparture = readCiriumDate(operationalTimes.scheduledGateDeparture);
  const estimatedDeparture = readCiriumDate(operationalTimes.estimatedGateDeparture);
  const actualDeparture = readCiriumDate(operationalTimes.actualGateDeparture);
  const scheduledArrival = readCiriumDate(operationalTimes.scheduledGateArrival);
  const estimatedArrival = readCiriumDate(operationalTimes.estimatedGateArrival);
  const actualArrival = readCiriumDate(operationalTimes.actualGateArrival);
  const status = mapCiriumStatus(readString(flight.status));
  const normalizedFlight: NormalizedFlightStatus = {
    id: [
      airline,
      flightNumberOnly,
      scheduledDeparture || estimatedDeparture || actualDeparture
    ]
      .filter(Boolean)
      .join("-"),
    airline,
    flightNumber:
      airline && flightNumberOnly ? `${airline}${flightNumberOnly}` : flightNumberOnly,
    status,
    scheduledDeparture,
    estimatedDeparture,
    actualDeparture,
    scheduledArrival,
    estimatedArrival,
    actualArrival,
    departureTerminal: readString(airportResources.departureTerminal),
    departureGate: readString(airportResources.departureGate),
    arrivalTerminal: readString(airportResources.arrivalTerminal),
    arrivalGate: readString(airportResources.arrivalGate),
    departureAirport,
    arrivalAirport,
    currentPosition: readFlightPosition(root, flight, trackRoot),
    departurePosition: readAirportPosition(root, departureAirport, departureAirport),
    arrivalPosition: readAirportPosition(root, arrivalAirport, arrivalAirport),
    lastUpdated: new Date().toISOString()
  };

  return {
    flight: normalizedFlight,
    alerts: deriveCiriumAlerts(normalizedFlight)
  };
}

export function normalizeCiriumTrack(data: unknown): NormalizedCiriumTrack {
  const root = asRecord(data);
  const track = Array.isArray(root.flightTracks)
    ? asRecord(root.flightTracks[0])
    : asRecord(root.flightTrack);
  const position = readFlightPosition({}, {}, root);
  const route = readTrackRoute(track, position);

  return {
    position,
    route,
    lastUpdated: position?.timestamp || new Date().toISOString()
  };
}

export function mapCiriumStatus(status?: string | null) {
  if (status === "C") return "cancelled";
  if (status === "A") return "departed";
  if (status === "L") return "arrived";
  if (status === "D") return "departed";
  if (status === "DN") return "delayed";
  return "scheduled";
}

function deriveCiriumAlerts(flight: NormalizedFlightStatus): NormalizedFlightAlert[] {
  const alerts: NormalizedFlightAlert[] = [];

  if (flight.status === "cancelled") {
    alerts.push({
      type: "cancellation",
      message: `${flight.flightNumber || "Flight"} was cancelled.`
    });
  }

  if (
    flight.estimatedDeparture &&
    flight.scheduledDeparture &&
    flight.estimatedDeparture !== flight.scheduledDeparture
  ) {
    alerts.push({
      type: "schedule_change",
      message: `${flight.flightNumber || "Flight"} departure changed to ${flight.estimatedDeparture}.`
    });
  }

  if (flight.departureGate) {
    alerts.push({
      type: "gate_change",
      message: `${flight.flightNumber || "Flight"} now departs from gate ${flight.departureGate}.`
    });
  }

  if (flight.departureTerminal) {
    alerts.push({
      type: "terminal_change",
      message: `${flight.flightNumber || "Flight"} now departs from terminal ${flight.departureTerminal}.`
    });
  }

  return alerts;
}

function readCiriumDate(value: unknown) {
  const record = asRecord(value);
  return readString(record.dateLocal) || readString(record.dateUtc) || null;
}

function readFlightPosition(
  root: Record<string, unknown>,
  flight: Record<string, unknown>,
  trackRoot: Record<string, unknown>
) {
  const track = Array.isArray(trackRoot.flightTracks)
    ? asRecord(trackRoot.flightTracks[0])
    : asRecord(trackRoot.flightTrack);
  const candidates = [
    track.position,
    firstArrayItem(track.positions),
    track,
    flight.position,
    flight.currentPosition,
    asRecord(flight.flightTrack).position,
    firstArrayItem(asRecord(flight.flightTrack).positions),
    firstArrayItem(flight.positions),
    asRecord(flight.track).position,
    firstArrayItem(asRecord(flight.track).positions),
    root.flightTrack,
    firstArrayItem(root.flightTracks),
    firstArrayItem(root.positions)
  ];

  return readMapPoint(candidates, "Current flight position");
}

function readAirportPosition(
  root: Record<string, unknown>,
  airportCode: string | null,
  label: string | null
) {
  if (!airportCode) {
    return null;
  }

  const airports = [
    ...readArray(asRecord(root.appendix).airports),
    ...readArray(root.airports)
  ].map(asRecord);
  const airport = airports.find((candidate) => {
    const codes = [
      candidate.fs,
      candidate.fsCode,
      candidate.iata,
      candidate.iataCode,
      candidate.airportFsCode
    ]
      .map(readString)
      .filter(Boolean);

    return codes.includes(airportCode);
  });

  return readMapPoint([airport], label);
}

function readMapPoint(
  candidates: unknown[],
  label: string | null
): FlightMapPoint | null {
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    const nestedPosition = asRecord(record.position);
    const nestedLocation = asRecord(record.location);
    const lat = firstNumber(
      record.lat,
      record.latitude,
      nestedPosition.lat,
      nestedPosition.latitude,
      nestedLocation.lat,
      nestedLocation.latitude
    );
    const lng = firstNumber(
      record.lng,
      record.lon,
      record.longitude,
      nestedPosition.lng,
      nestedPosition.lon,
      nestedPosition.longitude,
      nestedLocation.lng,
      nestedLocation.lon,
      nestedLocation.longitude
    );

    if (lat === null || lng === null) {
      continue;
    }

    return {
      lat,
      lng,
      altitude: firstNumber(record.altitude, nestedPosition.altitude),
      bearing: firstNumber(record.bearing, record.heading, nestedPosition.bearing, nestedPosition.heading),
      speed: firstNumber(record.speed, record.groundSpeed, nestedPosition.speed),
      timestamp:
        readString(record.timestamp) ||
        readString(record.updatedAt) ||
        readString(record.lastUpdated) ||
        readCiriumDate(record),
      label
    };
  }

  return null;
}

function readTrackRoute(
  track: Record<string, unknown>,
  position: FlightMapPoint | null
) {
  const points = [
    ...readArray(track.waypoints),
    ...readArray(track.positions),
    ...readArray(track.route)
  ]
    .map((point, index) => readMapPoint([point], `Track point ${index + 1}`))
    .filter(isFlightMapPoint);

  if (position && !points.some((point) => samePoint(point, position))) {
    points.push(position);
  }

  return points;
}

function isFlightMapPoint(point: FlightMapPoint | null): point is FlightMapPoint {
  return Boolean(point);
}

function samePoint(first: FlightMapPoint, second: FlightMapPoint) {
  return first.lat === second.lat && first.lng === second.lng;
}

function firstArrayItem(value: unknown) {
  const items = readArray(value);
  return items[0] ?? null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = readNumber(value);
    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
