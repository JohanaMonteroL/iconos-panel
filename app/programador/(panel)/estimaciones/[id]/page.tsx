// Detalle de "mi estimación" (programador) — lee directo de `cotizaciones` +
// `tareas_estimacion`. Ya no hay estimacion vs. cotización por separado: el
// toggle "Original / Final" ahora compara nombre_original/descripcion_original
// (lo que escribió el programador) contra nombre_limpio/descripcion_limpia
// (lo que quedó después de IA + ediciones de Johana) por tarea.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireProgramador } from "@/lib/programador/auth";
import { formatFechaLarga } from "@/lib/dates";
import { labelEstado, badgeEstado } from "@/lib/estados";
import ToggleOriginalLimpia from "./ToggleOriginalLimpia";

export const dynamic = "force-dynamic";

type TareaRow = {
  orden: number;
  nombre_original: string;
  nombre_limpio: string | null;
  descripcion_original: string | null;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
};

type CotizacionDetalle = {
  id: string;
  created_at: string;
  estado: string;
  programador_id: string | null;
  nombre: string;
  nombre_original: string | null;
  proyecto_nombre: string | null;
  notas_programador: string | null;
  buffer_porcentaje: number | null;
  horas_min: number;
  horas_max: number;
  horas_envio: number | null;
  jefe_aprobacion_recibida_at: string | null;
  tareas_estimacion: TareaRow[];
};

async function getCotizacion(
  id: string,
  programadorId: string
): Promise<CotizacionDetalle | null> {
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("cotizaciones")
    .select(
      `id, created_at, estado, programador_id, nombre, nombre_original,
       proyecto_nombre, notas_programador, buffer_porcentaje,
       horas_min, horas_max, horas_envio,
       jefe_aprobacion_recibida_at,
       tareas_estimacion(orden, nombre_original, nombre_limpio, descripcion_original, descripcion_limpia, hrs_min, hrs_max)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || data.programador_id !== programadorId) return null;

  const cot = data as unknown as CotizacionDetalle;
  cot.tareas_estimacion = (cot.tareas_estimacion ?? []).slice().sort(
    (a, b) => a.orden - b.orden
  );
  return cot;
}

function totales(tareas: TareaRow[]) {
  const min = tareas.reduce((s, t) => s + (t.hrs_min || 0), 0);
  const max = tareas.reduce((s, t) => s + (t.hrs_max || 0), 0);
  const pert = Math.round(((min + max) / 2) * 10) / 10;
  return { min, max, pert };
}

export default async function EstimacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const p = (await requireProgramador())!;
  const cot = await getCotizacion(params.id, p.id);
  if (!cot) notFound();

  const nombreOriginal = cot.nombre_original || cot.nombre || "(sin nombre)";
  const nombreFinal = cot.nombre || nombreOriginal;
  const buffer = cot.buffer_porcentaje ?? 0;
  const totOrig = totales(cot.tareas_estimacion);

  const tareasFinales = cot.tareas_estimacion.map((t) => ({
    nombre: t.nombre_limpio || t.nombre_original,
    descripcion: t.descripcion_limpia || t.descripcion_original || "",
    hrs_min: t.hrs_min,
    hrs_max: t.hrs_max,
  }));
  const tareasOriginales = cot.tareas_estimacion.map((t) => ({
    nombre: t.nombre_original,
    descripcion: t.descripcion_original || "",
    hrs_min: t.hrs_min,
    hrs_max: t.hrs_max,
  }));
  const hayDiferenciaConOriginal = cot.tareas_estimacion.some(
    (t) =>
      (t.nombre_limpio && t.nombre_limpio !== t.nombre_original) ||
      (t.descripcion_limpia && t.descripcion_limpia !== t.descripcion_original)
  );

  return (
    <>
      <Link
        href="/programador/estimaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-display">{nombreFinal}</h1>
          <span className={`badge ${badgeEstado(cot.estado)}`}>
            {labelEstado(cot.estado)}
          </span>
        </div>
        <p className="text-caption text-text-secondary">
          {cot.proyecto_nombre && (
            <>
              <span className="text-text-primary">{cot.proyecto_nombre}</span>
              {" · "}
            </>
          )}
          creada {formatFechaLarga(cot.created_at)}
          {cot.jefe_aprobacion_recibida_at && (
            <> · aprobada {formatFechaLarga(cot.jefe_aprobacion_recibida_at)}</>
          )}
        </p>
      </header>

      {/* Resumen de horas */}
      <section className="card space-y-5">
        <h2 className="text-heading-2">Resumen de horas</h2>

        <div>
          <div className="text-overline text-text-tertiary mb-3">
            Tus horas originales
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totOrig.min}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">PERT</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totOrig.pert}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totOrig.max}h
              </div>
            </div>
          </div>
        </div>

        {buffer > 0 && (
          <p className="text-caption text-text-secondary">
            Buffer aplicado por Johana: <strong>+{buffer}%</strong>
          </p>
        )}

        {cot.horas_envio != null && cot.horas_envio > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="text-overline text-text-tertiary flex items-center gap-1">
              <Send size={12} strokeWidth={1.5} />
              Horas enviadas al jefe / cliente
            </div>
            <div className="mt-1 num-tabular" style={{ fontSize: 28, fontWeight: 700 }}>
              {cot.horas_envio}h
            </div>
            <div className="text-caption text-text-tertiary">
              Total final con buffer y ajustes que decidió Johana.
            </div>
          </div>
        )}
      </section>

      {/* Tareas — con toggle entre final (limpia/enviada) y original */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-heading-2">Tareas ({cot.tareas_estimacion.length})</h2>
          {hayDiferenciaConOriginal && (
            <ToggleOriginalLimpia
              limpia={tareasFinales}
              original={tareasOriginales}
              nombreOriginal={nombreOriginal}
              nombreLimpio={nombreFinal}
              labelLimpia="Final"
            />
          )}
        </div>

        {!hayDiferenciaConOriginal && (
          <ul className="space-y-3">
            {tareasOriginales.map((t, i) => (
              <li
                key={i}
                className="rounded-[12px] border overflow-hidden"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
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
                  <span className="text-caption text-text-tertiary num-tabular">
                    {t.hrs_min}–{t.hrs_max}h
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-body-medium">{t.nombre}</div>
                  {t.descripcion && (
                    <p className="text-body text-text-secondary whitespace-pre-wrap">
                      {t.descripcion}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notas */}
      {cot.notas_programador && (
        <section className="card space-y-2">
          <h2 className="text-heading-2">Tus notas</h2>
          <p className="text-body text-text-secondary whitespace-pre-wrap">
            {cot.notas_programador}
          </p>
        </section>
      )}
    </>
  );
}
