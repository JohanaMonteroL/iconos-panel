"use client";

// Gráfica de líneas por mes (hasta 2 series), con curva suave, relleno de
// degradado, eje Y con valores redondos, y hover con crosshair + tooltip
// (monto y variación % vs. el mes anterior). Sin librería externa.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fmtMxn, fmtMxnCompacto } from "@/lib/dashboard/calculos";

export type SerieLinea = {
  key: string;
  label: string;
  color: string;
  valores: number[]; // mismo largo que `etiquetas`
};

// Interpolación cúbica monótona (Fritsch–Carlson) — curva suave que pasa
// por cada punto SIN pasarse de los valores vecinos (a diferencia de un
// spline Catmull-Rom, nunca "rebota" por debajo de cero entre dos meses
// bajos junto a un pico, que se leería como un dato negativo falso).
function pathSuave(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  const dx: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    d.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }

  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    if (a < 0) m[i] = 0;
    if (b < 0) m[i + 1] = 0;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const cp1x = pts[i].x + dx[i] / 3;
    const cp1y = pts[i].y + (m[i] * dx[i]) / 3;
    const cp2x = pts[i + 1].x - dx[i] / 3;
    const cp2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return path;
}

// Ticks "redondos" (0, y 3 pasos limpios hacia arriba) para el eje Y.
function ticksLimpios(maxVal: number): number[] {
  if (maxVal <= 0) return [0];
  const crudo = maxVal / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = Math.ceil(crudo / mag) * mag;
  const out: number[] = [];
  for (let v = 0; v <= maxVal + paso * 0.01; v += paso) out.push(Math.round(v));
  return out;
}

export default function GraficaLineas({
  etiquetas,
  series,
  alto = 260,
}: {
  etiquetas: string[];
  series: SerieLinea[];
  alto?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId();
  const contenedorRef = useRef<HTMLDivElement>(null);
  // Medimos el ancho real del contenedor para que el viewBox use la MISMA
  // escala en x que en y (1 unidad = 1px) — con `preserveAspectRatio="none"`
  // y un ancho fijo arbitrario, el navegador escala x y y por separado y
  // deforma círculos (se vuelven óvalos) y texto (se ve estirado).
  const [anchoMedido, setAnchoMedido] = useState(640);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setAnchoMedido(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const VW = anchoMedido;
  const VH = alto;
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 50;
  const padRight = 12;
  const n = etiquetas.length;
  const maxDato = Math.max(1, ...series.flatMap((s) => s.valores));
  const ticks = useMemo(() => ticksLimpios(maxDato), [maxDato]);
  const maxVal = ticks[ticks.length - 1] || 1;

  const plotW = VW - padLeft - padRight;
  const plotH = VH - padTop - padBottom;

  const x = (i: number) => padLeft + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padTop + plotH - (v / maxVal) * plotH;

  const activo = hoverIdx !== null;
  const idx = hoverIdx ?? n - 1;
  const hoverPct = n > 1 ? (idx / (n - 1)) * 100 : 50;
  const anchoBanda = n > 1 ? plotW / (n - 1) : plotW;

  return (
    <div className="space-y-4">
      {/* Leyenda como chips — arriba del área de dibujo, estilo Stripe/Notion */}
      <div className="flex items-center gap-2 flex-wrap">
        {series.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5 rounded-full text-caption"
            style={{
              padding: "4px 10px 4px 8px",
              background: `${s.color}14`,
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color, flexShrink: 0 }} />
            {s.label}
          </span>
        ))}
      </div>

      <div
        ref={contenedorRef}
        className="relative"
        style={{ height: alto }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gradId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <filter id={`${gradId}-sombra`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.22" />
            </filter>
          </defs>

          {/* eje Y — líneas guía + etiquetas redondas */}
          {ticks.map((t, i) => (
            <g key={t}>
              <line
                x1={padLeft}
                x2={VW - padRight}
                y1={y(t)}
                y2={y(t)}
                stroke={i === 0 ? "var(--border-subtle)" : "var(--border-faint)"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={padLeft - 10}
                y={y(t)}
                dy={3.5}
                textAnchor="end"
                fontSize={10.5}
                letterSpacing={0.2}
                fill="var(--text-tertiary)"
              >
                {fmtMxnCompacto(t)}
              </text>
            </g>
          ))}

          {/* eje X — mes inicial y final */}
          <text x={padLeft} y={VH - 8} fontSize={10.5} letterSpacing={0.2} fill="var(--text-tertiary)" textAnchor="start">
            {etiquetas[0]}
          </text>
          <text x={VW - padRight} y={VH - 8} fontSize={10.5} letterSpacing={0.2} fill="var(--text-tertiary)" textAnchor="end">
            {etiquetas[etiquetas.length - 1]}
          </text>

          {/* banda de foco tras el mes activo — spotlight suave */}
          <rect
            x={x(idx) - anchoBanda / 2}
            y={padTop}
            width={anchoBanda}
            height={plotH}
            fill="var(--bg-overlay)"
            opacity={activo ? 0.5 : 0}
            style={{ transition: "opacity 140ms ease" }}
          />

          {series.map((s) => {
            const pts = s.valores.map((v, i) => ({ x: x(i), y: y(v) }));
            const linea = pathSuave(pts);
            const area = `${linea} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
            return (
              <g key={s.key}>
                <path d={area} fill={`url(#${gradId}-${s.key})`} stroke="none" />
                <path
                  d={linea}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  filter={`url(#${gradId}-sombra)`}
                />
                {/* marcador fijo al final de la línea — punto de referencia siempre visible */}
                <circle
                  cx={x(n - 1)}
                  cy={y(s.valores[n - 1] ?? 0)}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--bg-elevated)"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* crosshair + marcador en el mes activo (hover) */}
          <line
            x1={x(idx)}
            x2={x(idx)}
            y1={padTop}
            y2={VH - padBottom}
            stroke="var(--border-default)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={activo ? 1 : 0}
            style={{ transition: "opacity 140ms ease" }}
          />
          {series.map((s) => (
            <circle
              key={s.key}
              cx={x(idx)}
              cy={y(s.valores[idx] ?? 0)}
              r={5}
              fill={s.color}
              stroke="var(--bg-elevated)"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              opacity={activo ? 1 : 0}
              style={{ transition: "opacity 140ms ease" }}
            />
          ))}

          {/* zonas invisibles para detectar el hover por mes — más grandes que la marca */}
          {etiquetas.map((_, i) => {
            const xPrev = i === 0 ? padLeft : (x(i - 1) + x(i)) / 2;
            const xNext = i === n - 1 ? VW - padRight : (x(i) + x(i + 1)) / 2;
            return (
              <rect
                key={i}
                x={xPrev}
                y={0}
                width={Math.max(0.01, xNext - xPrev)}
                height={VH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}
        </svg>

        <div
          className="absolute top-0 pointer-events-none rounded-[12px] px-3.5 py-2.5 space-y-1.5"
          style={{
            left: `${hoverPct}%`,
            transform: `translateX(${idx > n / 2 ? "calc(-100% - 12px)" : "12px"})`,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            minWidth: 170,
            zIndex: 10,
            opacity: activo ? 1 : 0,
            transition: "opacity 140ms ease",
          }}
        >
          <div className="text-caption text-text-secondary" style={{ fontWeight: 600 }}>
            {etiquetas[idx]}
          </div>
          <div className="space-y-1 pt-0.5">
            {series.map((s) => {
              const actualVal = s.valores[idx] ?? 0;
              const anterior = idx > 0 ? s.valores[idx - 1] ?? 0 : null;
              const pct = anterior != null && anterior !== 0 ? ((actualVal - anterior) / anterior) * 100 : null;
              return (
                <div key={s.key} className="flex items-center justify-between gap-4 text-caption">
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 10, height: 2.5, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                    <span className="text-text-tertiary">{s.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="num-tabular text-body-medium" style={{ fontSize: 13 }}>
                      {fmtMxn(actualVal)}
                    </span>
                    {pct != null && (
                      <span
                        className="num-tabular"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: pct >= 0 ? "var(--state-success)" : "var(--state-error)",
                        }}
                      >
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
