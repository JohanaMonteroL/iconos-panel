"use client";

// Mismo patrón que FiltrosCobros.tsx: búsqueda con debounce + selects que
// escriben en la URL. Incluye el segmentado Activos/Todos aquí mismo (antes
// era un Link aparte que perdía los demás filtros al cambiarlo).

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { PERIODICIDADES, PERIODICIDAD_LABEL } from "@/lib/pagos/labels";

type Props = {
  actuales: {
    q: string | null;
    periodicidad: string | null;
    pago: string | null; // "pagado" | "pendiente"
    orden: string | null;
    todos: boolean;
  };
};

export default function FiltrosPagos({ actuales }: Props) {
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
    !!actuales.q || !!actuales.periodicidad || !!actuales.pago || !!actuales.orden || actuales.todos;

  return (
    <section className="card card-tight space-y-3">
      <div className="flex items-center gap-2">
        <div className="input flex items-center gap-2 flex-1" style={{ padding: "0 12px" }}>
          <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
          <input
            className="flex-1 bg-transparent outline-none border-0"
            placeholder="Buscar por nombre o empresa…"
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
          <label className="field-label">Activos</label>
          <div className="segmented inline-flex gap-1 p-1 rounded-lg w-full">
            <button
              type="button"
              onClick={() => update("todos", null)}
              className={`btn-sm flex-1 ${!actuales.todos ? "btn-primary" : "btn-ghost"}`}
            >
              Activos
            </button>
            <button
              type="button"
              onClick={() => update("todos", "1")}
              className={`btn-sm flex-1 ${actuales.todos ? "btn-primary" : "btn-ghost"}`}
            >
              Todos
            </button>
          </div>
        </div>

        <div>
          <label className="field-label">Periodicidad</label>
          <select
            className="input"
            value={actuales.periodicidad ?? ""}
            onChange={(e) => update("periodicidad", e.target.value || null)}
          >
            <option value="">Todas</option>
            {PERIODICIDADES.map((p) => (
              <option key={p} value={p}>
                {PERIODICIDAD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Estado de pago</label>
          <select
            className="input"
            value={actuales.pago ?? ""}
            onChange={(e) => update("pago", e.target.value || null)}
          >
            <option value="">Todos</option>
            <option value="pagado">Pagado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>

        <div>
          <label className="field-label">Ordenar por</label>
          <select
            className="input"
            value={actuales.orden ?? ""}
            onChange={(e) => update("orden", e.target.value || null)}
          >
            <option value="">Nombre (A-Z)</option>
            <option value="monto">Monto (mayor a menor)</option>
            <option value="periodicidad">Periodicidad</option>
          </select>
        </div>
      </div>
    </section>
  );
}
