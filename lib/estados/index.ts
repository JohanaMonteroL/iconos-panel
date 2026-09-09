// Catálogo central de estados de cotizaciones, con sus etiquetas para
// mostrar al usuario y las clases de badge. Importar de aquí en cualquier
// parte de la app para mantener consistencia.
//
// Desde la fusión Cotizaciones + Estimaciones, un registro nace como
// "estimación" (por_estimar / pendiente_revision_interna) y recorre TODO el
// flujo — sin cambiar de tabla ni de id — hasta "cobrada". Ya no existe un
// vocabulario de estado separado para estimaciones.

export const ESTADOS_COTIZACION = [
  "por_estimar",
  "pendiente_revision_interna",
  "esperando_aprobacion",
  "cambios_solicitados",
  "enviada",
  "aprobada",
  "en_desarrollo",
  "en_espera_de_cobro",
  "pendiente_por_cobrar",
  "rechazada",
  "cobrada",
  "archivada",
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];

// Etiquetas que ve el usuario.
export const ESTADO_LABEL: Record<string, string> = {
  por_estimar: "Por estimar",
  pendiente_revision_interna: "Revisión interna",
  esperando_aprobacion: "Esperando aprobación",
  cambios_solicitados: "Cambios solicitados",
  enviada: "Enviada al cliente",
  aprobada: "Aprobada por cliente",
  en_desarrollo: "En desarrollo",
  en_espera_de_cobro: "En espera de cobro",
  pendiente_por_cobrar: "Pendiente por cobrar",
  rechazada: "Rechazada",
  cobrada: "Cobrada",
  archivada: "Archivada",
};

// Clase de badge para el estado (debe matchear app/globals.css).
export const ESTADO_BADGE: Record<string, string> = {
  por_estimar: "badge-neutral",
  pendiente_revision_interna: "badge-warning",
  esperando_aprobacion: "badge-info",
  cambios_solicitados: "badge-danger",
  enviada: "badge-info",
  aprobada: "badge-success",
  en_desarrollo: "badge-info",
  en_espera_de_cobro: "badge-warning",
  pendiente_por_cobrar: "badge-warning",
  rechazada: "badge-danger",
  cobrada: "badge-success",
  archivada: "badge-neutral",
};

// Helpers
export function labelEstado(estado: string | null | undefined): string {
  if (!estado) return "—";
  return ESTADO_LABEL[estado] ?? estado;
}

export function badgeEstado(estado: string | null | undefined): string {
  if (!estado) return "badge-neutral";
  return ESTADO_BADGE[estado] ?? "badge-neutral";
}

// Orden lógico del flujo (de inicial a final). Útil para selectors.
// Incluye "archivada" al final (housekeeping, no es parte del flujo visual
// principal) — quien construya un tablero kanban debe filtrarla.
export const ORDEN_FLUJO_COTIZACION: EstadoCotizacion[] = [
  "por_estimar",
  "pendiente_revision_interna",
  "esperando_aprobacion",
  "cambios_solicitados",
  "enviada",
  "aprobada",
  "en_desarrollo",
  "en_espera_de_cobro",
  "pendiente_por_cobrar",
  "rechazada",
  "cobrada",
  "archivada",
];

// Estados que cuentan como "estimación por revisar" (badge/campanita del
// header y contador del dashboard).
export const ESTADOS_ESTIMACION_ACTIVA: EstadoCotizacion[] = [
  "por_estimar",
  "pendiente_revision_interna",
];
