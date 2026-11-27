// Pure helpers for venue cover/logo uploads. The bucket enforces the same limits server-side (2 MB, jpg/png/webp);
// these checks give the admin an immediate, specific message and avoid pointless uploads.
export const VENUE_IMAGE_BUCKET = "venue-images";
export const VENUE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const VENUE_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type VenueImageType = keyof typeof VENUE_IMAGE_TYPES;
export type VenueImageKind = "cover" | "logo" | "product" | "map";

export const VENUE_IMAGE_ACCEPT = Object.keys(VENUE_IMAGE_TYPES).join(",");

/** Detect the real format from the first bytes, so a renamed file is not accepted as an image. */
export function sniffImageType(bytes: Uint8Array): VenueImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  )
    return "image/webp";
  return null;
}

export type VenueImageCheck =
  | { ok: true; type: VenueImageType; extension: string }
  | { ok: false; message: string };

/** Validates declared type, size and real content. Returns a message in Spanish when the file cannot be used. */
export async function checkVenueImage(file: Blob): Promise<VenueImageCheck> {
  if (!(file.type in VENUE_IMAGE_TYPES))
    return { ok: false, message: "Usá una imagen JPG, PNG o WebP." };
  if (file.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > VENUE_IMAGE_MAX_BYTES)
    return {
      ok: false,
      message: "La imagen pesa más de 2 MB. Reducila e intentá otra vez.",
    };
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const real = sniffImageType(head);
  if (!real || real !== file.type)
    return {
      ok: false,
      message: "El archivo no es una imagen JPG, PNG o WebP válida.",
    };
  return { ok: true, type: real, extension: VENUE_IMAGE_TYPES[real] };
}

/** Object path inside the bucket: always `<venueId>/<kind>-<id>.<ext>` (one folder level, as the Storage policy requires). */
export function venueImagePath(
  venueId: string,
  kind: VenueImageKind,
  extension: string,
  id: string,
) {
  return `${venueId}/${kind}-${id}.${extension}`;
}

/** Recover the object path from a public URL of this venue, or null if it is not one of its own images. */
export function venueImagePathFromUrl(url: string | null, venueId: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${VENUE_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length);
  return path.startsWith(`${venueId}/`) &&
    !path.slice(venueId.length + 1).includes("/")
    ? path
    : null;
}
