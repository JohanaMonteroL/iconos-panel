// Control rápido de "pagado" — una sola fecha (`ultimo_pago_marcado`) en vez
// de un historial. Se considera "pagado" mientras esa fecha caiga dentro del
// período actual según la periodicidad del pago; al cambiar de período
// (mes/bimestre/trimestre/semestre/año) vuelve solo a "pendiente". No genera
// tarjetas ni períodos nuevos como Cobros — es solo una bandera.

import type { Periodicidad } from "@/types/db";

function bucket(mes: number, tam: number): number {
  return Math.ceil(mes / tam);
}

/** Identificador del período al que pertenece `fecha`, según periodicidad. */
export function claveDePeriodo(periodicidad: Periodicidad, fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  switch (periodicidad) {
    case "unica_vez":
      return "unica";
    case "mensual":
      return `${anio}-${String(mes).padStart(2, "0")}`;
    case "bimestral":
      return `${anio}-B${bucket(mes, 2)}`;
    case "trimestral":
      return `${anio}-T${bucket(mes, 3)}`;
    case "semestral":
      return `${anio}-S${bucket(mes, 6)}`;
    case "anual":
      return `${anio}`;
  }
}

/**
 * "Única vez" no se resetea — una vez marcada, queda pagada. Las demás
 * periodicidades comparan el período de `ultimoPagoMarcado` contra el de hoy.
 */
export function estaPagadoEnPeriodoActual(
  periodicidad: Periodicidad,
  ultimoPagoMarcado: string | null | undefined,
  ahora: Date = new Date()
): boolean {
  if (!ultimoPagoMarcado) return false;
  if (periodicidad === "unica_vez") return true;
  const fechaMarcado = new Date(`${ultimoPagoMarcado}T00:00:00`);
  return claveDePeriodo(periodicidad, fechaMarcado) === claveDePeriodo(periodicidad, ahora);
}

const ETIQUETA_PERIODO: Record<Periodicidad, string> = {
  unica_vez: "",
  mensual: "este mes",
  bimestral: "este bimestre",
  trimestral: "este trimestre",
  semestral: "este semestre",
  anual: "este año",
};

export function etiquetaPeriodoActual(periodicidad: Periodicidad): string {
  return ETIQUETA_PERIODO[periodicidad] ?? "";
}
