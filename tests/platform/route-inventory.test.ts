import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PLATFORM_PAGES, ROUTE_RULES, classifyRoute, isRouteInventoried } from "@/lib/platform/route-inventory";

const SAMPLE: Record<string, string> = {
  venueId: "20000000-0000-4000-8000-000000000001",
  id: "30000000-0000-4000-8000-000000000001",
  slug: "sala-norte",
  token: "a".repeat(43),
};

type RouteFile = { file: string; url: string };
function routeFiles(dir = "src/app", base = ""): RouteFile[] {
  const out: RouteFile[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const segment = name.startsWith("(") ? "" : `/${name.replace(/\[(\w+)\]/g, (_, p) => SAMPLE[p] ?? "x")}`;
      out.push(...routeFiles(path, base + segment));
    } else if (name === "page.tsx" || name === "route.ts") out.push({ file: path, url: base || "/" });
  }
  return out;
}

describe("inventario de rutas: todas clasificadas, denegar por defecto", () => {
  const files = routeFiles();

  it("cada página y cada API del proyecto está clasificada como pública, de empresa o de plataforma", () => {
    expect(files.length).toBeGreaterThan(50);
    const missing = files.filter((f) => !isRouteInventoried(f.url)).map((f) => `${f.url}  (${f.file})`);
    expect(missing, "Rutas sin clasificar en src/lib/platform/route-inventory.ts").toEqual([]);
  });

  it("lo que no está en el inventario se deniega", () => {
    for (const path of ["/admin/zzz", "/admin/empresas-falsa", "/api/inventada", "/api/platform-admin/otra", "/api/platform-admin/data/x", "/panel/secreto", "/onza/a/b", "/x", "/admin/00000000/qr"])
      expect(classifyRoute(path), path).toBeNull();
  });

  it("las páginas del panel de plataforma se clasifican como plataforma y /admin/<uuid> sigue siendo del local", () => {
    expect(classifyRoute("/admin")).toMatchObject({ cls: "platform", gate: "operator" });
    for (const page of PLATFORM_PAGES) expect(classifyRoute(`/admin/${page}`), page).toMatchObject({ cls: "platform", gate: "operator" });
    expect(classifyRoute("/admin/empresas/30000000-0000-4000-8000-000000000001")).toMatchObject({ cls: "platform", gate: "operator" });
    expect(classifyRoute("/admin/20000000-0000-4000-8000-000000000001")).toMatchObject({ cls: "company", gate: "member" });
    expect(classifyRoute("/admin/20000000-0000-4000-8000-000000000001/qr")).toMatchObject({ cls: "company" });
    expect(classifyRoute("/api/platform-admin/data")).toMatchObject({ cls: "platform", gate: "operator" });
    expect(classifyRoute("/api/platform-admin/commands")).toMatchObject({ cls: "platform", gate: "operator" });
    expect(classifyRoute("/admin/acceso")).toMatchObject({ cls: "public", gate: "none" });
  });

  it("cada ruta de plataforma con control de operador llama a su comprobación del servidor", () => {
    const platform = files.filter((f) => classifyRoute(f.url)?.gate === "operator");
    expect(platform.length).toBeGreaterThanOrEqual(2);
    for (const f of platform) {
      const source = readFileSync(f.file, "utf8");
      const api = f.file.endsWith("route.ts");
      expect(source, f.file).toMatch(api ? /guardPlatformRequest\(request,\s*\{\s*sensitive:/ : /requirePlatformPage\(/);
    }
  });

  it("las rutas de plataforma con el acceso anterior (rol `onza`) están a la vista: deuda registrada, no se agregan más sin decidirlo", () => {
    const legacy = files.filter((f) => classifyRoute(f.url)?.gate === "legacy-onza").map((f) => f.url).sort();
    expect(legacy).toEqual(["/api/onza", "/api/platform", "/onza", "/onza/catalogo", "/onza/economia", "/onza/moderacion"]);
  });

  it("toda regla tiene un control declarado y las de plataforma o empresa nunca son `none`", () => {
    for (const rule of ROUTE_RULES) {
      expect(rule.gate).toBeTruthy();
      if (rule.cls !== "public") expect(rule.gate, String(rule.pattern)).not.toBe("none");
    }
  });
});
