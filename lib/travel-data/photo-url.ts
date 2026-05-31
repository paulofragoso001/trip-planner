export type ProviderPhotoMetadata = {
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageProvider?: string | null;
  primaryPhotoAttributions?: unknown;
  primaryPhotoName?: string | null;
  primaryPhotoReference?: string | null;
  title?: string | null;
};

export function buildPlacePhotoUrl(
  metadata: Record<string, unknown> | null | undefined,
  maxWidth = 400
) {
  const photo = readProviderPhoto(metadata);
  if (!photo) return null;

  const params = new URLSearchParams();
  if (photo.photoName) params.set("photoName", photo.photoName);
  if (photo.photoReference) params.set("photoReference", photo.photoReference);
  params.set("maxWidth", String(clampPhotoWidth(maxWidth)));
  return `/api/travel-data/place-photo?${params.toString()}`;
}

export function readProviderPhoto(metadata: Record<string, unknown> | null | undefined) {
  if (!isRecord(metadata)) return null;
  const source = isRecord(metadata.providerMetadata)
    ? { ...metadata.providerMetadata, ...metadata }
    : metadata;

  const photoName = readString(source.primaryPhotoName);
  const photoReference = readString(source.primaryPhotoReference);

  if (!photoName && !photoReference) return null;

  return {
    attribution:
      readString(source.imageAttribution) ||
      formatPhotoAttributions(source.primaryPhotoAttributions),
    imageAlt: readString(source.imageAlt) || buildImageAlt(source),
    imageProvider: readString(source.imageProvider) || "Google",
    photoName,
    photoReference
  };
}

export function clampPhotoWidth(value: number) {
  return Math.max(80, Math.min(Math.round(value), 1200));
}

function buildImageAlt(metadata: Record<string, unknown>) {
  const title = readString(metadata.displayName) || readString(metadata.title);
  return title ? `Photo of ${title}` : "Place photo";
}

function formatPhotoAttributions(value: unknown) {
  if (!Array.isArray(value)) return null;
  const labels = value
    .map((item) => {
      if (!isRecord(item)) return null;
      return readString(item.displayName) || readString(item.author) || readString(item.name);
    })
    .filter((item): item is string => Boolean(item));
  return labels.length ? labels.join(", ") : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
