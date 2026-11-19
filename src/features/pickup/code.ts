/**
 * Código privado de retiro: 12 caracteres hexadecimales (los primeros 48 bits del digest del token). Se muestra y se escribe
 * en grupos de cuatro, «AB12 CD34 EF56», igual en el ticket del cliente y en la barra. Pegar con espacios, guiones o en
 * minúsculas se normaliza al formato canónico antes de validar. Nunca es el número público del pedido.
 */
export const PICKUP_CODE_LENGTH = 12;
export function normalizePickupCode(input: string) {
  return input.replace(/[\s‐-―-]/g, "").toUpperCase();
}
export function isPickupCode(input: string) {
  return /^[0-9A-F]{12}$/.test(normalizePickupCode(input));
}
/** Formato visible mientras se escribe: grupos de cuatro; descarta lo que no sea hexadecimal y corta en 12. */
export function formatPickupCode(input: string) {
  const clean = normalizePickupCode(input)
    .replace(/[^0-9A-F]/g, "")
    .slice(0, PICKUP_CODE_LENGTH);
  return clean.match(/.{1,4}/g)?.join(" ") ?? "";
}
