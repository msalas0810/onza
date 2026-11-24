"use client";
import { browserDb } from "@/lib/supabase/browser";
import { MAP_IMAGE_BUCKET, mapImagePath, prepareMapImage } from "./image";

export type MapUpload =
  | { ok: true; path: string; width: number; height: number }
  | { ok: false; message: string };

/**
 * Valida, optimiza (rasters: máximo 2400 px, WebP) o verifica (SVG) y sube a `<local>/<uuid>.<ext>`. Nunca lanza: devuelve el
 * mensaje. `onStage` permite mostrar «Preparando» y «Subiendo». El objeto nunca se sobrescribe: cada subida es un archivo nuevo.
 */
export async function uploadMapImage(
  venueId: string,
  file: File,
  onStage?: (stage: "preparing" | "uploading") => void,
): Promise<MapUpload> {
  onStage?.("preparing");
  const prepared = await prepareMapImage(file);
  if (!prepared.ok) return prepared;
  onStage?.("uploading");
  try {
    const path = mapImagePath(venueId, crypto.randomUUID(), prepared.extension);
    const { error } = await browserDb()
      .storage.from(MAP_IMAGE_BUCKET)
      .upload(path, prepared.blob, {
        contentType: prepared.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) throw error;
    return { ok: true, path, width: prepared.width, height: prepared.height };
  } catch {
    return {
      ok: false,
      message:
        "No se pudo subir el plano. Revisá tu conexión y que tu cuenta sea administradora de este local.",
    };
  }
}

/** Mejor esfuerzo: la base impide borrar una imagen que una versión publicada usa; si falla, el archivo huérfano es inofensivo. */
export async function removeMapImages(paths: string[]) {
  if (!paths.length) return;
  try {
    await browserDb().storage.from(MAP_IMAGE_BUCKET).remove(paths);
  } catch {
    // nada: ver comentario arriba
  }
}
