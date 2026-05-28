// Donut chart inline en SVG. Sin libs.

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
};

export default function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={thickness}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          style={{ font: "13px ui-sans-serif, system-ui" }}
        >
          Sin datos
        </text>
      </svg>
    );
  }

  // Construimos los arcos con stroke-dasharray para que cada uno ocupe su
  // proporción. El rotate(-90) pone el inicio arriba.
  let offset = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
    >
      {/* Pista de fondo */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={thickness}
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((d) => {
          const pct = d.value / total;
          const dash = circ * pct;
          const gap = circ - dash;
          const el = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </g>
      {(centerValue !== undefined || centerLabel) && (
        <g>
          {centerValue !== undefined && (
            <text
              x="50%"
              y="46%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="var(--text-primary)"
              style={{
                font: "700 28px ui-sans-serif, system-ui",
              }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x="50%"
              y="62%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="var(--text-tertiary)"
              style={{
                font: "500 11px ui-sans-serif, system-ui",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
