export type AlmidyCoordinate = {
  lat: number;
  lng: number;
};

export type AlmidyMapMode =
  | "globe"
  | "satellite"
  | "map"
  | "route"
  | "launch-globe"
  | "country-map"
  | "trip-map"
  | "route-map"
  | "place-picker"
  | "stats";

export type AlmidyMapRenderer = "google-2d" | "google-3d" | "custom-globe";

export type AlmidyMapCameraIntent =
  | "world"
  | "user-location"
  | "country"
  | "trip"
  | "route"
  | "place"
  | "selection";

export type AlmidyMapCamera = {
  center: AlmidyCoordinate;
  intent: AlmidyMapCameraIntent;
  altitudeMeters?: number | null;
  bounds?: AlmidyMapBounds | null;
  heading?: number | null;
  pitch?: number | null;
  rangeMeters?: number | null;
  selectedId?: string | null;
  tilt?: number | null;
  zoom?: number | null;
};

export type AlmidyMapCameraCommandType =
  | "focusUserLocation"
  | "focusCountry"
  | "focusTrip"
  | "focusRoute"
  | "zoomToWorld"
  | "openFlatMap";

export type AlmidyMapCameraPadding = {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
};

export type AlmidyMapCameraCommand = {
  camera: AlmidyMapCamera;
  id: string;
  type: AlmidyMapCameraCommandType;
  bounds?: AlmidyMapBounds | null;
  coordinates?: AlmidyCoordinate[];
  durationMs?: number | null;
  label?: string | null;
  mode?: AlmidyMapMode | null;
  padding?: AlmidyMapCameraPadding | null;
  pinId?: string | null;
  routeId?: string | null;
  tripId?: string | null;
};

export type AlmidyMapBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type AlmidyLocationPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable";

export type AlmidyLocationState = {
  coordinate: AlmidyCoordinate | null;
  permission: AlmidyLocationPermissionState;
  accuracyMeters?: number | null;
  city?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  error?: string | null;
  label?: string | null;
  locatedAt?: string | null;
  source: "browser" | "account" | "trip" | "locale" | "timezone" | "fallback";
};

export type AlmidyMapPinKind =
  | "user-location"
  | "country"
  | "trip"
  | "place"
  | "route-endpoint"
  | "route-waypoint"
  | "transport"
  | "idea";

export type AlmidyMapPinTone =
  | "blue"
  | "emerald"
  | "orange"
  | "purple"
  | "slate"
  | "white";

export type AlmidyMapPin = {
  id: string;
  coordinate: AlmidyCoordinate;
  kind: AlmidyMapPinKind;
  label: string;
  address?: string | null;
  countryCode?: string | null;
  flag?: string | null;
  href?: string | null;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
  order?: number | string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
  selected?: boolean;
  subtitle?: string | null;
  tone?: AlmidyMapPinTone;
  tripId?: string | null;
};

export type AlmidyLaunchGlobeTripPin = {
  id: string;
  countryCode: string;
  flag: string;
  href?: string | null;
  label: string;
  lat?: number | null;
  lng?: number | null;
  subtitle?: string | null;
  tripId?: string | null;
};

export type AlmidyMapRouteMode =
  | "flight"
  | "drive"
  | "walk"
  | "bike"
  | "transit"
  | "train"
  | "bus"
  | "ferry"
  | "transfer"
  | "unknown";

export type AlmidyMapRouteEndpoint = {
  coordinate: AlmidyCoordinate;
  id?: string | null;
  label: string;
  address?: string | null;
  code?: string | null;
  countryCode?: string | null;
  providerPlaceId?: string | null;
};

export type AlmidyMapRoute = {
  id: string;
  destination: AlmidyMapRouteEndpoint;
  mode: AlmidyMapRouteMode;
  origin: AlmidyMapRouteEndpoint;
  arriveAt?: string | null;
  departAt?: string | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  label?: string | null;
  path?: AlmidyCoordinate[];
  provider?: string | null;
  selected?: boolean;
  tripId?: string | null;
};

export type AlmidyMapDistanceRing = {
  center: AlmidyCoordinate;
  id: string;
  label: string;
  radiusMeters: number;
};

export type AlmidyMapSurfaceState = {
  camera: AlmidyMapCamera;
  location: AlmidyLocationState;
  mode: AlmidyMapMode;
  pins: AlmidyMapPin[];
  renderer: AlmidyMapRenderer;
  routes: AlmidyMapRoute[];
  cameraCommand?: AlmidyMapCameraCommand | null;
  distanceRings?: AlmidyMapDistanceRing[];
  selectedId?: string | null;
};

export type AlmidyMapSelection = {
  pinId: string | null;
  placeId: string | null;
  tripId: string | null;
};
