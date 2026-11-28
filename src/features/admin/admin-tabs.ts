// Las pestañas del administrador se ordenan por el momento de la noche en que se usan, no por tipo de dato.
export const adminTabIds = [
  "ahora",
  "pedidos",
  "menu",
  "disponibilidad",
  "entrega",
  "negocio",
  "equipo",
  "fidelizacion",
  "resumen",
] as const;
export type AdminTab = (typeof adminTabIds)[number];
export const defaultAdminTab: AdminTab = "ahora";
export const adminTabLabels: Record<AdminTab, string> = {
  ahora: "Ahora",
  pedidos: "Pedidos",
  menu: "Menú y precios",
  disponibilidad: "Capacidad",
  entrega: "Entrega y QR",
  negocio: "Perfil y horario",
  equipo: "Equipo",
  fidelizacion: "Fidelización y social",
  resumen: "Resumen y CSV",
};
export const adminTabGroups: readonly { label: string; tabs: readonly AdminTab[] }[] = [
  { label: "Durante la noche", tabs: ["ahora", "pedidos"] },
  { label: "Antes de abrir", tabs: ["menu", "disponibilidad", "entrega", "negocio", "equipo", "fidelizacion"] },
  { label: "Al cerrar", tabs: ["resumen"] },
];
export const isAdminTab = (value: unknown): value is AdminTab =>
  adminTabIds.some((id) => id === value);
