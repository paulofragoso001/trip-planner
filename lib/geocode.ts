type GeocodeApiResponse = {
  data?: {
    result?: {
      coordinate?: {
        lat: number;
        lng: number;
      } | null;
    } | null;
  } | null;
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
