// Barra de progreso de cobro de un período: cuánto se ha pagado del monto.
// Se usa en la tarjeta del tablero de Cobros y en el detalle del período.
// Color: gris sin pagos, acento con abonos parciales, verde al 100%.

function fmt(n: number, moneda: string): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function porcentajeCobrado(pagado: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((pagado / total) * 100);
}

export default function BarraCobro({
  pagado,
  total,
  moneda,
  grande = false,
}: {
  pagado: number;
  total: number;
  moneda: string;
  grande?: boolean;
}) {
  if (!(total > 0)) return null;
  const pct = porcentajeCobrado(pagado, total);
  const completo = pagado >= total;
  const color = completo ? "var(--state-success)" : pagado > 0 ? "var(--accent)" : "var(--border-default)";
  const texto = completo
    ? pagado > total
      ? `Pagado de más: ${fmt(pagado, moneda)} de ${fmt(total, moneda)}`
      : "Pagado por completo"
    : pagado > 0
      ? `Pagado ${fmt(pagado, moneda)} de ${fmt(total, moneda)}`
      : "Sin pagos aún";

  return (
    <div>
      <div
        className="flex items-center justify-between gap-2"
        style={{ fontSize: grande ? 13 : 11, color: "var(--text-secondary)", marginBottom: grande ? 6 : 4 }}
      >
        <span className="truncate">{texto}</span>
        <span className="num-tabular shrink-0" style={{ fontWeight: 600, color: completo ? "var(--state-success)" : "var(--text-primary)" }}>
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-label="Porcentaje cobrado"
        style={{
          height: grande ? 10 : 6,
          borderRadius: 999,
          background: "var(--bg-overlay)",
          overflow: "hidden",
        }}
      >
        <div
          className="barra-llenar-anim"
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}
