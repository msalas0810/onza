import type { NextConfig } from "next";

/** Origen del Storage/Auth del proyecto (único origen externo de imágenes permitido). */
function supabaseOrigin() {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
}

/**
 * CSP parcial a propósito: restringe lo que no rompe Next (marcos, base, formularios, objetos e imágenes) y deja `script-src`
 * y `connect-src` sin definir. Una CSP de scripts completa necesita nonces por petición (hay un script de tema en línea) y se
 * evaluará aparte. `img-src` repite en el navegador la regla de servidor de `src/lib/storage-url.ts`.
 */
function contentSecurityPolicy() {
  // Diseños de avatares alojados fuera de Supabase: orígenes https explícitos (AVATAR_ASSET_ORIGINS, separados por coma).
  const assetOrigins = (process.env.AVATAR_ASSET_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin));
  const images = ["'self'", "data:", "blob:", supabaseOrigin(), ...assetOrigins];
  return [
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `img-src ${images.filter(Boolean).join(" ")}`,
  ].join("; ");
}

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};
export default config;
