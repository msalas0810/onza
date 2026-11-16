"use client";
import { browserDb } from "@/lib/supabase/browser";
import {
  VENUE_IMAGE_BUCKET,
  checkVenueImage,
  venueImagePath,
  type VenueImageKind,
} from "./venue-image";

export type UploadResult =
  { ok: true; path: string; url: string } | { ok: false; message: string };

/** Validates (type, 2 MB, real content) and uploads to `<venueId>/<kind>-<uuid>.<ext>`. Never throws: returns a message. */
export async function uploadVenueImage(
  venueId: string,
  kind: VenueImageKind,
  file: File,
): Promise<UploadResult> {
  const check = await checkVenueImage(file);
  if (!check.ok) return check;
  try {
    const path = venueImagePath(
      venueId,
      kind,
      check.extension,
      crypto.randomUUID(),
    );
    const bucket = browserDb().storage.from(VENUE_IMAGE_BUCKET);
    const { error } = await bucket.upload(path, file, {
      contentType: check.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    return { ok: true, path, url: bucket.getPublicUrl(path).data.publicUrl };
  } catch {
    return {
      ok: false,
      message:
        "No se pudo subir la imagen. Revisá tu conexión y que tu cuenta sea administradora de este local.",
    };
  }
}

/** Best effort: removing a replaced or discarded file must never break the save that already succeeded. */
export async function removeVenueImages(paths: string[]) {
  if (!paths.length) return;
  try {
    await browserDb().storage.from(VENUE_IMAGE_BUCKET).remove(paths);
  } catch {
    // The database already holds the right values; an orphan file is harmless.
  }
}
