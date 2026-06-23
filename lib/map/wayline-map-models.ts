export type WaylineCoordinate = {
  lat: number;
  lng: number;
};

export type WaylineMapMode =
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

export type WaylineMapRenderer = "google-2d" | "google-3d" | "custom-globe";

export type WaylineMapCameraIntent =
  | "world"
  | "user-location"
  | "country"
  | "trip"
  | "route"
  | "place"
  | "selection";

export type WaylineMapCamera = {
  center: WaylineCoordinate;
  intent: WaylineMapCameraIntent;
  altitudeMeters?: number | null;
  bounds?: WaylineMapBounds | null;
  heading?: number | null;
  pitch?: number | null;
  rangeMeters?: number | null;
  selectedId?: string | null;
  tilt?: number | null;
  zoom?: number | null;
};

export type WaylineMapCameraCommandType =
  | "focusUserLocation"
  | "focusCountry"
  | "focusTrip"
  | "focusRoute"
  | "zoomToWorld"
  | "openFlatMap";

export type WaylineMapCameraPadding = {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
};

export type WaylineMapCameraCommand = {
  camera: WaylineMapCamera;
  id: string;
  type: WaylineMapCameraCommandType;
  bounds?: WaylineMapBounds | null;
  coordinates?: WaylineCoordinate[];
  durationMs?: number | null;
  label?: string | null;
  mode?: WaylineMapMode | null;
  padding?: WaylineMapCameraPadding | null;
  pinId?: string | null;
  routeId?: string | null;
  tripId?: string | null;
};

export type WaylineMapBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type WaylineLocationPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable";

export type WaylineLocationState = {
  coordinate: WaylineCoordinate | null;
  permission: WaylineLocationPermissionState;
  accuracyMeters?: number | null;
  city?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  error?: string | null;
  label?: string | null;
  locatedAt?: string | null;
  source: "browser" | "account" | "trip" | "locale" | "timezone" | "fallback";
};

export type WaylineMapPinKind =
  | "user-location"
  | "country"
  | "trip"
  | "place"
  | "route-endpoint"
  | "route-waypoint"
  | "transport"
  | "idea";

export type WaylineMapPinTone =
  | "blue"
  | "emerald"
  | "orange"
  | "purple"
  | "slate"
  | "white";

export type WaylineMapPin = {
  id: string;
  coordinate: WaylineCoordinate;
  kind: WaylineMapPinKind;
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
  tone?: WaylineMapPinTone;
  tripId?: string | null;
};

export type WaylineMapRouteMode =
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

export type WaylineMapRouteEndpoint = {
  coordinate: WaylineCoordinate;
  id?: string | null;
  label: string;
  address?: string | null;
  code?: string | null;
  countryCode?: string | null;
  providerPlaceId?: string | null;
};

export type WaylineMapRoute = {
  id: string;
  destination: WaylineMapRouteEndpoint;
  mode: WaylineMapRouteMode;
  origin: WaylineMapRouteEndpoint;
  arriveAt?: string | null;
  departAt?: string | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  label?: string | null;
  path?: WaylineCoordinate[];
  provider?: string | null;
  selected?: boolean;
  tripId?: string | null;
};

export type WaylineMapDistanceRing = {
  center: WaylineCoordinate;
  id: string;
  label: string;
  radiusMeters: number;
};

export type WaylineMapSurfaceState = {
  camera: WaylineMapCamera;
  location: WaylineLocationState;
  mode: WaylineMapMode;
  pins: WaylineMapPin[];
  renderer: WaylineMapRenderer;
  routes: WaylineMapRoute[];
  cameraCommand?: WaylineMapCameraCommand | null;
  distanceRings?: WaylineMapDistanceRing[];
  selectedId?: string | null;
};

export type WaylineMapSelection = {
  pinId: string | null;
  placeId: string | null;
  tripId: string | null;
};
