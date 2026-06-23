type GeocodeApiResponse = {
  data?: {
    result?: {
      address?: string | null;
      city?: string | null;
      coordinate?: {
        lat: number;
        lng: number;
      } | null;
      countryCode?: string | null;
      countryName?: string | null;
      placeId?: string | null;
      types?: string[];
    } | null;
  } | null;
};

type CoordinateInput = {
  lat: number;
  lng: number;
};

export async function geocodeAddress(address: string) {
  const normalizedAddress = address.trim();

  if (!normalizedAddress) return null;

  const response = await fetch("/api/travel-data/geocode", {
    body: JSON.stringify({ address: normalizedAddress }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as GeocodeApiResponse | null;

  return payload?.data?.result?.coordinate ?? null;
}

export async function reverseGeocodeCoordinate(coordinate: CoordinateInput) {
  const response = await fetch("/api/travel-data/geocode", {
    body: JSON.stringify({ coordinate }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as GeocodeApiResponse | null;

  return payload?.data?.result ?? null;
}
