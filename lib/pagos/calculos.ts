// Formato de montos para Pagos — siempre MXN (son pagos a proveedores
// locales, SUA y similares); no hay manejo multi-moneda como en Cobros.

// Siempre con centavos — "$2,000.00", nunca "$2,000" — para que todos los
// montos de Pagos se vean consistentes entre sí.
export function fmtMXN(n: number): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }
}

// IVA es un porcentaje (ej. 16), no un monto — "monto" es la base y el IVA
// se calcula sobre ella, igual que en una factura real.
export function fmtPercent(n: number): string {
  return `${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

export function montoIVA(monto: number, ivaPct: number): number {
  return monto * (ivaPct / 100);
}

export function calcularTotal(monto: number, ivaPct: number): number {
  return monto + montoIVA(monto, ivaPct);
}
