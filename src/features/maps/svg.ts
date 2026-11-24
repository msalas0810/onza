/**
 * Validación estricta de planos SVG. No «limpia»: o el archivo cumple una lista cerrada de elementos y atributos seguros, o se
 * rechaza con el motivo. Los planos solo se muestran con <img> (nunca en línea en la página), donde el navegador no ejecuta
 * scripts; esta validación es una segunda capa para que tampoco se almacene nada ejecutable ni que cargue recursos externos.
 * Pura: sin DOM, para poder probarla en Node.
 */
export const SVG_MAX_BYTES = 1_500_000;

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "pattern",
  "use",
  "image",
  "title",
  "desc",
  "symbol",
  "marker",
  "style",
]);
const XMLNS: Record<string, string> = {
  xmlns: "http://www.w3.org/2000/svg",
  "xmlns:xlink": "http://www.w3.org/1999/xlink",
};
const DATA_IMAGE =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const STANDARD_ENTITY = /&(?!(amp|lt|gt|quot|apos);)/;

export type SvgCheck =
  { ok: true; width: number; height: number } | { ok: false; message: string };
const fail = (message: string): SvgCheck => ({ ok: false, message });

/** Quita espacios y caracteres de control: así `java\tscript:` no engaña a las comprobaciones. */
const squash = (v: string) =>
  v.replace(/[\s\u0000-\u001f\u007f]/g, "").toLowerCase();

/** Toda referencia `url(...)` debe apuntar a un id del propio documento (`url(#id)`). */
const externalUrl = (value: string) =>
  [...value.matchAll(/url\(\s*(['"]?)\s*(#?)/gi)].some((m) => m[2] !== "#");

function unsafeCss(css: string) {
  const s = squash(css);
  return (
    /@import|expression\(|behavior:|-moz-binding|javascript:|vbscript:/.test(
      s,
    ) || externalUrl(css)
  );
}

export function validateSvg(source: string): SvgCheck {
  if (source.length > SVG_MAX_BYTES)
    return fail(
      "El SVG pesa más de 1,5 MB. Simplificalo o exportalo como imagen.",
    );
  let text = source.replace(/^﻿/, "").trim();
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text))
    return fail(
      "El SVG define entidades o un DOCTYPE con subconjunto interno, que no se admiten.",
    );
  // Declaración XML y DOCTYPE simples son inertes; cualquier otra instrucción de proceso (hojas de estilo, etc.) no.
  text = text
    .replace(/^<\?xml(?=[\s?])[^>]*\?>/i, "")
    .replace(/<!DOCTYPE[^>[]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (/<\?/.test(text))
    return fail("El SVG contiene instrucciones de proceso que no se admiten.");
  // CDATA solo se acepta dentro de <style>; su contenido se revisa como CSS.
  const styles: string[] = [];
  text = text.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_all, body: string) => {
      styles.push(body.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, ""));
      return "<style></style>";
    },
  );
  if (/<!\[CDATA\[/.test(text))
    return fail("El SVG contiene secciones CDATA fuera de estilos.");
  if (styles.some(unsafeCss))
    return fail(
      "Los estilos del SVG cargan recursos externos o usan construcciones no admitidas.",
    );

  // Etiquetas con comillas respetadas (un `>` dentro de un atributo no las corta); entre etiquetas no puede quedar un `<`.
  const tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  if (/</.test(text.replace(tagRe, "")))
    return fail("El SVG está mal formado.");
  let first = true;
  let width = 0;
  let height = 0;
  let sawRoot = false;
  for (const m of text.matchAll(tagRe)) {
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name))
      return fail(`El SVG contiene un elemento no permitido: <${m[2]}>.`);
    if (first && (closing || name !== "svg"))
      return fail("El archivo no es un SVG.");
    first = false;
    if (closing) continue;
    const attrs = new Map<string, string>();
    for (const a of m[3].matchAll(
      /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
    )) {
      const key = a[1].toLowerCase();
      const value = a[2] ?? a[3] ?? a[4] ?? "";
      attrs.set(key, value);
      if (key.startsWith("on"))
        return fail(
          "El SVG contiene manejadores de eventos (onload, onclick…).",
        );
      if (key === "src" || key === "srcdoc")
        return fail("El SVG contiene atributos no permitidos.");
      if (key.startsWith("xmlns")) {
        if (XMLNS[key] !== value)
          return fail("El SVG declara un espacio de nombres no admitido.");
        continue;
      }
      if (STANDARD_ENTITY.test(value) || /&#/i.test(value))
        return fail(
          "El SVG usa entidades en sus atributos, que no se admiten.",
        );
      const squashed = squash(value);
      if (/^(javascript|vbscript):/.test(squashed))
        return fail("El SVG contiene enlaces ejecutables.");
      if (key === "href" || key === "xlink:href") {
        if (!(value.trim().startsWith("#") || DATA_IMAGE.test(value.trim())))
          return fail(
            "El SVG referencia archivos externos. Incrustá la imagen o quitá el enlace.",
          );
      } else if (/^data:/.test(squashed)) {
        return fail("El SVG contiene datos incrustados no admitidos.");
      }
      if (key === "style" ? unsafeCss(value) : externalUrl(value))
        return fail("El SVG referencia recursos externos.");
    }
    if (name === "svg" && !sawRoot) {
      sawRoot = true;
      const box = attrs
        .get("viewbox")
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
      if (
        box &&
        box.length === 4 &&
        box.every(Number.isFinite) &&
        box[2] > 0 &&
        box[3] > 0
      ) {
        width = box[2];
        height = box[3];
      } else {
        const w = Number.parseFloat(attrs.get("width") ?? "");
        const h = Number.parseFloat(attrs.get("height") ?? "");
        if (
          /^[\d.]+(px)?$/.test(attrs.get("width") ?? "") &&
          /^[\d.]+(px)?$/.test(attrs.get("height") ?? "") &&
          w > 0 &&
          h > 0
        ) {
          width = w;
          height = h;
        }
      }
    }
  }
  if (!sawRoot) return fail("El archivo no es un SVG.");
  if (!/<\/svg\s*>\s*$/i.test(text))
    return fail("El SVG está incompleto o tiene contenido después del cierre.");
  if (!(width > 0 && height > 0))
    return fail("El SVG necesita un viewBox o un ancho y alto en píxeles.");
  // Solo importa la proporción: se normaliza a ~1600 px en el lado mayor para guardar medidas enteras.
  const k = 1600 / Math.max(width, height);
  const w = Math.round(width * k);
  const h = Math.round(height * k);
  if (w < 64 || h < 64 || w > 8000 || h > 8000)
    return fail("La proporción del SVG es demasiado extrema para un plano.");
  return { ok: true, width: w, height: h };
}
