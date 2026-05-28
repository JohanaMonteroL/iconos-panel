"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { labelEstado } from "@/lib/estados";

const ESTADOS = ["recibida", "procesada_ia", "descartada"];

type Props = {
  programadores: { id: string; nombre: string }[];
  proyectos: string[];
  actuales: {
    q: string | null;
    estado: string | null;
    programador: string | null;
    proyecto: string | null;
    desde: string | null;
    hasta: string | null;
    archivadas: boolean;
  };
};

export default function FiltrosEstimaciones({
  programadores,
  proyectos,
  actuales,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(actuales.q ?? "");
  const [abierto, setAbierto] = useState(false);

  const update = (campo: string, valor: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (valor) next.set(campo, valor);
    else next.delete(campo);
    const qs = next.toString();
    router.push(`/panel/estimaciones${qs ? `?${qs}` : ""}`);
  };

  useEffect(() => {
    if ((q ?? "") === (actuales.q ?? "")) return;
    const t = setTimeout(() => update("q", q.trim() || null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const limpiar = () => {
    setQ("");
    const archParam = actuales.archivadas ? "?archivadas=1" : "";
    router.push(`/panel/estimaciones${archParam}`);
  };

  const tieneFiltros =
    !!actuales.q ||
    !!actuales.estado ||
    !!actuales.programador ||
    !!actuales.proyecto ||
    !!actuales.desde ||
    !!actuales.hasta;

  return (
    <section className="card card-tight space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="input flex items-center gap-2 flex-1"
          style={{ padding: "0 12px" }}
        >
          <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
          <input
            className="flex-1 bg-transparent outline-none border-0"
            placeholder="Buscar por nombre…"
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
          <button
            type="button"
            onClick={limpiar}
            className="btn-ghost btn-sm whitespace-nowrap"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className={`${abierto ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3`}>
        <div>
          <label className="field-label">Estado</label>
          <select
            className="input"
            value={actuales.estado ?? ""}
            onChange={(e) => update("estado", e.target.value || null)}
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {labelEstado(e)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Programador</label>
          <select
            className="input"
            value={actuales.programador ?? ""}
            onChange={(e) => update("programador", e.target.value || null)}
          >
            <option value="">Todos</option>
            {programadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
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
      </div>
    </section>
  );
}
