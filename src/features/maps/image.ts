import { SVG_MAX_BYTES, validateSvg } from "./svg";

/**
 * Preparación de la imagen del plano en el navegador: valida (tipo declarado, tamaño y contenido real), optimiza los rasters
 * (reduce a un máximo de 2400 px y recodifica en WebP) y valida los SVG. El bucket repite los límites de tipo y tamaño.
 */
export const MAP_IMAGE_BUCKET = "venue-maps";
export const MAP_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;
export type MapImageType = keyof typeof MAP_IMAGE_TYPES;
export const MAP_IMAGE_ACCEPT = Object.keys(MAP_IMAGE_TYPES).join(",");
export const MAP_RASTER_MAX_INPUT = 12 * 1024 * 1024;
export const MAP_STORED_MAX_BYTES = 3 * 1024 * 1024;
export const MAP_MAX_SIDE = 2400;

/** Formato real a partir de los primeros bytes (un archivo renombrado no pasa por imagen). */
export function sniffMapImage(bytes: Uint8Array): MapImageType | null {
  const at = (sig: number[], offset = 0) =>
    sig.every((v, i) => bytes[offset + i] === v);
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  const head = new TextDecoder()
    .decode(bytes.subarray(0, 512))
    .replace(/^﻿/, "")
    .trimStart();
  if (
    /^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(
      head,
    )
  )
    return "image/svg+xml";
  return null;
}

export type MapImageCheck =
  { ok: true; type: MapImageType } | { ok: false; message: string };

export async function checkMapImage(file: Blob): Promise<MapImageCheck> {
  if (!(file.type in MAP_IMAGE_TYPES))
    return { ok: false, message: "Usá una imagen JPG, PNG, WebP o un SVG." };
  if (file.size === 0) return { ok: false, message: "El archivo está vacío." };
  const svg = file.type === "image/svg+xml";
  if (file.size > (svg ? SVG_MAX_BYTES : MAP_RASTER_MAX_INPUT))
    return {
      ok: false,
      message: svg
        ? "El SVG pesa más de 1,5 MB."
        : "La imagen pesa más de 12 MB. Reducila e intentá otra vez.",
    };
  const real = sniffMapImage(
    new Uint8Array(await file.slice(0, 1024).arrayBuffer()),
  );
  if (!real || real !== file.type)
    return {
      ok: false,
      message: "El archivo no es una imagen JPG, PNG, WebP o SVG válida.",
    };
  return { ok: true, type: real };
}

/** Tamaño de destino: nunca agranda y respeta la proporción. */
export function targetSize(width: number, height: number, max = MAP_MAX_SIDE) {
  const k = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  };
}

export type PreparedMapImage = {
  blob: Blob;
  type: MapImageType;
  extension: string;
  width: number;
  height: number;
};
export type PrepareResult =
  ({ ok: true } & PreparedMapImage) | { ok: false; message: string };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

async function optimizeRaster(file: Blob): Promise<PrepareResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return {
      ok: false,
      message: "No pudimos abrir la imagen. Probá con otro archivo.",
    };
  }
  try {
    const { width, height } = targetSize(bitmap.width, bitmap.height);
    if (width < 64 || height < 64)
      return {
        ok: false,
        message: "La imagen es demasiado chica para un plano (mínimo 64 px).",
      };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      return {
        ok: false,
        message: "Tu navegador no puede preparar la imagen.",
      };
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    // WebP conserva transparencia y comprime bien los planos; si el navegador no lo codifica, JPEG sobre fondo blanco.
    for (const [type, quality] of [
      ["image/webp", 0.86],
      ["image/webp", 0.72],
      ["image/jpeg", 0.8],
    ] as const) {
      if (type === "image/jpeg") {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
      }
      const blob = await toBlob(canvas, type, quality);
      if (blob && blob.type === type && blob.size <= MAP_STORED_MAX_BYTES)
        return {
          ok: true,
          blob,
          type,
          extension: MAP_IMAGE_TYPES[type],
          width,
          height,
        };
    }
    return {
      ok: false,
      message:
        "La imagen sigue pesando demasiado tras optimizarla. Usá una más simple.",
    };
  } finally {
    bitmap.close();
  }
}

/** Valida y deja lista la imagen (optimizada si es raster, verificada si es SVG). */
export async function prepareMapImage(file: File): Promise<PrepareResult> {
  const check = await checkMapImage(file);
  if (!check.ok) return check;
  if (check.type === "image/svg+xml") {
    const verdict = validateSvg(await file.text());
    if (!verdict.ok) return verdict;
    return {
      ok: true,
      blob: file,
      type: check.type,
      extension: "svg",
      width: verdict.width,
      height: verdict.height,
    };
  }
  return optimizeRaster(file);
}

/** Ruta del objeto en el bucket: `<local>/<uuid>.<ext>` (un solo nivel, como exige la política de Storage). */
export const mapImagePath = (venueId: string, id: string, extension: string) =>
  `${venueId}/${id}.${extension}`;

/**
 * URL pública de la imagen. Las rutas `static:` son planos de demostración que viajan con la aplicación (public/); el resto
 * vive en el Storage del propio proyecto, nunca en un host indicado por datos.
 */
export function mapImageUrl(
  path: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (path.startsWith("static:")) return `/${path.slice("static:".length)}`;
  const base = (supabaseUrl ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${MAP_IMAGE_BUCKET}/${path}`;
}
