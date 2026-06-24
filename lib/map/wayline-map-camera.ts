import type {
  AlmidyCoordinate,
  AlmidyLocationState,
  AlmidyMapBounds,
  AlmidyMapCamera,
  AlmidyMapCameraCommand,
  AlmidyMapCameraCommandType,
  AlmidyMapMode,
  AlmidyMapRoute
} from "@/lib/map/wayline-map-models";
import { USER_LOCATION_PIN_ID, normalizeCoordinate } from "@/lib/map/wayline-map-pins";

type CameraTarget = {
  coordinate: AlmidyCoordinate;
  id?: string | null;
  label?: string | null;
  tripId?: string | null;
  zoom?: number | null;
};

type CountryCameraTarget = CameraTarget & {
  countryCode?: string | null;
};

const WORLD_CAMERA: AlmidyMapCamera = {
  center: { lat: 20, lng: 0 },
  intent: "world",
  rangeMeters: 18_000_000,
  tilt: 0,
  zoom: 2
};

export function buildFocusUserLocationCommand(
  location: AlmidyLocationState
): AlmidyMapCameraCommand | null {
  if (!location.coordinate) {
    return null;
  }

  const coordinate = normalizeCoordinate(location.coordinate);

  return cameraCommand("focusUserLocation", {
    camera: {
      center: coordinate,
      intent: "user-location",
      rangeMeters: 4_500_000,
      selectedId: USER_LOCATION_PIN_ID,
      tilt: 35,
      zoom: 8
    },
    coordinates: [coordinate],
    label: location.label || location.city || location.countryName || "Current location",
    pinId: USER_LOCATION_PIN_ID
  });
}

export function buildFocusCountryCommand(target: CountryCameraTarget): AlmidyMapCameraCommand {
  const coordinate = normalizeCoordinate(target.coordinate);

  return cameraCommand("focusCountry", {
    camera: {
      center: coordinate,
      intent: "country",
      rangeMeters: 2_600_000,
      selectedId: target.id ?? target.countryCode ?? null,
      tilt: 32,
      zoom: target.zoom ?? 5
    },
    coordinates: [coordinate],
    label: target.label ?? target.countryCode ?? null,
    pinId: target.id ?? null
  });
}

export function buildFocusTripCommand(target: CameraTarget): AlmidyMapCameraCommand {
  const coordinate = normalizeCoordinate(target.coordinate);
  const selectedId = target.tripId ?? target.id ?? null;

  return cameraCommand("focusTrip", {
    camera: {
      center: coordinate,
      intent: "trip",
      selectedId,
      tilt: 35,
      zoom: target.zoom ?? 8
    },
    coordinates: [coordinate],
    label: target.label ?? null,
    pinId: target.id ?? null,
    tripId: selectedId
  });
}

export function buildFocusRouteCommand(route: AlmidyMapRoute): AlmidyMapCameraCommand {
  const coordinates = route.path?.length
    ? route.path.map(normalizeCoordinate)
    : [route.origin.coordinate, route.destination.coordinate].map(normalizeCoordinate);
  const bounds = boundsFromCoordinates(coordinates);

  return cameraCommand("focusRoute", {
    bounds,
    camera: {
      bounds,
      center: centerFromCoordinates(coordinates),
      intent: "route",
      selectedId: route.id,
      tilt: 0,
      zoom: coordinates.length > 2 ? 9 : 10
    },
    coordinates,
    label: route.label ?? `${route.origin.label} to ${route.destination.label}`,
    padding: { bottom: 120, left: 64, right: 64, top: 96 },
    routeId: route.id,
    tripId: route.tripId ?? null
  });
}

export function buildZoomToWorldCommand(): AlmidyMapCameraCommand {
  return cameraCommand("zoomToWorld", {
    camera: WORLD_CAMERA,
    coordinates: [],
    label: "World"
  });
}

export function buildOpenFlatMapCommand(
  mode: AlmidyMapMode = "map",
  camera: AlmidyMapCamera = WORLD_CAMERA
): AlmidyMapCameraCommand {
  return cameraCommand("openFlatMap", {
    camera: {
      ...camera,
      tilt: 0,
      zoom: camera.zoom ?? 10
    },
    mode,
    label: "Map"
  });
}

export function boundsFromCoordinates(coordinates: AlmidyCoordinate[]): AlmidyMapBounds | null {
  if (!coordinates.length) {
    return null;
  }

  return coordinates.reduce<AlmidyMapBounds>(
    (bounds, coordinate) => {
      const normalizedCoordinate = normalizeCoordinate(coordinate);
      return {
        east: Math.max(bounds.east, normalizedCoordinate.lng),
        north: Math.max(bounds.north, normalizedCoordinate.lat),
        south: Math.min(bounds.south, normalizedCoordinate.lat),
        west: Math.min(bounds.west, normalizedCoordinate.lng)
      };
    },
    {
      east: -180,
      north: -85,
      south: 85,
      west: 180
    }
  );
}

export function centerFromCoordinates(coordinates: AlmidyCoordinate[]): AlmidyCoordinate {
  if (!coordinates.length) {
    return WORLD_CAMERA.center;
  }

  const totals = coordinates.reduce(
    (accumulator, coordinate) => {
      const normalizedCoordinate = normalizeCoordinate(coordinate);
      return {
        lat: accumulator.lat + normalizedCoordinate.lat,
        lng: accumulator.lng + normalizedCoordinate.lng
      };
    },
    { lat: 0, lng: 0 }
  );

  return normalizeCoordinate({
    lat: totals.lat / coordinates.length,
    lng: totals.lng / coordinates.length
  });
}

function cameraCommand(
  type: AlmidyMapCameraCommandType,
  command: Omit<AlmidyMapCameraCommand, "id" | "type">
): AlmidyMapCameraCommand {
  return {
    ...command,
    id: `${type}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    type
  };
}
