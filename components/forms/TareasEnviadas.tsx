import { Clock } from "lucide-react";

export type TareaEnviada = {
  nombre_limpio: string;
  hrs_min: number;
  hrs_max: number;
  hrsEnviadas: number | null;
};

/**
 * Lista de solo lectura con las horas EFECTIVAMENTE enviadas por tarea —
 * el acomodo proporcional que se calcula al guardar "Horas a enviar" (ver
 * POST /api/cotizaciones/[id]/horas-envio). Se muestra por default una vez
 * que existe ese acomodo; el botón "Ver/editar estimación original" (en
 * EstimacionForm.tsx) cambia a la tabla editable de siempre (TareasTabla).
 */
export default function TareasEnviadas({ tareas }: { tareas: TareaEnviada[] }) {
  return (
    <div className="space-y-3">
      {tareas.map((t, i) => (
        <div
          key={i}
          className="rounded-[12px] border px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="min-w-0">
            <div className="text-body-medium truncate">{t.nombre_limpio}</div>
            <div className="text-caption text-text-tertiary">
              Estimado: {t.hrs_min}–{t.hrs_max}h
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock size={14} strokeWidth={1.75} className="text-text-tertiary" />
            <span className="num-tabular text-body-medium" style={{ fontSize: 16 }}>
              {t.hrsEnviadas ?? 0}h
            </span>
          </div>
        </div>
      ))}
      {tareas.length === 0 && (
        <div className="card text-center text-body text-text-tertiary py-10">
          Sin tareas.
        </div>
      )}
    </div>
  );
}
