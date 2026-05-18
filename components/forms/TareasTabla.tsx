"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  X,
} from "lucide-react";
import { pertEsperado } from "@/lib/pert";

export type TareaRow = {
  nombre: string;
  descripcion: string;
  hrs_min: string;
  hrs_max: string;
};

export const filaVacia = (): TareaRow => ({
  nombre: "",
  descripcion: "",
  hrs_min: "",
  hrs_max: "",
});

type Props = {
  rows: TareaRow[];
  onChange: (rows: TareaRow[]) => void;
  errors?: Record<string, string>;
};

export default function TareasTabla({ rows, onChange, errors = {} }: Props) {
  // Set de índices de tareas cuya descripción está expandida.
  // Una tarea se expande si:
  //   - El usuario clicó "Agregar descripción", o
  //   - Ya trae descripción no vacía
  const [descAbiertas, setDescAbiertas] = useState<Set<number>>(new Set());

  const isDescAbierta = (i: number) =>
    descAbiertas.has(i) || rows[i].descripcion.trim() !== "";

  const update = (i: number, patch: Partial<TareaRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const remove = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
    setDescAbiertas((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  };

  const add = () => onChange([...rows, filaVacia()]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const copia = [...rows];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
    // Swap open-state también
    setDescAbiertas((prev) => {
      const next = new Set(prev);
      const hasI = prev.has(i);
      const hasJ = prev.has(j);
      next.delete(i);
      next.delete(j);
      if (hasI) next.add(j);
      if (hasJ) next.add(i);
      return next;
    });
  };

  const abrirDesc = (i: number) =>
    setDescAbiertas((prev) => new Set(prev).add(i));

  const cerrarDesc = (i: number) => {
    // Cerrar y limpiar la descripción
    update(i, { descripcion: "" });
    setDescAbiertas((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  };

  const calc = (r: TareaRow) => {
    const min = Number(r.hrs_min) || 0;
    const max = Number(r.hrs_max) || 0;
    return Math.round(pertEsperado(min, max) * 10) / 10;
  };

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const esp = calc(r);
        const isFirst = i === 0;
        const isLast = i === rows.length - 1;
        const descOpen = isDescAbierta(i);
        return (
          <div
            key={i}
            className="rounded-[12px] border overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div className="text-overline text-text-tertiary">Tarea {i + 1}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={isFirst}
                  aria-label="Mover arriba"
                  title="Mover arriba"
                  className="btn-icon btn-sm btn-ghost"
                >
                  <ChevronUp size={16} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={isLast}
                  aria-label="Mover abajo"
                  title="Mover abajo"
                  className="btn-icon btn-sm btn-ghost"
                >
                  <ChevronDown size={16} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Eliminar tarea ${i + 1}`}
                  title="Eliminar tarea"
                  className="btn-icon btn-sm btn-ghost"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:items-end">
                <div>
                  <label className="field-label">Nombre de la tarea *</label>
                  <input
                    className="input"
                    value={r.nombre}
                    onChange={(e) => update(i, { nombre: e.target.value })}
                    placeholder="Ej. Implementación pasarela de pagos"
                  />
                  {errors[`tareas.${i}.nombre`] && (
                    <span className="field-hint" style={{ color: "var(--state-error)" }}>
                      {errors[`tareas.${i}.nombre`]}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 lg:gap-4 items-end">
                  <div>
                    <label className="field-label">Mín *</label>
                    <input
                      className="input num-tabular text-center lg:w-[88px]"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={r.hrs_min}
                      onChange={(e) => update(i, { hrs_min: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Máx *</label>
                    <input
                      className="input num-tabular text-center lg:w-[88px]"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={r.hrs_max}
                      onChange={(e) => update(i, { hrs_max: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col items-center text-center lg:w-[88px]">
                    <span className="text-overline text-text-tertiary">Esperado</span>
                    <span
                      className="num-tabular mt-1.5"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        color: "var(--text-primary)",
                      }}
                    >
                      {esp}h
                    </span>
                  </div>
                </div>
              </div>

              {errors[`tareas.${i}.hrs_min`] && (
                <p className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors[`tareas.${i}.hrs_min`]}
                </p>
              )}
              {errors[`tareas.${i}.hrs_max`] && (
                <p className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors[`tareas.${i}.hrs_max`]}
                </p>
              )}

              {/* Descripción — colapsable */}
              {descOpen ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="field-label !mb-0">Descripción</label>
                    <button
                      type="button"
                      onClick={() => cerrarDesc(i)}
                      className="btn-ghost btn-sm"
                      title="Quitar descripción"
                    >
                      <X size={14} strokeWidth={1.75} />
                      <span>Quitar</span>
                    </button>
                  </div>
                  <textarea
                    className="textarea min-h-[120px]"
                    rows={5}
                    value={r.descripcion}
                    onChange={(e) => update(i, { descripcion: e.target.value })}
                    placeholder="Detalles: qué hay que hacer, supuestos, dependencias, alcance, criterios de aceptación…"
                    autoFocus={!r.descripcion}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => abrirDesc(i)}
                  className="btn-ghost btn-sm"
                >
                  <FileText size={14} strokeWidth={1.75} />
                  <span>Agregar descripción</span>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card text-center text-body text-text-tertiary py-10">
          Sin tareas. Agrega la primera.
        </div>
      )}

      <button type="button" onClick={add} className="btn-secondary">
        <Plus size={16} strokeWidth={1.75} />
        <span>Añadir tarea</span>
      </button>
    </div>
  );
}
