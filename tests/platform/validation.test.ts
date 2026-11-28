import { describe, it, expect } from "vitest";
import { organizationSchema, normalizeOrganization } from "@/features/platform/schemas";
import { slugify, validatePhone, validateTaxId } from "@/features/platform/validation";

describe("validación por país", () => {
  it("Costa Rica: distingue cédula física, jurídica, DIMEX y rechaza el resto", () => {
    expect(validateTaxId("CR", "1-2345-6789")).toMatchObject({ ok: true, value: "123456789", label: "Cédula física" });
    expect(validateTaxId("CR", "3-101-123456")).toMatchObject({ ok: true, value: "3101123456", label: "Cédula jurídica" });
    expect(validateTaxId("CR", "155812345678")).toMatchObject({ ok: true, label: "DIMEX" });
    for (const bad of ["", "123", "12345678901234", "12-ABC-6789"]) expect(validateTaxId("CR", bad).ok, bad).toBe(false);
  });
  it("teléfonos: con o sin código de país, en formato internacional, y rechaza otro país", () => {
    expect(validatePhone("CR", "8888 7777")).toEqual({ ok: true, value: "+50688887777" });
    expect(validatePhone("CR", "+506 2222-3333")).toEqual({ ok: true, value: "+50622223333" });
    expect(validatePhone("CR", "+52 5512345678").ok).toBe(false);
    for (const bad of ["1234", "0888 7777", "88887777999", "abcdefgh"]) expect(validatePhone("CR", bad).ok, bad).toBe(false);
    expect(validatePhone("MX", "55 1234 5678")).toEqual({ ok: true, value: "+525512345678" });
  });
  it("otros países validan formato y longitud", () => {
    expect(validateTaxId("MX", "ABC010101AB1").ok).toBe(true);
    expect(validateTaxId("MX", "123").ok).toBe(false);
    expect(validateTaxId("CO", "900123456").ok).toBe(true);
    expect(validateTaxId("US", "123456789").ok).toBe(true);
    expect(validateTaxId("ES", "B12345678").ok).toBe(true);
    expect(validateTaxId("GT", "1234567K").ok).toBe(true);
    expect(validateTaxId("PA", "8-123-456").ok).toBe(true);
  });
  it("slugify quita tildes y símbolos", () => {
    expect(slugify("  Bar Ñandú & Café  ")).toBe("bar-nandu-cafe");
    expect(slugify("¡¡¡")).toBe("");
  });
  it("el esquema de la empresa aplica documento y teléfono del país y normaliza para la base", () => {
    const base = { name: "Bar Central", slug: "bar-central", tax_id: "3-101-123456", country: "CR", contact_phone: "8888 7777" };
    const ok = organizationSchema.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(normalizeOrganization(ok.data)).toMatchObject({ tax_id: "3101123456", contact_phone: "+50688887777", contact_email: null });
    const bad = organizationSchema.safeParse({ ...base, tax_id: "12", contact_phone: "1" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.map((i) => i.path[0]).sort()).toEqual(["contact_phone", "tax_id"]);
    expect(organizationSchema.safeParse({ ...base, country: "ZZ" }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...base, slug: "Mal Slug" }).success).toBe(false);
  });
});
