export const avatarBucket = "avatars";
export const avatarMaxBytes = 5 * 1024 * 1024;
export const avatarMimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export function createAvatarPath(userId: string, mime: keyof typeof avatarMimeExtensions, id = crypto.randomUUID()) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid avatar owner or filename.");
  return `${userId}/${id}.${avatarMimeExtensions[mime]}`;
}

export function ownedAvatarPath(publicUrl: string | null, userId: string) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${avatarBucket}/`;
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return path.startsWith(`${userId}/`) && !path.slice(userId.length + 1).includes("/") ? path : null;
  } catch { return null; }
}

export async function validateAvatarFile(file: File) {
  if (file.size === 0) throw new Error("Choose a non-empty image file.");
  if (file.size > avatarMaxBytes) throw new Error("Avatar images must be 5 MB or smaller.");
  if (!(file.type in avatarMimeExtensions)) {
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) throw new Error("HEIC images are not supported yet. Export the photo as JPEG, PNG, or WebP.");
    throw new Error("Choose a JPEG, PNG, or WebP image. SVG is not supported.");
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === "image/png" ? bytes.slice(0, 8).every((value, index) => value === [137,80,78,71,13,10,26,10][index])
    : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!valid) throw new Error("The file contents do not match the selected image type.");
  return file.type as keyof typeof avatarMimeExtensions;
}
