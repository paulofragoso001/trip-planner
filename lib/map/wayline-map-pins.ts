import type {
  AlmidyCoordinate,
  AlmidyLocationState,
  AlmidyMapPin
} from "@/lib/map/wayline-map-models";

export const USER_LOCATION_PIN_ID = "user-location";

type PinBuilderInput = {
  coordinate: AlmidyCoordinate;
  id: string;
  label: string;
  address?: string | null;
  countryCode?: string | null;
  flag?: string | null;
  href?: string | null;
  order?: number | string | null;
  providerPlaceId?: string | null;
  selected?: boolean;
  subtitle?: string | null;
  tripId?: string | null;
};

type TripPinInput = PinBuilderInput & {
  destination?: string | null;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
};

export function buildUserLocationPin(
  location: AlmidyLocationState,
  selected = false
): AlmidyMapPin | null {
  if (!location.coordinate) {
    return null;
  }

  return {
    coordinate: normalizeCoordinate(location.coordinate),
    countryCode: normalizeCountryCode(location.countryCode),
    flag: countryCodeToFlag(location.countryCode),
    id: USER_LOCATION_PIN_ID,
    kind: "user-location",
    label: locationLabel(location),
    selected,
    subtitle: location.countryName ?? null,
    tone: "orange"
  };
}

export function buildCountryFlagPin({
  coordinate,
  countryCode,
  flag,
  id,
  label,
  selected = false,
  subtitle
}: PinBuilderInput): AlmidyMapPin {
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  return {
    coordinate: normalizeCoordinate(coordinate),
    countryCode: normalizedCountryCode,
    flag: flag ?? countryCodeToFlag(normalizedCountryCode),
    id,
    kind: "country",
    label,
    selected,
    subtitle: subtitle ?? null,
    tone: "orange"
  };
}

export function buildTripPin({
  coordinate,
  countryCode,
  destination,
  flag,
  href,
  id,
  imageAlt,
  imageAttribution,
  imageUrl,
  label,
  selected = false,
  subtitle,
  tripId
}: TripPinInput): AlmidyMapPin {
  const normalizedCountryCode = normalizeCountryCode(countryCode) ?? countryCodeFromDestination(destination);

  return {
    coordinate: normalizeCoordinate(coordinate),
    countryCode: normalizedCountryCode,
    flag: flag ?? countryCodeToFlag(normalizedCountryCode) ?? countryFlagFromDestinationText(destination) ?? null,
    href: href ?? null,
    id,
    imageAlt: imageAlt ?? null,
    imageAttribution: imageAttribution ?? null,
    imageUrl: imageUrl ?? null,
    kind: "trip",
    label,
    selected,
    subtitle: subtitle ?? destination ?? null,
    tone: "orange",
    tripId: tripId ?? id
  };
}

export function buildPlacePin({
  address,
  coordinate,
  countryCode,
  flag,
  id,
  label,
  order,
  providerPlaceId,
  selected = false,
  subtitle,
  tripId
}: PinBuilderInput): AlmidyMapPin {
  return {
    address: address ?? null,
    coordinate: normalizeCoordinate(coordinate),
    countryCode: normalizeCountryCode(countryCode),
    flag: flag ?? countryCodeToFlag(countryCode),
    id,
    kind: "place",
    label,
    order: order ?? null,
    providerPlaceId: providerPlaceId ?? null,
    selected,
    subtitle: subtitle ?? address ?? null,
    tone: "blue",
    tripId: tripId ?? null
  };
}

export function buildRouteWaypointPin({
  coordinate,
  countryCode,
  flag,
  id,
  label,
  order,
  selected = false,
  subtitle,
  tripId
}: PinBuilderInput): AlmidyMapPin {
  return {
    coordinate: normalizeCoordinate(coordinate),
    countryCode: normalizeCountryCode(countryCode),
    flag: flag ?? countryCodeToFlag(countryCode),
    id,
    kind: "route-waypoint",
    label,
    order: order ?? null,
    selected,
    subtitle: subtitle ?? null,
    tone: "purple",
    tripId: tripId ?? null
  };
}

export function mergeUserLocationPin(
  pins: AlmidyMapPin[],
  locationPin: AlmidyMapPin | null
) {
  const appPins = pins.filter((pin) => pin.id !== USER_LOCATION_PIN_ID);
  return locationPin ? [locationPin, ...appPins] : appPins;
}

export function pinGlyph(pin: AlmidyMapPin) {
  return pin.flag ?? pin.order ?? pin.label.slice(0, 1).toUpperCase();
}

export function pinDisplayLabel(pin: AlmidyMapPin) {
  return pin.kind === "user-location" ? pin.subtitle || pin.label : pin.label;
}

export function countryCodeToFlag(countryCode?: string | null) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  const codePoints = [...normalizedCountryCode].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function countryFlagFromDestinationText(destination?: string | null) {
  return countryCodeToFlag(countryCodeFromDestination(destination));
}

export function normalizeCoordinate(coordinate: AlmidyCoordinate): AlmidyCoordinate {
  return {
    lat: clampLatitude(coordinate.lat),
    lng: normalizeLongitude(coordinate.lng)
  };
}

function locationLabel(location: AlmidyLocationState) {
  return location.label || location.city || location.countryName || "Current location";
}

function normalizeCountryCode(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  return countryCode.toUpperCase();
}

function countryCodeFromDestination(destination?: string | null) {
  const value = destination?.toLowerCase() ?? "";
  if (/(canada|vancouver|toronto|montreal)/.test(value)) return "CA";
  if (/(japan|tokyo|osaka|kyoto)/.test(value)) return "JP";
  if (/(spain|barcelona|madrid)/.test(value)) return "ES";
  if (/(france|paris)/.test(value)) return "FR";
  if (/(brazil|rio|sao paulo|são paulo)/.test(value)) return "BR";
  if (/(colombia|bogota|bogotá|cartagena)/.test(value)) return "CO";
  if (/(panama)/.test(value)) return "PA";
  if (/(chile|santiago)/.test(value)) return "CL";
  if (/(aruba)/.test(value)) return "AW";
  if (/(united states|usa|miami|new york|los angeles|san francisco|houston|beverly hills|newark)/.test(value)) return "US";
  return null;
}

function clampLatitude(latitude: number) {
  return Math.min(85, Math.max(-85, latitude));
}

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
