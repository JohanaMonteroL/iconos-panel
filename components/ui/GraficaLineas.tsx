"use client";

// Gráfica de líneas por mes (hasta 2 series), con hover que muestra el
// total en dinero y su variación % vs. el mes anterior — sin librería
// externa, solo SVG a mano, consistente con el resto del sistema.

import { useState } from "react";
import { fmtMxn } from "@/lib/dashboard/calculos";

export type SerieLinea = {
  key: string;
  label: string;
  color: string;
  valores: number[]; // mismo largo que `etiquetas`
};

export default function GraficaLineas({
  etiquetas,
  series,
  alto = 220,
}: {
  etiquetas: string[];
  series: SerieLinea[];
  alto?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 100; // viewBox en % — escalable
  const H = alto;
  const padY = 18;
  const n = etiquetas.length;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.valores));

  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - padY - (v / maxVal) * (H - padY * 2);

  const puntos = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  const idx = hoverIdx ?? n - 1;

  return (
    <div className="space-y-3">
      <div
        className="relative"
        style={{ height: alto }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          {/* líneas guía horizontales */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={y(maxVal * f)}
              y2={y(maxVal * f)}
              stroke="var(--border-faint)"
              strokeWidth={0.3}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {series.map((s) => (
            <polyline
              key={s.key}
              points={puntos(s.valores)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* línea vertical + puntos en el mes activo */}
          {hoverIdx !== null && (
            <line
              x1={x(idx)}
              x2={x(idx)}
              y1={0}
              y2={H}
              stroke="var(--border-default)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {series.map((s) => (
            <circle
              key={s.key}
              cx={x(idx)}
              cy={y(s.valores[idx] ?? 0)}
              r={hoverIdx !== null ? 2.2 : 0}
              fill={s.color}
              stroke="var(--bg-elevated)"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* zonas invisibles para detectar el hover por mes */}
          {etiquetas.map((_, i) => {
            const xPrev = i === 0 ? x(0) - (x(1) - x(0)) / 2 : (x(i - 1) + x(i)) / 2;
            const xNext = i === n - 1 ? x(i) + (x(i) - x(i - 1)) / 2 : (x(i) + x(i + 1)) / 2;
            return (
              <rect
                key={i}
                x={xPrev}
                y={0}
                width={Math.max(0.01, xNext - xPrev)}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}
        </svg>

        {hoverIdx !== null && (
          <div
            className="absolute top-0 pointer-events-none rounded-[10px] px-3 py-2 space-y-1"
            style={{
              left: `${x(idx)}%`,
              transform: `translateX(${idx > n / 2 ? "-105%" : "5%"})`,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-md)",
              minWidth: 150,
              zIndex: 10,
            }}
          >
            <div className="text-caption text-text-tertiary">{etiquetas[idx]}</div>
            {series.map((s) => {
              const actual = s.valores[idx] ?? 0;
              const anterior = idx > 0 ? s.valores[idx - 1] ?? 0 : null;
              const pct = anterior != null && anterior !== 0 ? ((actual - anterior) / anterior) * 100 : null;
              return (
                <div key={s.key} className="flex items-center justify-between gap-3 text-caption">
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
                    {s.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="num-tabular text-body-medium" style={{ fontSize: 12.5 }}>
                      {fmtMxn(actual)}
                    </span>
                    {pct != null && (
                      <span
                        className="num-tabular"
                        style={{
                          fontSize: 11,
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
        )}
      </div>

      <div className="flex items-center justify-between text-caption text-text-tertiary">
        <span>{etiquetas[0]}</span>
        <span>{etiquetas[etiquetas.length - 1]}</span>
      </div>

      <div className="flex items-center gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-caption text-text-secondary">
            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
