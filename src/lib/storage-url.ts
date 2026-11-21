/**
 * Las imágenes del local y de los tragos solo pueden apuntar al Storage del propio proyecto. La base valida la ruta
 * (`/storage/v1/object/public/venue-images/<local>/…`) pero no puede conocer el host de cada entorno; este control lo
 * cierra en el servidor y la política CSP `img-src` (next.config.ts) lo repite en el navegador. Función pura.
 */
export function isOwnStorageUrl(
  value: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (value === null || value === undefined) return true; // quitar la imagen
  if (!supabaseUrl) return false;
  try {
    const target = new URL(value);
    const own = new URL(supabaseUrl);
    return (
      (target.protocol === "https:" || target.protocol === "http:") &&
      target.origin === own.origin &&
      !target.username &&
      !target.password
    );
  } catch {
    return false;
  }
}
