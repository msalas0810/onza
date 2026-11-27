"use client";

export type PreparedMapImage = { file: File; width: number; height: number };

const MAX_SIDE = 2400;
const MAX_BYTES = 2 * 1024 * 1024; // el límite del bucket venue-images

/**
 * Reduce el plano o la foto antes de subirla: lado largo de hasta 2400 px y JPEG, así un plano de varios MB entra en los 2 MB
 * del bucket y carga rápido en el teléfono del cliente. Devuelve también las medidas finales, que la base guarda con el mapa.
 * Nunca lanza: si el archivo no es una imagen legible devuelve un mensaje.
 */
export async function prepareMapImage(
  source: File,
): Promise<
  { ok: true; image: PreparedMapImage } | { ok: false; message: string }
> {
  if (!/^image\/(jpeg|png|webp)$/.test(source.type))
    return { ok: false, message: "Usá una imagen JPG, PNG o WebP." };
  try {
    const bitmap = await createImageBitmap(source);
    try {
      for (const [side, quality] of [
        [MAX_SIDE, 0.88],
        [MAX_SIDE, 0.72],
        [1800, 0.72],
        [1400, 0.65],
      ] as const) {
        const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) break;
        context.fillStyle = "#ffffff"; // un PNG con transparencia no queda negro al pasar a JPEG
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((done) =>
          canvas.toBlob(done, "image/jpeg", quality),
        );
        if (blob && blob.size <= MAX_BYTES)
          return {
            ok: true,
            image: {
              file: new File([blob], "mapa.jpg", { type: "image/jpeg" }),
              width,
              height,
            },
          };
      }
      return {
        ok: false,
        message:
          "No pudimos reducir la imagen a menos de 2 MB. Probá con otra.",
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return {
      ok: false,
      message:
        "No pudimos leer esa imagen. Probá con otro archivo JPG, PNG o WebP.",
    };
  }
}
