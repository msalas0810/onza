/** Validación de documento de identidad (cédula/ID fiscal) y teléfono según el país. Compartida por el asistente y el servidor. */
export type Country = "CR" | "PA" | "GT" | "MX" | "CO" | "US" | "ES";
export const COUNTRIES: Record<Country, { name: string; dial: string; currency: string }> = {
  CR: { name: "Costa Rica", dial: "+506", currency: "CRC" },
  PA: { name: "Panamá", dial: "+507", currency: "USD" },
  GT: { name: "Guatemala", dial: "+502", currency: "GTQ" },
  MX: { name: "México", dial: "+52", currency: "MXN" },
  CO: { name: "Colombia", dial: "+57", currency: "COP" },
  US: { name: "Estados Unidos", dial: "+1", currency: "USD" },
  ES: { name: "España", dial: "+34", currency: "EUR" },
};
export const isCountry = (value: string): value is Country => value in COUNTRIES;

type Result = { ok: true; value: string; label?: string } | { ok: false; message: string };
const digits = (v: string) => v.replace(/[\s().-]/g, "");

/** Teléfono: se acepta con o sin el código del país; se devuelve en formato E.164 (+506XXXXXXXX). */
export function validatePhone(country: Country, input: string): Result {
  const dial = COUNTRIES[country].dial;
  let raw = digits(input.trim());
  if (raw.startsWith(dial)) raw = raw.slice(dial.length);
  else if (raw.startsWith("+")) return { ok: false, message: `El teléfono debe ser de ${COUNTRIES[country].name} (${dial}).` };
  if (!/^\d+$/.test(raw)) return { ok: false, message: "El teléfono solo puede llevar números." };
  const rules: Record<Country, [RegExp, string]> = {
    CR: [/^[2-8]\d{7}$/, "Un teléfono de Costa Rica tiene 8 dígitos (por ejemplo 8888 7777)."],
    PA: [/^\d{7,8}$/, "Un teléfono de Panamá tiene 7 u 8 dígitos."],
    GT: [/^[2-7]\d{7}$/, "Un teléfono de Guatemala tiene 8 dígitos."],
    MX: [/^\d{10}$/, "Un teléfono de México tiene 10 dígitos."],
    CO: [/^3\d{9}$|^[1-8]\d{9}$/, "Un teléfono de Colombia tiene 10 dígitos."],
    US: [/^[2-9]\d{9}$/, "Un teléfono de Estados Unidos tiene 10 dígitos."],
    ES: [/^[6-9]\d{8}$/, "Un teléfono de España tiene 9 dígitos."],
  };
  const [pattern, message] = rules[country];
  return pattern.test(raw) ? { ok: true, value: `${dial}${raw}` } : { ok: false, message };
}

/** Documento: Costa Rica distingue cédula física, jurídica, DIMEX y NITE; los demás países validan formato y longitud. */
export function validateTaxId(country: Country, input: string): Result {
  const raw = digits(input.trim()).toUpperCase();
  if (!raw) return { ok: false, message: "Ingrese el documento de identidad." };
  switch (country) {
    case "CR": {
      if (!/^\d+$/.test(raw)) return { ok: false, message: "La cédula solo lleva números (con o sin guiones)." };
      if (raw.length === 9) return { ok: true, value: raw, label: "Cédula física" };
      if (raw.length === 10) return { ok: true, value: raw, label: raw.startsWith("3") ? "Cédula jurídica" : "NITE" };
      if (raw.length === 11 || raw.length === 12) return { ok: true, value: raw, label: "DIMEX" };
      return { ok: false, message: "En Costa Rica la cédula física tiene 9 dígitos, la jurídica 10 y el DIMEX 11 o 12." };
    }
    case "PA":
      return /^[A-Z0-9]{5,20}$/.test(raw) ? { ok: true, value: raw, label: "RUC o cédula" } : { ok: false, message: "En Panamá use de 5 a 20 letras o números." };
    case "GT":
      return /^\d{7,9}[0-9K]?$/.test(raw) ? { ok: true, value: raw, label: "NIT" } : { ok: false, message: "El NIT de Guatemala tiene de 7 a 9 dígitos." };
    case "MX":
      return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(raw) ? { ok: true, value: raw, label: "RFC" } : { ok: false, message: "El RFC de México tiene 12 o 13 caracteres (por ejemplo ABC010101AB1)." };
    case "CO":
      return /^\d{9,10}$/.test(raw) ? { ok: true, value: raw, label: "NIT" } : { ok: false, message: "El NIT de Colombia tiene 9 o 10 dígitos." };
    case "US":
      return /^\d{9}$/.test(raw) ? { ok: true, value: raw, label: "EIN" } : { ok: false, message: "El EIN de Estados Unidos tiene 9 dígitos." };
    case "ES":
      return /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$/.test(raw) ? { ok: true, value: raw, label: "CIF o NIF" } : { ok: false, message: "El CIF o NIF de España tiene 9 caracteres." };
  }
}

/** Slug seguro a partir de un nombre: minúsculas, sin tildes, con guiones. */
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
