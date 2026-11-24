import { describe, expect, it } from "vitest";
import { validateSvg } from "@/features/maps/svg";
import {
  checkMapImage,
  mapImagePath,
  mapImageUrl,
  sniffMapImage,
  targetSize,
} from "@/features/maps/image";

const wrap = (inner: string, attrs = 'viewBox="0 0 1600 1000"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${inner}</svg>`;
const SAFE = wrap(
  '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><text x="10" y="20">Barra</text>',
);

describe("SVG seguro", () => {
  it("acepta un plano normal y entrega las proporciones", () => {
    expect(validateSvg(SAFE)).toEqual({ ok: true, width: 1600, height: 1000 });
    expect(
      validateSvg(`<?xml version="1.0"?>\n<!-- exportado -->\n${SAFE}\n`),
    ).toMatchObject({ ok: true });
    expect(
      validateSvg(wrap("<rect/>", 'width="800px" height="400px"')),
    ).toEqual({ ok: true, width: 1600, height: 800 });
    expect(
      validateSvg(wrap('<style>.a{fill:url(#g)}</style><rect class="a"/>')),
    ).toMatchObject({ ok: true });
    expect(
      validateSvg(
        wrap(
          '<image href="data:image/png;base64,iVBORw0KGgo=" width="4" height="4"/>',
        ),
      ),
    ).toMatchObject({ ok: true });
  });
  it.each([
    ["script", wrap("<script>alert(1)</script>")],
    ["script en mayúsculas", wrap("<SCRIPT>alert(1)</SCRIPT>")],
    ["foreignObject", wrap("<foreignObject><div/></foreignObject>")],
    ["iframe", wrap('<iframe src="https://x"/>')],
    [
      "animate",
      wrap('<a><animate attributeName="href" to="javascript:alert(1)"/></a>'),
    ],
    [
      "onload",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>`,
    ],
    ["onclick en hijo", wrap('<rect onclick="x()"/>')],
    ["ONERROR mayúsculas", wrap('<image href="#a" ONERROR="x()"/>')],
    ["javascript: en href", wrap('<use href="javascript:alert(1)"/>')],
    ["javascript: ofuscado", wrap('<use xlink:href="java\tscript:alert(1)"/>')],
    ["href externo", wrap('<image href="https://evil.example/x.png"/>')],
    ["href relativo", wrap('<use href="otro.svg#a"/>')],
    [
      "data:text/html",
      wrap('<image href="data:text/html;base64,PHNjcmlwdD4="/>'),
    ],
    [
      "url() externo en atributo",
      wrap('<rect fill="url(https://evil.example/a.svg#x)"/>'),
    ],
    [
      "url() externo en style attr",
      wrap('<rect style="fill:url(//evil.example/x)"/>'),
    ],
    ["@import", wrap("<style>@import url(//evil.example/x.css);</style>")],
    [
      "url() externo en style",
      wrap("<style>.a{background:url('http://evil.example/p')}</style>"),
    ],
    [
      "entidad XXE",
      `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&x;</text></svg>`,
    ],
    ["entidades numéricas", wrap('<use href="&#106;avascript:alert(1)"/>')],
    ["hoja de estilo XML", `<?xml-stylesheet href="a.css"?>${SAFE}`],
    [
      "`>` dentro de atributo para esconder onload",
      wrap('<rect title="a>b" onload="x()"/>'),
    ],
    [
      "xmlns ajeno",
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml" viewBox="0 0 1 1"/>`,
    ],
    [
      "CDATA fuera de style",
      wrap("<text><![CDATA[<script>x</script>]]></text>"),
    ],
    ["texto antes del cierre", `${SAFE}<script>x</script>`],
    ["no es svg", "<html><body/></html>"],
    ["sin dimensiones", wrap("<rect/>", "")],
    ["proporción extrema", wrap("<rect/>", 'viewBox="0 0 100000 10"')],
  ])("rechaza %s", (_name, svg) => {
    expect(validateSvg(svg)).toMatchObject({ ok: false });
  });
  it("rechaza archivos de más de 1,5 MB", () => {
    expect(validateSvg(wrap("<g/>".repeat(500_000)))).toMatchObject({
      ok: false,
    });
  });
});

describe("imagen del plano", () => {
  const bytes = (...v: number[]) => new Uint8Array(v);
  it("detecta el formato real por contenido", () => {
    expect(sniffMapImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(
      sniffMapImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(
      sniffMapImage(
        bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe("image/webp");
    expect(sniffMapImage(new TextEncoder().encode(SAFE))).toBe("image/svg+xml");
    expect(
      sniffMapImage(
        new TextEncoder().encode("<html><script>alert(1)</script>"),
      ),
    ).toBeNull();
    expect(sniffMapImage(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
  it("rechaza tipo declarado ajeno, vacío, renombrado o demasiado grande", async () => {
    const file = (data: BlobPart, type: string) => new Blob([data], { type });
    expect(await checkMapImage(file("x", "application/pdf"))).toMatchObject({
      ok: false,
    });
    expect(await checkMapImage(file("", "image/png"))).toMatchObject({
      ok: false,
    });
    expect(await checkMapImage(file("<html/>", "image/png"))).toMatchObject({
      ok: false,
    });
    expect(
      await checkMapImage(file(new TextEncoder().encode(SAFE), "image/png")),
    ).toMatchObject({ ok: false }); // SVG con tipo falso
    expect(
      await checkMapImage(
        file(new TextEncoder().encode(SAFE), "image/svg+xml"),
      ),
    ).toEqual({ ok: true, type: "image/svg+xml" });
    expect(
      await checkMapImage(file(new Uint8Array(13 * 1024 * 1024), "image/png")),
    ).toMatchObject({ ok: false });
  });
  it("reduce sin agrandar y conserva la proporción", () => {
    expect(targetSize(4800, 3000)).toEqual({ width: 2400, height: 1500 });
    expect(targetSize(1000, 4000)).toEqual({ width: 600, height: 2400 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("las URL salen del Storage del proyecto o de la demo local, nunca de un host indicado por datos", () => {
    const path = mapImagePath(
      "20000000-0000-4000-8000-000000000001",
      "abc",
      "webp",
    );
    expect(path).toBe("20000000-0000-4000-8000-000000000001/abc.webp");
    expect(mapImageUrl(path, "https://p.supabase.co/")).toBe(
      `https://p.supabase.co/storage/v1/object/public/venue-maps/${path}`,
    );
    expect(
      mapImageUrl("static:demo-maps/sala-norte.svg", "https://p.supabase.co"),
    ).toBe("/demo-maps/sala-norte.svg");
  });
});
