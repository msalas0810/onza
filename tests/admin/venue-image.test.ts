import { describe, it, expect } from "vitest";
import {
  checkVenueImage,
  sniffImageType,
  venueImagePath,
  venueImagePathFromUrl,
  VENUE_IMAGE_MAX_BYTES,
} from "@/features/admin/venue-image";

const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const webp = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const blob = (bytes: number[], type: string, pad = 0) =>
  new Blob([new Uint8Array(bytes), new Uint8Array(pad)], { type });
const venue = "20000000-0000-4000-8000-000000000001";

describe("checkVenueImage", () => {
  it("acepta jpg, png y webp reales de hasta 2 MB", async () => {
    expect(await checkVenueImage(blob(jpeg, "image/jpeg"))).toEqual({
      ok: true,
      type: "image/jpeg",
      extension: "jpg",
    });
    expect(await checkVenueImage(blob(png, "image/png"))).toMatchObject({
      ok: true,
      extension: "png",
    });
    expect(await checkVenueImage(blob(webp, "image/webp"))).toMatchObject({
      ok: true,
      extension: "webp",
    });
    const exact = blob(jpeg, "image/jpeg", VENUE_IMAGE_MAX_BYTES - jpeg.length);
    expect(exact.size).toBe(VENUE_IMAGE_MAX_BYTES);
    expect(await checkVenueImage(exact)).toMatchObject({ ok: true });
  });

  it("rechaza más de 2 MB", async () => {
    const big = blob(jpeg, "image/jpeg", VENUE_IMAGE_MAX_BYTES);
    const result = await checkVenueImage(big);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.message).toMatch(/2 MB/);
  });

  it("rechaza tipos no permitidos (svg, gif, avif, pdf, html)", async () => {
    for (const type of [
      "image/svg+xml",
      "image/gif",
      "image/avif",
      "application/pdf",
      "text/html",
      "",
    ])
      expect(await checkVenueImage(blob(jpeg, type)), type).toMatchObject({
        ok: false,
      });
  });

  it("rechaza archivos renombrados: el contenido real debe coincidir con el tipo", async () => {
    expect(
      await checkVenueImage(blob([0x3c, 0x73, 0x76, 0x67, 0x3e], "image/png")),
    ).toMatchObject({ ok: false });
    expect(await checkVenueImage(blob(png, "image/jpeg"))).toMatchObject({
      ok: false,
    });
    expect(await checkVenueImage(blob([], "image/png"))).toMatchObject({
      ok: false,
    });
  });

  it("sniffImageType reconoce firmas y devuelve null en el resto", () => {
    expect(sniffImageType(new Uint8Array(jpeg))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(png))).toBe("image/png");
    expect(sniffImageType(new Uint8Array(webp))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("rutas y URLs", () => {
  it("la ruta queda en una sola carpeta con el id del local", () => {
    expect(venueImagePath(venue, "cover", "webp", "abc")).toBe(
      `${venue}/cover-abc.webp`,
    );
  });
  it("recupera la ruta de una URL pública solo si es del propio local", () => {
    const path = venueImagePath(venue, "logo", "png", "abc");
    const url = `https://x.supabase.co/storage/v1/object/public/venue-images/${venue}/logo-abc.png`;
    expect(venueImagePathFromUrl(url, venue)).toBe(path);
    expect(
      venueImagePathFromUrl(url, "20000000-0000-4000-8000-000000000002"),
    ).toBeNull();
    expect(venueImagePathFromUrl(null, venue)).toBeNull();
    expect(
      venueImagePathFromUrl("https://evil.example/a.png", venue),
    ).toBeNull();
    expect(
      venueImagePathFromUrl(
        `https://x.supabase.co/storage/v1/object/public/venue-images/${venue}/a/b.png`,
        venue,
      ),
    ).toBeNull();
  });
});
