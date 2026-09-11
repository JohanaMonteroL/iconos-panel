"use client";

// Mismos filtros que Cotizaciones (FiltrosCotizaciones.tsx) — buscar,
// estado, proyecto, fecha (rápida o personalizada) y orden — adaptados a
// Cobros: no hay "programador" aquí, y el estado es el del Período
// (ORDEN_FLUJO_COBRO_PERIODO), no el de una cotización.

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { ORDEN_FLUJO_COBRO_PERIODO, labelEstadoPeriodo } from "@/lib/estados/cobros";

type Props = {
  proyectos: string[]; // nombres únicos
  actuales: {
    q: string | null;
    estado: string | null;
    proyecto: string | null;
    desde: string | null;
    hasta: string | null;
    rango: string | null;
    orden: string | null;
  };
};

export default function FiltrosCobros({ proyectos, actuales }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(actuales.q ?? "");
  const [abierto, setAbierto] = useState(false);

  const update = (campo: string, valor: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (valor) next.set(campo, valor);
    else next.delete(campo);
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  useEffect(() => {
    if ((q ?? "") === (actuales.q ?? "")) return;
    const t = setTimeout(() => update("q", q.trim() || null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const limpiar = () => {
    setQ("");
    router.push(pathname);
  };

  const tieneFiltros =
    !!actuales.q ||
    !!actuales.estado ||
    !!actuales.proyecto ||
    !!actuales.desde ||
    !!actuales.hasta ||
    !!actuales.rango ||
    !!actuales.orden;

  const rango = actuales.rango ?? "";
  const cambiarRango = (valor: string) => {
    const next = new URLSearchParams(params.toString());
    if (valor) next.set("rango", valor);
    else next.delete("rango");
    if (valor !== "personalizado") {
      next.delete("desde");
      next.delete("hasta");
    }
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  return (
    <section className="card card-tight space-y-3">
      <div className="flex items-center gap-2">
        <div className="input flex items-center gap-2 flex-1" style={{ padding: "0 12px" }}>
          <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
          <input
            className="flex-1 bg-transparent outline-none border-0"
            placeholder="Buscar por etiqueta o título…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={`md:hidden btn-sm ${abierto || tieneFiltros ? "btn-primary" : "btn-ghost"} whitespace-nowrap`}
          aria-pressed={abierto}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
        {tieneFiltros && (
          <button type="button" onClick={limpiar} className="btn-ghost btn-sm whitespace-nowrap">
            Limpiar
          </button>
        )}
      </div>

      <div className={`${abierto ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
        <div>
          <label className="field-label">Estado</label>
          <select
            className="input"
            value={actuales.estado ?? ""}
            onChange={(e) => update("estado", e.target.value || null)}
          >
            <option value="">Todos</option>
            {ORDEN_FLUJO_COBRO_PERIODO.map((e) => (
              <option key={e} value={e}>
                {labelEstadoPeriodo(e)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Proyecto</label>
          <select
            className="input"
            value={actuales.proyecto ?? ""}
            onChange={(e) => update("proyecto", e.target.value || null)}
          >
            <option value="">Todos</option>
            {proyectos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Ordenar por</label>
          <select
            className="input"
            value={actuales.orden ?? ""}
            onChange={(e) => update("orden", e.target.value || null)}
          >
            <option value="">Más reciente</option>
            <option value="nombre">Nombre (A-Z)</option>
            <option value="monto">Monto (mayor a menor)</option>
          </select>
        </div>

        <div>
          <label className="field-label">Fecha</label>
          <select className="input" value={rango} onChange={(e) => cambiarRango(e.target.value)}>
            <option value="">Todas</option>
            <option value="este_mes">Este mes</option>
            <option value="mes_pasado">Mes pasado</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        {rango === "personalizado" && (
          <>
            <div>
              <label className="field-label">Desde</label>
              <input
                type="date"
                className="input"
                value={actuales.desde ?? ""}
                onChange={(e) => update("desde", e.target.value || null)}
              />
            </div>
            <div>
              <label className="field-label">Hasta</label>
              <input
                type="date"
                className="input"
                value={actuales.hasta ?? ""}
                onChange={(e) => update("hasta", e.target.value || null)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
