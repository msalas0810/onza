export const adminTabIds = [
  "resumen",
  "pedidos",
  "menu",
  "disponibilidad",
  "negocio",
  "equipo",
] as const;
export type AdminTab = (typeof adminTabIds)[number];
export const adminTabLabels: Record<AdminTab, string> = {
  resumen: "Resumen",
  pedidos: "Pedidos",
  menu: "Menú",
  disponibilidad: "Disponibilidad",
  negocio: "Negocio",
  equipo: "Equipo",
};
export const isAdminTab = (value: unknown): value is AdminTab =>
  adminTabIds.some((id) => id === value);
