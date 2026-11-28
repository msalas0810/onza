import { describe, expect, it } from "vitest";
import {
  gzipKib,
  leakedSecretKeys,
  publicOnlyNextEnv,
  secretEntries,
  workerSecrets,
} from "../../scripts/lib/worker-env.mjs";

const bundled = `export const production = {"NEXT_PUBLIC_SUPABASE_URL":"https://p.example","SUPABASE_SERVICE_ROLE_KEY":"service-role-value","DEMO_ADMIN_PASSWORD":"clave \\"con\\" comillas }; larga"};
export const development = {"PICKUP_TOKEN_ENCRYPTION_KEY":"pickup-key-value"};
export const test = {};
`;

describe("variables dentro del bundle del Worker", () => {
  it("solo deja las NEXT_PUBLIC_*, aunque un valor traiga comillas o llaves", () => {
    const clean = publicOnlyNextEnv(bundled);
    expect(clean).toBe(
      'export const production = {"NEXT_PUBLIC_SUPABASE_URL":"https://p.example"};\n' +
        "export const development = {};\nexport const test = {};\n",
    );
  });

  it("falla cerrado si el formato del archivo generado cambia", () => {
    expect(() => publicOnlyNextEnv("export default { A: 1 }")).toThrow();
    expect(() => publicOnlyNextEnv("")).toThrow();
    expect(() => publicOnlyNextEnv(bundled + "const extra = 1;\n")).toThrow();
  });

  it("toma como secreto toda clave sensible de un .env, sin importar las comillas", () => {
    expect(
      secretEntries(
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publica-123456\n# comentario\nSUPABASE_SERVICE_ROLE_KEY="service-role-value"\nPICKUP_TOKEN_KEY_VERSION=1\nDEMO_ADMIN_PASSWORD=otra-clave-larga\n',
      ),
    ).toEqual([
      { key: "SUPABASE_SERVICE_ROLE_KEY", value: "service-role-value" },
      { key: "DEMO_ADMIN_PASSWORD", value: "otra-clave-larga" },
    ]);
  });

  it("también busca contraseñas cortas", () => {
    expect(secretEntries("DEMO_ADMIN_PASSWORD=abc1234\n")).toHaveLength(1);
  });

  it("nombra la clave filtrada y nunca devuelve el valor", () => {
    const secrets = [
      { key: "SUPABASE_SERVICE_ROLE_KEY", value: "service-role-value" },
      { key: "DEMO_ADMIN_PASSWORD", value: "no-aparece-nunca" },
    ];
    expect(leakedSecretKeys("x=service-role-value;", secrets)).toEqual([
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });

  it("lee el tamaño comprimido de la salida de wrangler y falla si no está", () => {
    expect(gzipKib("Total Upload: 11292.38 KiB / gzip: 2365.41 KiB")).toBe(
      2365.41,
    );
    expect(() => gzipKib("sin tamaño")).toThrow();
  });
});

describe("secretos del Worker", () => {
  const local = {
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    PICKUP_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    DEMO_ADMIN_PASSWORD: "no-viaja-nunca",
  };
  const origin = "https://onza-preview.cuenta.workers.dev";

  it("carga solo lo que la app necesita; la service_role solo si se pide", () => {
    expect(Object.keys(workerSecrets(local, { origin }))).toEqual([
      "APP_ORIGIN",
      "PICKUP_TOKEN_ENCRYPTION_KEY",
      "PICKUP_TOKEN_KEY_VERSION",
    ]);
    expect(
      workerSecrets(local, { origin, serviceRole: true })
        .SUPABASE_SERVICE_ROLE_KEY,
    ).toBe("service-role-value");
  });

  it("rechaza un origen que no sea https sin ruta, y claves ausentes o mal formadas", () => {
    for (const bad of [
      undefined,
      "http://x.dev",
      "https://x.dev/",
      "https://x.dev/ruta",
      "x.dev",
    ])
      expect(() => workerSecrets(local, { origin: bad })).toThrow();
    expect(() =>
      workerSecrets(
        { ...local, PICKUP_TOKEN_ENCRYPTION_KEY: "corta" },
        { origin },
      ),
    ).toThrow();
    expect(() =>
      workerSecrets(
        { ...local, SUPABASE_SERVICE_ROLE_KEY: "" },
        { origin, serviceRole: true },
      ),
    ).toThrow();
  });
});
