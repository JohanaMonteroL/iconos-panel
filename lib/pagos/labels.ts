// Catálogos de etiquetas para Pagos — mismo patrón que lib/estados/cobros.ts:
// valores válidos + mapa a etiqueta legible, con fallback si viene vacío.

import type { Periodicidad, FormaPago, TipoPago, ComprobanteTipo } from "@/types/db";

export const PERIODICIDADES: Periodicidad[] = [
  "unica_vez",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
];

export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = {
  unica_vez: "Única vez",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  automatica: "Automática",
  manual: "Manual",
};

export const TIPOS_PAGO: TipoPago[] = ["transferencia", "tarjeta", "deposito", "otro"];

export const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  deposito: "Depósito",
  otro: "Otro",
};

export const COMPROBANTE_TIPOS: ComprobanteTipo[] = ["factura", "recibo", "no_aplica"];

export const COMPROBANTE_TIPO_LABEL: Record<ComprobanteTipo, string> = {
  factura: "Factura",
  recibo: "Recibo",
  no_aplica: "No aplica",
};

export function labelPeriodicidad(v: string | null | undefined): string {
  if (!v) return "—";
  return PERIODICIDAD_LABEL[v as Periodicidad] ?? v;
}

export function labelFormaPago(v: string | null | undefined): string {
  if (!v) return "—";
  return FORMA_PAGO_LABEL[v as FormaPago] ?? v;
}

export function labelTipoPago(v: string | null | undefined): string {
  if (!v) return "—";
  return TIPO_PAGO_LABEL[v as TipoPago] ?? v;
}

export function labelComprobanteTipo(v: string | null | undefined): string {
  if (!v) return "—";
  return COMPROBANTE_TIPO_LABEL[v as ComprobanteTipo] ?? v;
}
