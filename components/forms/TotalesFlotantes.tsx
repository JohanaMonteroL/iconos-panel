"use client";

import { ListChecks } from "lucide-react";

type Props = {
  numTareas: number;
  totalMin: number;
  totalEsperado: number;
  totalMax: number;
  bufferPct?: number;
  totalMinBuf?: number;
  totalEsperadoBuf?: number;
  totalMaxBuf?: number;
};

function Cell({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="text-center min-w-[56px]">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
        {label}
      </div>
      <div
        className="num-tabular leading-none mt-1"
        style={{ fontSize: 16, fontWeight: emphasis ? 700 : 600 }}
      >
        {value}
      </div>
    </div>
  );
}

export default function TotalesFlotantes({
  numTareas,
  totalMin,
  totalEsperado,
  totalMax,
  bufferPct = 0,
  totalMinBuf,
  totalEsperadoBuf,
  totalMaxBuf,
}: Props) {
  const tieneBuffer = bufferPct > 0 && totalMinBuf !== undefined;

  return (
    <div
      className="fixed z-30 left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6
                 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-stretch gap-4 px-4 py-2.5 rounded-[14px]"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-md)",
          backdropFilter: "saturate(180%) blur(8px)",
        }}
      >
        {/* Tareas */}
        <div className="flex items-center gap-2 pr-3 border-r" style={{ borderColor: "var(--border-subtle)" }}>
          <ListChecks size={16} strokeWidth={1.75} className="text-text-secondary" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
              Tareas
            </div>
            <div className="num-tabular leading-none mt-1" style={{ fontSize: 16, fontWeight: 700 }}>
              {numTareas}
            </div>
          </div>
        </div>

        {/* Totales originales */}
        <Cell label="Mín" value={`${totalMin}h`} />
        <Cell label="PERT" value={`${totalEsperado}h`} />
        <Cell label="Máx" value={`${totalMax}h`} />

        {/* Con buffer */}
        {tieneBuffer && (
          <div
            className="flex items-stretch gap-3 pl-3 border-l"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Cell
              label={`+${bufferPct}% Mín`}
              value={`${totalMinBuf}h`}
              emphasis
            />
            <Cell
              label={`+${bufferPct}% PERT`}
              value={`${totalEsperadoBuf}h`}
              emphasis
            />
            <Cell
              label={`+${bufferPct}% Máx`}
              value={`${totalMaxBuf}h`}
              emphasis
            />
          </div>
        )}
      </div>
    </div>
  );
}
