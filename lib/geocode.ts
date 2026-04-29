type GeocodeResponse = {
  results?: Array<{
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status?: string;
};

export async function geocodeAddress(address: string) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey || !address.trim()) {
    return null;
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GeocodeResponse;
  const location = data.results?.[0]?.geometry?.location;

  return location ? { lat: location.lat, lng: location.lng } : null;
}
