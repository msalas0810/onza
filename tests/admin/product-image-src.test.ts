import { describe, it, expect } from "vitest";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { venueImagePath } from "@/features/admin/venue-image";

const url = "https://x.supabase.co";
describe("productImageSrc", () => {
  it("prefiere image_url", () => {
    expect(
      productImageSrc(
        { image_url: "https://x.supabase.co/a.png", photo_path: "v/old.jpg" },
        url,
      ),
    ).toBe("https://x.supabase.co/a.png");
  });
  it("usa la foto antigua si solo existe photo_path", () => {
    expect(
      productImageSrc({ image_url: null, photo_path: "v/old.jpg" }, url),
    ).toBe(
      "https://x.supabase.co/storage/v1/object/public/menu-photos/v/old.jpg",
    );
    expect(
      productImageSrc({ image_url: null, photo_path: "v/old.jpg" }, `${url}/`),
    ).toBe(
      "https://x.supabase.co/storage/v1/object/public/menu-photos/v/old.jpg",
    );
  });
  it("devuelve null (placeholder) si no hay nada o falta la URL de Supabase", () => {
    expect(
      productImageSrc({ image_url: null, photo_path: null }, url),
    ).toBeNull();
    expect(
      productImageSrc({ image_url: null, photo_path: "v/old.jpg" }, undefined),
    ).toBeNull();
  });
});

describe("ruta de imagen de trago", () => {
  it("queda en la carpeta del local con prefijo product-, como exige la función SQL", () => {
    expect(
      venueImagePath(
        "20000000-0000-4000-8000-000000000001",
        "product",
        "webp",
        "abc",
      ),
    ).toBe("20000000-0000-4000-8000-000000000001/product-abc.webp");
  });
});
