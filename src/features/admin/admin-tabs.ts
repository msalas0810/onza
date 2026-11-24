export const adminTabIds = [
  "resumen",
  "pedidos",
  "menu",
  "disponibilidad",
  "negocio",
  "mapas",
  "equipo",
] as const;
export type AdminTab = (typeof adminTabIds)[number];
export const adminTabLabels: Record<AdminTab, string> = {
  resumen: "Resumen",
  pedidos: "Pedidos",
  menu: "Menú",
  disponibilidad: "Disponibilidad",
  negocio: "Negocio",
  mapas: "Mapas",
  equipo: "Equipo",
};
export const isAdminTab = (value: unknown): value is AdminTab =>
  adminTabIds.some((id) => id === value);
