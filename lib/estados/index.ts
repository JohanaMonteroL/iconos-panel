// Catálogo central de estados de estimaciones y cotizaciones, con sus
// etiquetas para mostrar al usuario y las clases de badge. Importar de aquí
// en cualquier parte de la app para mantener consistencia.

export const ESTADOS_ESTIMACION = [
  "recibida",
  "procesada_ia",
  "en_revision",
  "descartada",
] as const;

export const ESTADOS_COTIZACION = [
  "pendiente_revisar",
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "aprobado_cliente",
  "enviada_cliente",
  "en_desarrollo",
  "finalizado",
  "archivada",
] as const;

export type EstadoEstimacion = (typeof ESTADOS_ESTIMACION)[number];
export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];
export type EstadoCualquiera = EstadoEstimacion | EstadoCotizacion;

// Etiquetas que ve el usuario.
export const ESTADO_LABEL: Record<string, string> = {
  // Estimación
  recibida: "Recibida",
  procesada_ia: "Procesada con IA",
  en_revision: "Procesada con IA", // legacy mismo significado
  descartada: "Descartada",
  // Cotización
  pendiente_revisar: "Por revisar",
  esperando_aprobacion: "Esperando jefe",
  aprobada: "Aprobado por Iván",
  cambios_solicitados: "Cambios solicitados",
  aprobado_cliente: "Aprobado por cliente",
  enviada_cliente: "Enviada al cliente",
  en_desarrollo: "En desarrollo",
  finalizado: "Finalizado",
  archivada: "Archivada",
};

// Clase de badge para el estado (debe matchear app/globals.css).
export const ESTADO_BADGE: Record<string, string> = {
  // Estimación
  recibida: "badge-warning",
  procesada_ia: "badge-info",
  en_revision: "badge-info",
  descartada: "badge-neutral",
  // Cotización
  pendiente_revisar: "badge-warning",
  esperando_aprobacion: "badge-info",
  aprobada: "badge-success",
  cambios_solicitados: "badge-danger",
  aprobado_cliente: "badge-success",
  enviada_cliente: "badge-info",
  en_desarrollo: "badge-info",
  finalizado: "badge-success",
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
export const ORDEN_FLUJO_COTIZACION: EstadoCotizacion[] = [
  "pendiente_revisar",
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "aprobado_cliente",
  "enviada_cliente",
  "en_desarrollo",
  "finalizado",
  "archivada",
];

export const ORDEN_FLUJO_ESTIMACION: EstadoEstimacion[] = [
  "recibida",
  "procesada_ia",
  "descartada",
];
