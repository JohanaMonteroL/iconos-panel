// Gráfica de barras verticales inline en SVG. Mantiene proporción al escalar
// (no se estira horizontalmente como pasta).

export type BarData = {
  label: string;
  value: number;
  color?: string;
};

type Props = {
  data: BarData[];
  /** Color por default de las barras */
  color?: string;
  showValues?: boolean;
};

export default function BarChart({
  data,
  color = "var(--text-primary)",
  showValues = true,
}: Props) {
  const total = data.length;
  if (total === 0) return null;

  // Unidades del viewBox en "píxeles virtuales" — la SVG escala manteniendo
  // proporción gracias al preserveAspectRatio por default.
  const SLOT = 60;
  const W = total * SLOT;
  const H = 220;
  const BAR_W = 22;
  const TOP_PAD = 24; // espacio arriba para el valor
  const BOTTOM_PAD = 28; // espacio abajo para el label
  const chartH = H - TOP_PAD - BOTTOM_PAD;
  const baseY = TOP_PAD + chartH;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="auto"
      style={{ display: "block", maxHeight: 260 }}
    >
      {/* línea base */}
      <line
        x1={0}
        y1={baseY}
        x2={W}
        y2={baseY}
        stroke="var(--border-subtle)"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const slotX = i * SLOT;
        const cx = slotX + SLOT / 2;
        const h = d.value > 0 ? (d.value / maxVal) * chartH : 0;
        const y = baseY - h;
        const c = d.color ?? color;
        return (
          <g key={d.label}>
            {d.value > 0 ? (
              <rect
                x={cx - BAR_W / 2}
                y={y}
                width={BAR_W}
                height={h}
                rx={3}
                ry={3}
                fill={c}
              />
            ) : (
              <rect
                x={cx - BAR_W / 2}
                y={baseY - 2}
                width={BAR_W}
                height={2}
                rx={1}
                ry={1}
                fill="var(--border-default)"
              />
            )}
            {showValues && d.value > 0 && (
              <text
                x={cx}
                y={y - 8}
                textAnchor="middle"
                fill="var(--text-secondary)"
                style={{
                  font: "600 12px ui-sans-serif, system-ui",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.value}
              </text>
            )}
            <text
              x={cx}
              y={H - 8}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              style={{
                font: "500 11px ui-sans-serif, system-ui",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
