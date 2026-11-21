import { describe, expect, it } from "vitest";
import { isOwnStorageUrl } from "@/lib/storage-url";

const own = "https://abc.supabase.co";
describe("isOwnStorageUrl", () => {
  it("acepta el Storage del propio proyecto y quitar la imagen", () => {
    expect(isOwnStorageUrl(`${own}/storage/v1/object/public/venue-images/x/cover.jpg`, own)).toBe(true);
    expect(isOwnStorageUrl(null, own)).toBe(true);
    expect(isOwnStorageUrl(undefined, own)).toBe(true);
  });
  it("rechaza otros hosts, esquemas y credenciales incrustadas", () => {
    for (const bad of [
      "https://evil.example/storage/v1/object/public/venue-images/x/cover.jpg",
      "https://abc.supabase.co.evil.example/storage/v1/object/public/venue-images/x/cover.jpg",
      "https://abc.supabase.co@evil.example/storage/v1/object/public/venue-images/x/cover.jpg",
      "https://user:pw@abc.supabase.co/storage/v1/object/public/venue-images/x/cover.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
    ])
      expect(isOwnStorageUrl(bad, own), bad).toBe(false);
  });
  it("sin proyecto configurado no acepta ninguna URL", () => {
    expect(isOwnStorageUrl("https://abc.supabase.co/x.jpg", undefined)).toBe(false);
  });
});
