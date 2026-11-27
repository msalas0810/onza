/**
 * SIMULADO. Ejemplo del mapa de actividad para el demo, separado de los datos reales y rotulado en pantalla.
 * Lugares ficticios sobre un plano esquemático (x, y de 0 a 1): no son locales reales ni coordenadas reales.
 */
export const simulatedActivity = {
  points: [
    { id: "sim-a", name: "Local simulado A", zone: "Zona ficticia norte", level: 3, x: 0.3, y: 0.32 },
    { id: "sim-b", name: "Local simulado B", zone: "Zona ficticia norte", level: 2, x: 0.42, y: 0.4 },
    { id: "sim-c", name: "Local simulado C", zone: "Zona ficticia centro", level: 1, x: 0.62, y: 0.55 },
    { id: "sim-d", name: "Local simulado D", zone: "Zona ficticia sur", level: 2, x: 0.74, y: 0.72 },
    { id: "sim-e", name: "Local simulado E", zone: "Zona ficticia oeste", level: 1, x: 0.16, y: 0.7 },
  ],
} as const;
