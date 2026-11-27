// Reglas puras del empaquetado para Workers (las usa scripts/cf-build.mjs).
const SECRET_KEY = /SERVICE_ROLE|PASSWORD|ENCRYPTION_KEY|SECRET|TOKEN/;
const LINE = /^export const ([a-z]+) = (\{.*\});$/;

/**
 * OpenNext copia TODOS los valores de `.env*` a `.open-next/cloudflare/next-env.mjs`, que viaja dentro del Worker.
 * Deja solo las NEXT_PUBLIC_*. Si el formato generado cambia, falla en vez de dejar pasar el archivo.
 */
export function publicOnlyNextEnv(source) {
  const lines = source.split("\n").filter(Boolean);
  if (!lines.length)
    throw new Error("next-env.mjs vacío o con formato desconocido");
  return lines
    .map((line) => {
      const match = LINE.exec(line);
      if (!match)
        throw new Error(
          "next-env.mjs con formato desconocido: no se puede filtrar",
        );
      const entries = Object.entries(JSON.parse(match[2])).filter(([key]) =>
        key.startsWith("NEXT_PUBLIC_"),
      );
      return `export const ${match[1]} = ${JSON.stringify(Object.fromEntries(entries))};\n`;
    })
    .join("");
}

export function secretEntries(dotenv) {
  return dotenv.split("\n").flatMap((line) => {
    const match = /^(?:export )?([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) return [];
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    return SECRET_KEY.test(match[1]) && value.length >= 6
      ? [{ key: match[1], value }]
      : [];
  });
}

export function leakedSecretKeys(content, secrets) {
  return secrets
    .filter(({ value }) => content.includes(value))
    .map(({ key }) => key);
}

export function gzipKib(wranglerOutput) {
  const match = /gzip:\s*([\d.]+)\s*KiB/.exec(wranglerOutput);
  if (!match)
    throw new Error(
      "No se encontró el tamaño comprimido en la salida de wrangler",
    );
  return Number(match[1]);
}

/** Lo que se carga con `wrangler secret put`. APP_ORIGIN no es secreto, pero depende de la cuenta y no va en el repo. */
export function workerSecrets(local, { origin, serviceRole = false }) {
  if (
    !origin ||
    !origin.startsWith("https://") ||
    new URL(origin).origin !== origin
  )
    throw new Error(
      "--origin debe ser un origen https sin ruta, por ejemplo https://onza-preview.<cuenta>.workers.dev",
    );
  const key = local.PICKUP_TOKEN_ENCRYPTION_KEY ?? "";
  if (Buffer.from(key, "base64").length !== 32)
    throw new Error("PICKUP_TOKEN_ENCRYPTION_KEY ausente o no es de 32 bytes");
  if (serviceRole && !local.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return {
    APP_ORIGIN: origin,
    PICKUP_TOKEN_ENCRYPTION_KEY: key,
    PICKUP_TOKEN_KEY_VERSION: local.PICKUP_TOKEN_KEY_VERSION || "1",
    ...(serviceRole
      ? { SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY }
      : {}),
  };
}
