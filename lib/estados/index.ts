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

// Clase de badge para el estado — un color distinto por estado (inspirado
// en los estatus de ClickUp: cada uno tiene su propio color, no solo 4
// familias repetidas). Debe matchear las clases `.estado-badge-*` en
// app/globals.css.
export const ESTADO_BADGE: Record<string, string> = {
  por_estimar: "estado-badge-por_estimar",
  pendiente_revision_interna: "estado-badge-pendiente_revision_interna",
  esperando_aprobacion: "estado-badge-esperando_aprobacion",
  cambios_solicitados: "estado-badge-cambios_solicitados",
  enviada: "estado-badge-enviada",
  aprobada: "estado-badge-aprobada",
  en_desarrollo: "estado-badge-en_desarrollo",
  en_espera_de_cobro: "estado-badge-en_espera_de_cobro",
  pendiente_por_cobrar: "estado-badge-pendiente_por_cobrar",
  rechazada: "estado-badge-rechazada",
  cobrada: "estado-badge-cobrada",
  archivada: "estado-badge-archivada",
};

// Mismo color que ESTADO_BADGE pero como hex plano, para los pocos lugares
// que no pueden usar la clase CSS directamente (ej. el punto de color de
// las columnas del tablero kanban, que se dibuja con un div inline).
export const ESTADO_COLOR_HEX: Record<string, string> = {
  por_estimar: "#71717A",
  pendiente_revision_interna: "#7C3AED",
  esperando_aprobacion: "#D97706",
  cambios_solicitados: "#DB2777",
  enviada: "#2563EB",
  aprobada: "#0D9488",
  en_desarrollo: "#4F46E5",
  en_espera_de_cobro: "#CA8A04",
  pendiente_por_cobrar: "#EA580C",
  rechazada: "#DC2626",
  cobrada: "#16A34A",
  archivada: "#64748B",
};

// Helpers
export function labelEstado(estado: string | null | undefined): string {
  if (!estado) return "—";
  return ESTADO_LABEL[estado] ?? estado;
}

export function badgeEstado(estado: string | null | undefined): string {
  if (!estado) return "estado-badge-por_estimar";
  return ESTADO_BADGE[estado] ?? "estado-badge-por_estimar";
}

export function colorHexEstado(estado: string | null | undefined): string {
  if (!estado) return ESTADO_COLOR_HEX.por_estimar;
  return ESTADO_COLOR_HEX[estado] ?? ESTADO_COLOR_HEX.por_estimar;
}

// Orden lógico del flujo (de inicial a final). Útil para selectors.
// Incluye "archivada" al final (housekeeping, no es parte del flujo visual
// principal) — quien construya un tablero kanban debe filtrarla.
//
// "en_espera_de_cobro" / "pendiente_por_cobrar" / "cobrada" ya NO están
// aquí — desde que existe Cobros (tabla separada), la vida de una
// cotización termina en "en_desarrollo" y ese seguimiento de cobranza pasa
// a vivir en Cobros. Los 3 valores siguen en ESTADOS_COTIZACION/
// ESTADO_LABEL/ESTADO_BADGE de arriba (no se quitan de ahí) para no romper
// el historial de cotizaciones viejas ni el log de acciones, y
// cambiar-estado sigue aceptando "en_espera_de_cobro" como destino válido
// (es el disparador que crea el Cobro).
export const ORDEN_FLUJO_COTIZACION: EstadoCotizacion[] = [
  "por_estimar",
  "pendiente_revision_interna",
  "esperando_aprobacion",
  "cambios_solicitados",
  "enviada",
  "aprobada",
  "en_desarrollo",
  "rechazada",
  "archivada",
];

// Estados que cuentan como "estimación por revisar" (badge/campanita del
// header y contador del dashboard).
export const ESTADOS_ESTIMACION_ACTIVA: EstadoCotizacion[] = [
  "por_estimar",
  "pendiente_revision_interna",
];

// Los 3 estados que "ya viven en Cobros" — no forman parte del flujo
// visual principal (no están en ORDEN_FLUJO_COTIZACION: no aparecen en el
// picker de "Cambiar estado" ni tienen columna en el kanban), pero siguen
// siendo estados reales de cotizaciones ya facturadas/en cobranza. Se
// ofrecen aparte como opciones adicionales en el filtro de "Estado" de la
// lista de Cotizaciones, para poder encontrarlas y seguir editando su
// desglose/tareas sin tener que conocer su id.
export const ESTADOS_YA_EN_COBROS: EstadoCotizacion[] = [
  "en_espera_de_cobro",
  "pendiente_por_cobrar",
  "cobrada",
];
