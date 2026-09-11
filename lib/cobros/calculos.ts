// Cálculos compartidos de Cobros — usados tanto en el server component del
// tablero/detalle como en las rutas de API que validan transiciones.

export type PagoCalc = { monto: number | string };

export type PeriodoCalc = {
  monto: number | string;
  factura_pdf_path?: string | null;
  factura_xml_path?: string | null;
};

/** Suma de todos los pagos registrados de un período. */
export function montoPagado(pagos: PagoCalc[]): number {
  return pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
}

/** Lo que falta por pagar de un período (nunca negativo). */
export function pendientePeriodo(periodo: PeriodoCalc, pagos: PagoCalc[]): number {
  const pendiente = Number(periodo.monto || 0) - montoPagado(pagos);
  return pendiente > 0 ? pendiente : 0;
}

/**
 * Estado de la factura de un período — puramente informativo, nunca
 * bloquea nada (la factura PDF/XML es siempre opcional).
 */
export function estadoFactura(
  periodo: PeriodoCalc
): "ninguna" | "parcial" | "completa" {
  const tienePdf = !!periodo.factura_pdf_path;
  const tieneXml = !!periodo.factura_xml_path;
  if (tienePdf && tieneXml) return "completa";
  if (tienePdf || tieneXml) return "parcial";
  return "ninguna";
}

export type ProyectoTarifaSoporte = {
  soporte_tarifa_hora?: number | null;
  precio_hora_venta?: number | null;
};

/** Tarifa a usar para Soporte: la propia del proyecto, o el costo/hora general si no está capturada. */
export function tarifaSoporte(proyecto: ProyectoTarifaSoporte): number {
  if (proyecto.soporte_tarifa_hora != null && Number(proyecto.soporte_tarifa_hora) > 0) {
    return Number(proyecto.soporte_tarifa_hora);
  }
  return Number(proyecto.precio_hora_venta || 0);
}
