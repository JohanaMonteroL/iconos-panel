"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type Props = {
  proyectos: { key: string; nombre: string }[];
  asignados: { id: string; nombre: string }[];
  actuales: {
    tipo: string | null;
    proyecto: string | null;
    asignado: string | null;
  };
};

const TIPOS = [
  { id: "estimacion", label: "Estimación" },
  { id: "desarrollo", label: "Desarrollo" },
  { id: "soporte", label: "Soporte" },
  { id: "investigacion", label: "Investigación" },
];

export default function FiltrosTickets({
  proyectos,
  asignados,
  actuales,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const aplicar = (campo: "tipo" | "proyecto" | "asignado", valor: string) => {
    const next = new URLSearchParams(params.toString());
    if (!valor) next.delete(campo);
    else next.set(campo, valor);
    const qs = next.toString();
    router.push(`/panel/tickets${qs ? `?${qs}` : ""}`);
  };

  const tieneFiltros =
    !!actuales.tipo || !!actuales.proyecto || !!actuales.asignado;

  return (
    <section className="card card-tight space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-overline text-text-tertiary">Filtros</div>
        {tieneFiltros && (
          <button
            type="button"
            onClick={() => router.push("/panel/tickets")}
            className="btn-ghost btn-sm"
          >
            <X size={14} strokeWidth={1.75} />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Tipo"
          value={actuales.tipo ?? ""}
          onChange={(v) => aplicar("tipo", v)}
          options={[
            { value: "", label: "Todos los tipos" },
            ...TIPOS.map((t) => ({ value: t.id, label: t.label })),
          ]}
        />
        <Select
          label="Proyecto"
          value={actuales.proyecto ?? ""}
          onChange={(v) => aplicar("proyecto", v)}
          options={[
            { value: "", label: "Todos los proyectos" },
            ...proyectos.map((p) => ({ value: p.key, label: p.nombre })),
          ]}
        />
        <Select
          label="Asignado"
          value={actuales.asignado ?? ""}
          onChange={(v) => aplicar("asignado", v)}
          options={[
            { value: "", label: "Cualquier asignado" },
            ...asignados.map((a) => ({ value: a.id, label: a.nombre })),
          ]}
        />
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
