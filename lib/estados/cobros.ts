// Catálogo de estados de un Período de Cobro — hermano de lib/estados/index.ts
// (que sigue manejando los estados de Cotizaciones). Mismo patrón exacto:
// arreglo de valores válidos, etiquetas, clases de badge, colores hex, y
// helpers que devuelven un fallback seguro si el estado viene vacío o no
// reconocido.

export const ESTADOS_COBRO_PERIODO = [
  "listo_para_cobrar",
  "esperando_aprobacion_pago",
  "por_facturar",
  "facturado",
] as const;

export type EstadoCobroPeriodo = (typeof ESTADOS_COBRO_PERIODO)[number];

export const ORDEN_FLUJO_COBRO_PERIODO: EstadoCobroPeriodo[] = [
  "listo_para_cobrar",
  "esperando_aprobacion_pago",
  "por_facturar",
  "facturado",
];

// Etiquetas que ve el usuario — nombres tal cual los dio Johana.
export const ESTADO_PERIODO_LABEL: Record<string, string> = {
  listo_para_cobrar: "Listo para cobrar",
  esperando_aprobacion_pago: "Esperando aprobación de pago",
  por_facturar: "Por facturar",
  facturado: "Facturado",
};

// Clase de badge por estado — debe matchear las clases `.periodo-badge-*`
// en app/globals.css.
export const ESTADO_PERIODO_BADGE: Record<string, string> = {
  listo_para_cobrar: "periodo-badge-listo_para_cobrar",
  esperando_aprobacion_pago: "periodo-badge-esperando_aprobacion_pago",
  por_facturar: "periodo-badge-por_facturar",
  facturado: "periodo-badge-facturado",
};

// Mismo color que ESTADO_PERIODO_BADGE pero como hex plano, para el punto
// de color de las columnas del tablero (se dibuja con un div inline).
export const ESTADO_PERIODO_COLOR_HEX: Record<string, string> = {
  listo_para_cobrar: "#CA8A04",
  esperando_aprobacion_pago: "#7C3AED",
  por_facturar: "#2563EB",
  facturado: "#16A34A",
};

export function labelEstadoPeriodo(estado: string | null | undefined): string {
  if (!estado) return "—";
  return ESTADO_PERIODO_LABEL[estado] ?? estado;
}

export function badgeEstadoPeriodo(estado: string | null | undefined): string {
  if (!estado) return "periodo-badge-listo_para_cobrar";
  return ESTADO_PERIODO_BADGE[estado] ?? "periodo-badge-listo_para_cobrar";
}

export function colorHexEstadoPeriodo(estado: string | null | undefined): string {
  if (!estado) return ESTADO_PERIODO_COLOR_HEX.listo_para_cobrar;
  return ESTADO_PERIODO_COLOR_HEX[estado] ?? ESTADO_PERIODO_COLOR_HEX.listo_para_cobrar;
}

// Etiqueta Desarrollo/Soporte — badge de "origen" del Cobro.
export const ORIGEN_COBRO_LABEL: Record<string, string> = {
  desarrollo: "Desarrollo",
  soporte: "Soporte",
};

export const ORIGEN_COBRO_COLOR_HEX: Record<string, string> = {
  desarrollo: "#4F46E5",
  soporte: "#0D9488",
};

export function labelOrigenCobro(origen: string | null | undefined): string {
  if (!origen) return "—";
  return ORIGEN_COBRO_LABEL[origen] ?? origen;
}

export function colorHexOrigenCobro(origen: string | null | undefined): string {
  if (!origen) return ORIGEN_COBRO_COLOR_HEX.desarrollo;
  return ORIGEN_COBRO_COLOR_HEX[origen] ?? ORIGEN_COBRO_COLOR_HEX.desarrollo;
}
