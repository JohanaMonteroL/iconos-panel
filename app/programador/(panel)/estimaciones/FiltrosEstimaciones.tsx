"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ORDEN_FLUJO_COTIZACION, labelEstado } from "@/lib/estados";

type Props = {
  actuales: {
    estado: string | null;
    q: string | null;
  };
};

const ESTADOS = [
  { id: "", label: "Todos" },
  ...ORDEN_FLUJO_COTIZACION.map((e) => ({ id: e, label: labelEstado(e) })),
];

export default function FiltrosEstimaciones({ actuales }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(actuales.q ?? "");

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      const qs = next.toString();
      router.push(`/programador/estimaciones${qs ? `?${qs}` : ""}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const setEstado = (estado: string) => {
    const next = new URLSearchParams(params.toString());
    if (estado) next.set("estado", estado);
    else next.delete("estado");
    const qs = next.toString();
    router.push(`/programador/estimaciones${qs ? `?${qs}` : ""}`);
  };

  const limpiar = () => {
    setQ("");
    router.push("/programador/estimaciones");
  };

  const tieneFiltros = !!actuales.estado || !!actuales.q;

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
            placeholder="Buscar por nombre, tarea, proyecto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
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
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const activo = (actuales.estado ?? "") === e.id;
          return (
            <button
              key={e.id || "all"}
              type="button"
              onClick={() => setEstado(e.id)}
              className={`btn-sm whitespace-nowrap ${
                activo ? "btn-primary" : "btn-secondary"
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
