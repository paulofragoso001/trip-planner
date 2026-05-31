import { NextResponse } from "next/server";
import { clampPhotoWidth } from "@/lib/travel-data/photo-url";

const maxProviderPhotoBytes = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const photoName = url.searchParams.get("photoName");
  const photoReference = url.searchParams.get("photoReference");
  const maxWidth = clampPhotoWidth(Number(url.searchParams.get("maxWidth") || 400));

  if (!isValidPhotoRequest(photoName, photoReference)) {
    return NextResponse.json({ error: "Invalid place photo reference." }, { status: 400 });
  }

  const apiKey = googlePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Place photos are temporarily unavailable." }, { status: 503 });
  }

  const providerUrl = buildProviderPhotoUrl({ apiKey, maxWidth, photoName, photoReference });
  if (!providerUrl) {
    return NextResponse.json({ error: "Invalid place photo reference." }, { status: 400 });
  }

  try {
    const response = await fetchProviderPhoto(providerUrl);

    if (!response.ok) {
      return NextResponse.json({ error: "Place photo is temporarily unavailable." }, { status: 502 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxProviderPhotoBytes) {
      return NextResponse.json({ error: "Place photo is too large." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Place photo response was invalid." }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff"
      },
      status: 200
    });
  } catch {
    return NextResponse.json({ error: "Place photo is temporarily unavailable." }, { status: 502 });
  }
}

async function fetchProviderPhoto(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isValidPhotoRequest(photoName: string | null, photoReference: string | null) {
  if (photoName) {
    return /^places\/[^/?#]+\/photos\/[^/?#]+(?:\/media)?$/.test(photoName);
  }

  if (photoReference) {
    return /^[A-Za-z0-9._~:+=-]{10,1800}$/.test(photoReference);
  }

  return false;
}

function buildProviderPhotoUrl({
  apiKey,
  maxWidth,
  photoName,
  photoReference
}: {
  apiKey: string;
  maxWidth: number;
  photoName: string | null;
  photoReference: string | null;
}) {
  if (photoName) {
    const normalizedName = photoName.replace(/\/media$/, "");
    if (!/^places\/[^/?#]+\/photos\/[^/?#]+$/.test(normalizedName)) return null;
    const url = new URL(`https://places.googleapis.com/v1/${normalizedName}/media`);
    url.searchParams.set("maxWidthPx", String(maxWidth));
    url.searchParams.set("key", apiKey);
    return url;
  }

  if (photoReference) {
    if (!/^[A-Za-z0-9._~:+=-]{10,1800}$/.test(photoReference)) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
    url.searchParams.set("maxwidth", String(maxWidth));
    url.searchParams.set("photo_reference", photoReference);
    url.searchParams.set("key", apiKey);
    return url;
  }

  return null;
}

function googlePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}
