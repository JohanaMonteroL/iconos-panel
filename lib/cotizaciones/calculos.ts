// Cálculo compartido del monto total de una cotización — mismo criterio
// que usa el servidor en cambiar-estado/route.ts al crear el Cobro: monto
// fijo si es tipo "fijo", o horas_envio × precio_hora_venta DEL PROYECTO si
// es por horas (no cotizaciones.precio_venta_hora — ese es un snapshot
// aparte que casi nunca se captura, ver la nota en cambiar-estado). null si
// todavía no hay datos suficientes para calcularlo.

export function montoCotizacion(
  cot: {
    tipo_precio?: string | null;
    monto_fijo?: number | null;
    horas_envio?: number | null;
  },
  precioHoraVentaProyecto: number | null | undefined
): number | null {
  if (cot.tipo_precio === "fijo") {
    return cot.monto_fijo != null ? Number(cot.monto_fijo) : null;
  }
  if (
    cot.horas_envio != null &&
    precioHoraVentaProyecto != null &&
    Number(precioHoraVentaProyecto) > 0
  ) {
    return Number(cot.horas_envio) * Number(precioHoraVentaProyecto);
  }
  return null;
}
