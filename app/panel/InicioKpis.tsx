"use client";

// Fila de KPIs "por mes" del Inicio — el selector solo cambia qué mes de
// `porMes` se muestra; todo ya viene precalculado del server component, así
// que cambiar de mes es instantáneo (sin refetch).

import { useState } from "react";
import { Calendar, Wallet, Landmark, Hammer, FileStack } from "lucide-react";
import { fmtMxn } from "@/lib/dashboard/calculos";

export type KpiMes = {
  key: string;
  label: string;
  cobradoMonto: number;
  cobradoCount: number;
  pendienteMonto: number;
  pendienteCount: number;
  enDesarrolloCount: number;
  cotizadoMonto: number;
  cotizadoCount: number;
};

export default function InicioKpis({ porMes }: { porMes: KpiMes[] }) {
  const [idx, setIdx] = useState(porMes.length - 1);
  const mes = porMes[idx];

  const kpis: {
    label: string;
    value: string;
    icon: typeof Wallet;
    iconBg: string;
    iconFg: string;
    sub: string;
  }[] = [
    {
      label: "Total cobrado",
      value: fmtMxn(mes.cobradoMonto),
      icon: Wallet,
      iconBg: "#DCFCE7",
      iconFg: "#15803D",
      sub: `${mes.cobradoCount} cotización${mes.cobradoCount === 1 ? "" : "es"}`,
    },
    {
      label: "Pendiente por cobrar",
      value: fmtMxn(mes.pendienteMonto),
      icon: Landmark,
      iconBg: "#FEE2E2",
      iconFg: "#DC2626",
      sub: `${mes.pendienteCount} cotización${mes.pendienteCount === 1 ? "" : "es"}`,
    },
    {
      label: "En desarrollo",
      value: String(mes.enDesarrolloCount),
      icon: Hammer,
      iconBg: "#E0E7FF",
      iconFg: "#4F46E5",
      sub: `cotización${mes.enDesarrolloCount === 1 ? "" : "es"} en curso`,
    },
    {
      label: "Total cotizado",
      value: fmtMxn(mes.cotizadoMonto),
      icon: FileStack,
      iconBg: "#EDE9FE",
      iconFg: "#6D28D9",
      sub: `${mes.cotizadoCount} cotización${mes.cotizadoCount === 1 ? "" : "es"} creada${mes.cotizadoCount === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-heading-2">Resumen del mes</h2>
        <div className="relative inline-flex items-center gap-2">
          <Calendar size={14} strokeWidth={1.75} className="text-text-tertiary pointer-events-none absolute left-3" />
          <select
            className="input"
            style={{ paddingLeft: 30, height: 36, width: "auto" }}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
          >
            {porMes.map((m, i) => (
              <option key={m.key} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className="card card-hover">
            <div className="flex items-center gap-2">
              <span
                className="grid place-items-center flex-shrink-0"
                style={{ width: 27, height: 27, borderRadius: "50%", background: k.iconBg, color: k.iconFg }}
              >
                <k.icon size={13.5} strokeWidth={1.9} />
              </span>
              <span className="text-caption" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                {k.label}
              </span>
            </div>
            <div
              className="num-tabular"
              style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-1.1px", lineHeight: 1.1, marginTop: 13 }}
            >
              {k.value}
            </div>
            <div
              className="text-caption"
              style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
